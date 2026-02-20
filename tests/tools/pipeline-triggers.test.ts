import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerPipelineTriggerTools } from '../../src/tools/pipeline-triggers.js'
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
  const server = new McpServer({ name: 'test-pipeline-triggers', version: '0.0.0' })
  registerPipelineTriggerTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Pipeline trigger tool handlers', () => {
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


  // ── create_pipeline_trigger ────────────────────────────────────────

  describe('create_pipeline_trigger', () => {
    it('sends POST to /projects/:id/triggers with description', async () => {
      const created = { id: 1, token: 'trigger-token-abc', description: 'CI trigger' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_pipeline_trigger',
        arguments: { project_id: '42', description: 'CI trigger' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/42/triggers',
        { description: 'CI trigger' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({ id: 2 })

      await client.callTool({
        name: 'create_pipeline_trigger',
        arguments: { project_id: 'org/repo', description: 'cross-project' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/org%2Frepo/triggers',
        { description: 'cross-project' },
      )
    })

    it('encodes project_id with special characters', async () => {
      mockApi.post.mockResolvedValue({ id: 3 })

      await client.callTool({
        name: 'create_pipeline_trigger',
        arguments: { project_id: 'org/sub group/repo', description: 'test' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/org%2Fsub%20group%2Frepo/triggers',
        { description: 'test' },
      )
    })
  })

  // ── list_pipeline_triggers ─────────────────────────────────────────

  describe('list_pipeline_triggers', () => {
    it('sends GET to /projects/:id/triggers', async () => {
      const triggers = [{ id: 1, description: 'trigger-a' }, { id: 2, description: 'trigger-b' }]
      mockApi.get.mockResolvedValue(triggers)

      const result = await client.callTool({
        name: 'list_pipeline_triggers',
        arguments: { project_id: '42' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/42/triggers')
      expect(getResultText(result)).toBe(JSON.stringify(triggers, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({
        name: 'list_pipeline_triggers',
        arguments: { project_id: 'team/project' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/team%2Fproject/triggers')
    })
  })

  // ── delete_pipeline_trigger ────────────────────────────────────────

  describe('delete_pipeline_trigger', () => {
    it('sends DELETE to /projects/:id/triggers/:trigger_id', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_pipeline_trigger',
        arguments: { project_id: '42', trigger_id: 5 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/triggers/5')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })

    it('encodes project_id with slashes', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'delete_pipeline_trigger',
        arguments: { project_id: 'a/b/c', trigger_id: 9 },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/a%2Fb%2Fc/triggers/9')
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.post.mockRejectedValue(new GitLabApiError(404, '404 Project Not Found'))

      const result = await client.callTool({
        name: 'create_pipeline_trigger',
        arguments: { project_id: '999', description: 'fail' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 404: 404 Project Not Found')
    })

    it('returns connection error on network failure', async () => {
      mockApi.get.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({
        name: 'list_pipeline_triggers',
        arguments: { project_id: '1' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('oops'))

      const result = await client.callTool({
        name: 'delete_pipeline_trigger',
        arguments: { project_id: '1', trigger_id: 1 },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: oops')
    })
  })

  // ── Response format ────────────────────────────────────────────────

  describe('response format', () => {
    it('returns JSON-stringified response with 2-space indent', async () => {
      const data = { id: 1, token: 'abc123', description: 'deploy trigger' }
      mockApi.post.mockResolvedValue(data)

      const result = await client.callTool({
        name: 'create_pipeline_trigger',
        arguments: { project_id: '1', description: 'deploy trigger' },
      })

      const text = getResultText(result)
      expect(text).toBe(JSON.stringify(data, null, 2))
      expect(text).toContain('\n')
    })

    it('delete returns { status: "success" } as JSON', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_pipeline_trigger',
        arguments: { project_id: '1', trigger_id: 1 },
      })

      const parsed = JSON.parse(getResultText(result))
      expect(parsed).toEqual({ status: 'success' })
    })
  })
})
