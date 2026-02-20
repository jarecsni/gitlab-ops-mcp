import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerProjectSettingsTools } from '../../src/tools/project-settings.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'
import { GitLabApiError, GitLabConnectionError } from '../../src/errors.js'

function getResultText(result: Awaited<ReturnType<Client['callTool']>>): string {
  if ('content' in result && Array.isArray(result.content)) {
    const textItem = result.content[0]
    if (textItem && 'text' in textItem) return textItem.text
  }
  throw new Error('Unexpected result shape')
}

function createMockClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as unknown as GitLabApiClient & {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

async function setupTestHarness(mockClient: GitLabApiClient) {
  const server = new McpServer({ name: 'test-project-settings', version: '0.0.0' })
  registerProjectSettingsTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Project settings tool handlers', () => {
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


  // ── update_project_settings ────────────────────────────────────────

  describe('update_project_settings', () => {
    it('sends PUT to /projects/:id with merge_method', async () => {
      const updated = { id: 42, merge_method: 'ff' }
      mockApi.put.mockResolvedValue(updated)

      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '42', merge_method: 'ff' },
      })

      expect(mockApi.put).toHaveBeenCalledWith('/projects/42', { merge_method: 'ff' })
      expect(getResultText(result)).toBe(JSON.stringify(updated, null, 2))
    })

    it('sends PUT with squash_option', async () => {
      mockApi.put.mockResolvedValue({ id: 42, squash_option: 'always' })

      await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '42', squash_option: 'always' },
      })

      expect(mockApi.put).toHaveBeenCalledWith('/projects/42', { squash_option: 'always' })
    })

    it('sends multiple settings in one call', async () => {
      mockApi.put.mockResolvedValue({ id: 10 })

      await client.callTool({
        name: 'update_project_settings',
        arguments: {
          project_id: '10',
          merge_method: 'rebase_merge',
          squash_option: 'default_on',
          only_allow_merge_if_pipeline_succeeds: true,
          remove_source_branch_after_merge: true,
        },
      })

      expect(mockApi.put).toHaveBeenCalledWith('/projects/10', {
        merge_method: 'rebase_merge',
        squash_option: 'default_on',
        only_allow_merge_if_pipeline_succeeds: true,
        remove_source_branch_after_merge: true,
      })
    })

    it('only sends provided fields in body', async () => {
      mockApi.put.mockResolvedValue({ id: 5 })

      await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '5', auto_devops_enabled: false },
      })

      const [, body] = mockApi.put.mock.calls[0]
      expect(body).toEqual({ auto_devops_enabled: false })
      expect(body).not.toHaveProperty('merge_method')
      expect(body).not.toHaveProperty('squash_option')
      expect(body).not.toHaveProperty('only_allow_merge_if_pipeline_succeeds')
      expect(body).not.toHaveProperty('remove_source_branch_after_merge')
      expect(body).not.toHaveProperty('shared_runners_enabled')
      expect(body).not.toHaveProperty('container_registry_enabled')
    })

    it('encodes project_id with slashes', async () => {
      mockApi.put.mockResolvedValue({ id: 1 })

      await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: 'org/team/repo', merge_method: 'merge' },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/org%2Fteam%2Frepo',
        { merge_method: 'merge' },
      )
    })

    it('accepts all valid merge_method values', async () => {
      for (const method of ['merge', 'rebase_merge', 'ff']) {
        mockApi.put.mockResolvedValue({ merge_method: method })

        const result = await client.callTool({
          name: 'update_project_settings',
          arguments: { project_id: '1', merge_method: method },
        })

        expect(result.isError).toBeFalsy()
      }
    })

    it('accepts all valid squash_option values', async () => {
      for (const option of ['default_off', 'default_on', 'always', 'never']) {
        mockApi.put.mockResolvedValue({ squash_option: option })

        const result = await client.callTool({
          name: 'update_project_settings',
          arguments: { project_id: '1', squash_option: option },
        })

        expect(result.isError).toBeFalsy()
      }
    })
  })

  // ── Enum validation ────────────────────────────────────────────────

  describe('enum validation', () => {
    it('rejects invalid merge_method value', async () => {
      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '1', merge_method: 'squash_merge' },
      })

      expect(result.isError).toBe(true)
    })

    it('rejects invalid squash_option value', async () => {
      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '1', squash_option: 'sometimes' },
      })

      expect(result.isError).toBe(true)
    })

    it('does not call API when enum validation fails', async () => {
      await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '1', merge_method: 'invalid' },
      })

      expect(mockApi.put).not.toHaveBeenCalled()
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.put.mockRejectedValue(new GitLabApiError(403, '403 Forbidden'))

      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '42', merge_method: 'ff' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 403: 403 Forbidden')
    })

    it('returns connection error on network failure', async () => {
      mockApi.put.mockRejectedValue(new GitLabConnectionError(new Error('ETIMEDOUT')))

      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '1', squash_option: 'always' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.put.mockRejectedValue(new Error('out of memory'))

      const result = await client.callTool({
        name: 'update_project_settings',
        arguments: { project_id: '1', merge_method: 'merge' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: out of memory')
    })
  })
})
