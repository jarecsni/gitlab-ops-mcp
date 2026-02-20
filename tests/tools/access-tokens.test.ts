import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAccessTokenTools } from '../../src/tools/access-tokens.js'
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
  const server = new McpServer({ name: 'test-access-tokens', version: '0.0.0' })
  registerAccessTokenTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Access token tool handlers', () => {
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


  // ── create_project_access_token ────────────────────────────────────

  describe('create_project_access_token', () => {
    it('sends POST to /projects/:id/access_tokens with body', async () => {
      const created = { id: 1, name: 'ci-token', token: 'glpat-xxxx' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_project_access_token',
        arguments: {
          project_id: '42',
          name: 'ci-token',
          scopes: ['api', 'read_repository'],
          access_level: 30,
          expires_at: '2025-12-31',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/42/access_tokens',
        {
          name: 'ci-token',
          scopes: ['api', 'read_repository'],
          access_level: 30,
          expires_at: '2025-12-31',
        },
      )
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({ id: 2 })

      await client.callTool({
        name: 'create_project_access_token',
        arguments: {
          project_id: 'my-group/my-project',
          name: 'token',
          scopes: ['api'],
          access_level: 40,
          expires_at: '2025-06-01',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/my-group%2Fmy-project/access_tokens',
        expect.any(Object),
      )
    })

    it('passes single scope in array', async () => {
      mockApi.post.mockResolvedValue({ id: 3 })

      await client.callTool({
        name: 'create_project_access_token',
        arguments: {
          project_id: '10',
          name: 'read-only',
          scopes: ['read_api'],
          access_level: 20,
          expires_at: '2025-03-15',
        },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body.scopes).toEqual(['read_api'])
    })
  })

  // ── list_project_access_tokens ─────────────────────────────────────

  describe('list_project_access_tokens', () => {
    it('sends GET to /projects/:id/access_tokens', async () => {
      const tokens = [{ id: 1, name: 'ci-token' }, { id: 2, name: 'deploy-token' }]
      mockApi.get.mockResolvedValue(tokens)

      const result = await client.callTool({
        name: 'list_project_access_tokens',
        arguments: { project_id: '42' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/42/access_tokens')
      expect(getResultText(result)).toBe(JSON.stringify(tokens, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({
        name: 'list_project_access_tokens',
        arguments: { project_id: 'org/sub/repo' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/org%2Fsub%2Frepo/access_tokens')
    })
  })

  // ── revoke_project_access_token ────────────────────────────────────

  describe('revoke_project_access_token', () => {
    it('sends DELETE to /projects/:id/access_tokens/:token_id', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'revoke_project_access_token',
        arguments: { project_id: '42', token_id: 7 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/access_tokens/7')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })

    it('encodes project_id with slashes', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'revoke_project_access_token',
        arguments: { project_id: 'a/b', token_id: 3 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/a%2Fb/access_tokens/3')
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(401, '401 Unauthorized'))

      const result = await client.callTool({
        name: 'create_project_access_token',
        arguments: {
          project_id: '1',
          name: 'fail',
          scopes: ['api'],
          access_level: 30,
          expires_at: '2025-01-01',
        },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 401: 401 Unauthorized')
    })

    it('returns connection error on network failure', async () => {
      mockApi.get.mockRejectedValue(new GitLabConnectionError(new Error('ETIMEDOUT')))

      const result = await client.callTool({
        name: 'list_project_access_tokens',
        arguments: { project_id: '1' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('kaboom'))

      const result = await client.callTool({
        name: 'revoke_project_access_token',
        arguments: { project_id: '1', token_id: 1 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: kaboom')
    })
  })

  // ── Response format ────────────────────────────────────────────────

  describe('response format', () => {
    it('returns JSON-stringified response with 2-space indent', async () => {
      const data = { id: 1, name: 'ci-token', scopes: ['api'], active: true }
      mockApi.get.mockResolvedValue([data])

      const result = await client.callTool({
        name: 'list_project_access_tokens',
        arguments: { project_id: '1' },
      })

      const text = getResultText(result)
      expect(text).toBe(JSON.stringify([data], null, 2))
      expect(text).toContain('\n')
    })

    it('revoke returns { status: "success" } as JSON', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'revoke_project_access_token',
        arguments: { project_id: '1', token_id: 1 },
      })

      const parsed = JSON.parse(getResultText(result))
      expect(parsed).toEqual({ status: 'success' })
    })
  })
})
