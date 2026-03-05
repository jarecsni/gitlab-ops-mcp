import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerProjectTools } from '../../src/tools/projects.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'
import { GitLabApiError, GitLabConnectionError } from '../../src/errors.js'

function getResultText(result: Awaited<ReturnType<Client['callTool']>>): string {
  if ('content' in result && Array.isArray(result.content)) {
    const textItem = result.content[0]
    if (textItem && 'text' in textItem) return textItem.text
  }
  throw new Error('Unexpected result shape')
}

function createMockClient(): GitLabApiClient & {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
} {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

async function setupTestHarness(mockClient: GitLabApiClient) {
  const server = new McpServer({ name: 'test-projects', version: '0.0.0' })
  registerProjectTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Project tool handlers', () => {
  let mockApi: ReturnType<typeof createMockClient>
  let client: Client

  beforeEach(async () => {
    mockApi = createMockClient()
    const harness = await setupTestHarness(mockApi)
    client = harness.client
  })

  afterEach(async () => {
    await client.close()
  })

  // ── create_project ─────────────────────────────────────────────────

  describe('create_project', () => {
    it('sends POST to /projects with name only', async () => {
      const created = { id: 1, name: 'my-project', path_with_namespace: 'user/my-project', web_url: 'https://gitlab.com/user/my-project' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_project',
        arguments: { name: 'my-project' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', { name: 'my-project' })
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('includes namespace_id when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 2 })

      await client.callTool({
        name: 'create_project',
        arguments: { name: 'group-project', namespace_id: 42 },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', {
        name: 'group-project',
        namespace_id: 42,
      })
    })

    it('includes description when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 3 })

      await client.callTool({
        name: 'create_project',
        arguments: { name: 'described', description: 'A test project' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', {
        name: 'described',
        description: 'A test project',
      })
    })

    it('includes visibility when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 4 })

      await client.callTool({
        name: 'create_project',
        arguments: { name: 'pub', visibility: 'public' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', {
        name: 'pub',
        visibility: 'public',
      })
    })

    it('includes initialize_with_readme when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 5 })

      await client.callTool({
        name: 'create_project',
        arguments: { name: 'with-readme', initialize_with_readme: true },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', {
        name: 'with-readme',
        initialize_with_readme: true,
      })
    })

    it('includes all optional fields together', async () => {
      mockApi.post.mockResolvedValue({ id: 6 })

      await client.callTool({
        name: 'create_project',
        arguments: {
          name: 'full',
          namespace_id: 99,
          description: 'Full options',
          visibility: 'internal',
          initialize_with_readme: true,
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/projects', {
        name: 'full',
        namespace_id: 99,
        description: 'Full options',
        visibility: 'internal',
        initialize_with_readme: true,
      })
    })

    it('omits undefined optional fields from body', async () => {
      mockApi.post.mockResolvedValue({ id: 7 })

      await client.callTool({
        name: 'create_project',
        arguments: { name: 'minimal' },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body).toEqual({ name: 'minimal' })
      expect(body).not.toHaveProperty('namespace_id')
      expect(body).not.toHaveProperty('description')
      expect(body).not.toHaveProperty('visibility')
      expect(body).not.toHaveProperty('initialize_with_readme')
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error for namespace not found', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(404, 'Namespace not found'))

      const result = await client.callTool({
        name: 'create_project',
        arguments: { name: 'fail', namespace_id: 999 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 404: Namespace not found')
    })

    it('returns GitLab API error for duplicate project name', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(409, 'Project already exists'))

      const result = await client.callTool({
        name: 'create_project',
        arguments: { name: 'existing', namespace_id: 42 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('409')
    })

    it('returns connection error on network failure', async () => {
      mockApi.post.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({
        name: 'create_project',
        arguments: { name: 'fail' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.post.mockRejectedValue(new Error('something broke'))

      const result = await client.callTool({
        name: 'create_project',
        arguments: { name: 'fail' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: something broke')
    })
  })
})
