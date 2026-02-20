import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerGroupTools } from '../../src/tools/groups.js'
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
  const server = new McpServer({ name: 'test-groups', version: '0.0.0' })
  registerGroupTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Group tool handlers', () => {
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


  // ── create_group ───────────────────────────────────────────────────

  describe('create_group', () => {
    it('sends POST to /groups with name and path', async () => {
      const created = { id: 1, name: 'my-group', path: 'my-group' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'my-group', path: 'my-group' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/groups', { name: 'my-group', path: 'my-group' })
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('includes visibility when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 2 })

      await client.callTool({
        name: 'create_group',
        arguments: { name: 'public-group', path: 'public-group', visibility: 'public' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'public-group',
        path: 'public-group',
        visibility: 'public',
      })
    })

    it('includes parent_id for subgroup creation', async () => {
      mockApi.post.mockResolvedValue({ id: 3 })

      await client.callTool({
        name: 'create_group',
        arguments: { name: 'sub', path: 'sub', parent_id: 42 },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'sub',
        path: 'sub',
        parent_id: 42,
      })
    })

    it('includes description when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 4 })

      await client.callTool({
        name: 'create_group',
        arguments: { name: 'described', path: 'described', description: 'A test group' },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'described',
        path: 'described',
        description: 'A test group',
      })
    })

    it('includes all optional fields together', async () => {
      mockApi.post.mockResolvedValue({ id: 5 })

      await client.callTool({
        name: 'create_group',
        arguments: {
          name: 'full',
          path: 'full',
          visibility: 'internal',
          parent_id: 10,
          description: 'Full options',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'full',
        path: 'full',
        visibility: 'internal',
        parent_id: 10,
        description: 'Full options',
      })
    })

    it('omits undefined optional fields from body', async () => {
      mockApi.post.mockResolvedValue({ id: 6 })

      await client.callTool({
        name: 'create_group',
        arguments: { name: 'minimal', path: 'minimal' },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body).toEqual({ name: 'minimal', path: 'minimal' })
      expect(body).not.toHaveProperty('visibility')
      expect(body).not.toHaveProperty('parent_id')
      expect(body).not.toHaveProperty('description')
    })

    it('accepts private visibility', async () => {
      mockApi.post.mockResolvedValue({ id: 7 })

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'priv', path: 'priv', visibility: 'private' },
      })

      expect(result.isError).toBeUndefined()
      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'priv',
        path: 'priv',
        visibility: 'private',
      })
    })

    it('accepts internal visibility', async () => {
      mockApi.post.mockResolvedValue({ id: 8 })

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'int', path: 'int', visibility: 'internal' },
      })

      expect(result.isError).toBeUndefined()
      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'int',
        path: 'int',
        visibility: 'internal',
      })
    })

    it('accepts public visibility', async () => {
      mockApi.post.mockResolvedValue({ id: 9 })

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'pub', path: 'pub', visibility: 'public' },
      })

      expect(result.isError).toBeUndefined()
      expect(mockApi.post).toHaveBeenCalledWith('/groups', {
        name: 'pub',
        path: 'pub',
        visibility: 'public',
      })
    })
  })

  // ── list_groups ────────────────────────────────────────────────────

  describe('list_groups', () => {
    it('sends GET to /groups with no params', async () => {
      const groups = [{ id: 1, name: 'group-a' }]
      mockApi.get.mockResolvedValue(groups)

      const result = await client.callTool({ name: 'list_groups', arguments: {} })

      expect(mockApi.get).toHaveBeenCalledWith('/groups', {})
      expect(getResultText(result)).toBe(JSON.stringify(groups, null, 2))
    })

    it('passes search filter as query param', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_groups', arguments: { search: 'workshop' } })

      expect(mockApi.get).toHaveBeenCalledWith('/groups', { search: 'workshop' })
    })

    it('passes owned filter as string', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_groups', arguments: { owned: true } })

      expect(mockApi.get).toHaveBeenCalledWith('/groups', { owned: 'true' })
    })

    it('passes min_access_level as string', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_groups', arguments: { min_access_level: 30 } })

      expect(mockApi.get).toHaveBeenCalledWith('/groups', { min_access_level: '30' })
    })

    it('passes all filters together', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({
        name: 'list_groups',
        arguments: { search: 'dev', owned: false, min_access_level: 20 },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/groups', {
        search: 'dev',
        owned: 'false',
        min_access_level: '20',
      })
    })
  })

  // ── delete_group ───────────────────────────────────────────────────

  describe('delete_group', () => {
    it('sends DELETE to /groups/:id', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_group',
        arguments: { group_id: 42 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/groups/42')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(403, '403 Forbidden'))

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'fail', path: 'fail' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 403: 403 Forbidden')
    })

    it('returns connection error on network failure', async () => {
      mockApi.get.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({ name: 'list_groups', arguments: {} })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('something broke'))

      const result = await client.callTool({
        name: 'delete_group',
        arguments: { group_id: 1 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: something broke')
    })
  })

  // ── Response format ────────────────────────────────────────────────

  describe('response format', () => {
    it('returns JSON-stringified response with 2-space indent', async () => {
      const data = { id: 1, name: 'test', path: 'test', visibility: 'private' }
      mockApi.post.mockResolvedValue(data)

      const result = await client.callTool({
        name: 'create_group',
        arguments: { name: 'test', path: 'test' },
      })

      const text = getResultText(result)
      expect(text).toBe(JSON.stringify(data, null, 2))
      expect(text).toContain('\n')
    })

    it('delete returns { status: "success" } as JSON', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_group',
        arguments: { group_id: 1 },
      })

      const parsed = JSON.parse(getResultText(result))
      expect(parsed).toEqual({ status: 'success' })
    })
  })
})
