import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerWebhookTools } from '../../src/tools/webhooks.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'
import { GitLabApiError, GitLabConnectionError } from '../../src/errors.js'

// Helper to extract text from MCP tool result
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
  const server = new McpServer({ name: 'test-webhooks', version: '0.0.0' })
  registerWebhookTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Webhook tool handlers', () => {
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


  // ── list_webhooks ──────────────────────────────────────────────────

  describe('list_webhooks', () => {
    it('sends GET to /projects/:id/hooks', async () => {
      const hooks = [{ id: 1, url: 'https://example.com' }]
      mockApi.get.mockResolvedValue(hooks)

      const result = await client.callTool({ name: 'list_webhooks', arguments: { project_id: '42' } })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/42/hooks')
      expect(getResultText(result)).toBe(JSON.stringify(hooks, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_webhooks', arguments: { project_id: 'my-group/my-project' } })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/my-group%2Fmy-project/hooks')
    })

    it('encodes project_id with special characters', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_webhooks', arguments: { project_id: 'org/sub group/repo' } })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/org%2Fsub%20group%2Frepo/hooks')
    })
  })

  // ── create_webhook ─────────────────────────────────────────────────

  describe('create_webhook', () => {
    it('sends POST to /projects/:id/hooks with url in body', async () => {
      const created = { id: 10, url: 'https://hooks.example.com/push' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_webhook',
        arguments: { project_id: '99', url: 'https://hooks.example.com/push' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/99/hooks',
        { url: 'https://hooks.example.com/push' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('includes optional event flags in the body', async () => {
      mockApi.post.mockResolvedValue({ id: 11 })

      await client.callTool({
        name: 'create_webhook',
        arguments: {
          project_id: '5',
          url: 'https://ci.example.com',
          push_events: true,
          tag_push_events: true,
          merge_requests_events: false,
          enable_ssl_verification: true,
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/5/hooks',
        {
          url: 'https://ci.example.com',
          push_events: true,
          tag_push_events: true,
          merge_requests_events: false,
          enable_ssl_verification: true,
        },
      )
    })

    it('includes token when provided', async () => {
      mockApi.post.mockResolvedValue({ id: 12 })

      await client.callTool({
        name: 'create_webhook',
        arguments: {
          project_id: '7',
          url: 'https://secure.example.com',
          token: 'my-secret-token',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/7/hooks',
        { url: 'https://secure.example.com', token: 'my-secret-token' },
      )
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({ id: 13 })

      await client.callTool({
        name: 'create_webhook',
        arguments: { project_id: 'team/repo', url: 'https://x.com' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/team%2Frepo/hooks',
        { url: 'https://x.com' },
      )
    })

    it('omits undefined optional fields from body', async () => {
      mockApi.post.mockResolvedValue({ id: 14 })

      await client.callTool({
        name: 'create_webhook',
        arguments: { project_id: '1', url: 'https://minimal.com' },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body).toEqual({ url: 'https://minimal.com' })
      expect(body).not.toHaveProperty('token')
      expect(body).not.toHaveProperty('push_events')
    })
  })

  // ── update_webhook ─────────────────────────────────────────────────

  describe('update_webhook', () => {
    it('sends PUT to /projects/:id/hooks/:hook_id', async () => {
      const updated = { id: 5, url: 'https://updated.example.com' }
      mockApi.put.mockResolvedValue(updated)

      const result = await client.callTool({
        name: 'update_webhook',
        arguments: { project_id: '42', hook_id: 5, url: 'https://updated.example.com' },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/42/hooks/5',
        { url: 'https://updated.example.com' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(updated, null, 2))
    })

    it('includes only provided optional fields in body', async () => {
      mockApi.put.mockResolvedValue({ id: 5 })

      await client.callTool({
        name: 'update_webhook',
        arguments: {
          project_id: '42',
          hook_id: 5,
          push_events: false,
          pipeline_events: true,
        },
      })

      const [, body] = mockApi.put.mock.calls[0]
      expect(body).toEqual({ push_events: false, pipeline_events: true })
      expect(body).not.toHaveProperty('url')
      expect(body).not.toHaveProperty('token')
    })

    it('encodes project_id and uses numeric hook_id in path', async () => {
      mockApi.put.mockResolvedValue({ id: 77 })

      await client.callTool({
        name: 'update_webhook',
        arguments: { project_id: 'ns/proj', hook_id: 77 },
      })

      expect(mockApi.put).toHaveBeenCalledWith('/projects/ns%2Fproj/hooks/77', {})
    })
  })

  // ── delete_webhook ─────────────────────────────────────────────────

  describe('delete_webhook', () => {
    it('sends DELETE to /projects/:id/hooks/:hook_id', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_webhook',
        arguments: { project_id: '42', hook_id: 9 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/hooks/9')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })

    it('encodes project_id with slashes', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'delete_webhook',
        arguments: { project_id: 'a/b/c', hook_id: 3 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/a%2Fb%2Fc/hooks/3')
    })
  })

  // ── test_webhook ───────────────────────────────────────────────────

  describe('test_webhook', () => {
    it('sends POST to /projects/:id/hooks/:hook_id/test/:trigger', async () => {
      const testResult = { message: 'Hook executed successfully' }
      mockApi.post.mockResolvedValue(testResult)

      const result = await client.callTool({
        name: 'test_webhook',
        arguments: { project_id: '42', hook_id: 5, trigger: 'push_events' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/42/hooks/5/test/push_events',
        {},
      )
      expect(getResultText(result)).toBe(JSON.stringify(testResult, null, 2))
    })

    it('works with tag_push_events trigger', async () => {
      mockApi.post.mockResolvedValue({ message: 'ok' })

      await client.callTool({
        name: 'test_webhook',
        arguments: { project_id: '10', hook_id: 2, trigger: 'tag_push_events' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/10/hooks/2/test/tag_push_events',
        {},
      )
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({})

      await client.callTool({
        name: 'test_webhook',
        arguments: { project_id: 'org/repo', hook_id: 1, trigger: 'push_events' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/org%2Frepo/hooks/1/test/push_events',
        {},
      )
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.get.mockRejectedValue(new GitLabApiError(404, '404 Project Not Found'))

      const result = await client.callTool({
        name: 'list_webhooks',
        arguments: { project_id: '999' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 404: 404 Project Not Found')
    })

    it('returns connection error on network failure', async () => {
      mockApi.post.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({
        name: 'create_webhook',
        arguments: { project_id: '1', url: 'https://x.com' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('something broke'))

      const result = await client.callTool({
        name: 'delete_webhook',
        arguments: { project_id: '1', hook_id: 1 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: something broke')
    })

    it('returns GitLab API error on update_webhook failure', async () => {
      mockApi.put.mockRejectedValue(new GitLabApiError(403, '403 Forbidden'))

      const result = await client.callTool({
        name: 'update_webhook',
        arguments: { project_id: '1', hook_id: 5, url: 'https://new.com' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 403: 403 Forbidden')
    })

    it('returns GitLab API error on test_webhook failure', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(422, 'Hook not executable'))

      const result = await client.callTool({
        name: 'test_webhook',
        arguments: { project_id: '1', hook_id: 1, trigger: 'push_events' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 422: Hook not executable')
    })
  })

  // ── Response format ────────────────────────────────────────────────

  describe('response format', () => {
    it('returns JSON-stringified response with 2-space indent', async () => {
      const data = { id: 1, url: 'https://example.com', push_events: true }
      mockApi.get.mockResolvedValue([data])

      const result = await client.callTool({
        name: 'list_webhooks',
        arguments: { project_id: '1' },
      })

      const text = getResultText(result)
      expect(text).toBe(JSON.stringify([data], null, 2))
      // Verify it's actually indented (not compact)
      expect(text).toContain('\n')
    })

    it('delete returns { status: "success" } as JSON', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_webhook',
        arguments: { project_id: '1', hook_id: 1 },
      })

      const parsed = JSON.parse(getResultText(result))
      expect(parsed).toEqual({ status: 'success' })
    })
  })
})
