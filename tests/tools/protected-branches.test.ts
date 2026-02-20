import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerProtectedBranchTools } from '../../src/tools/protected-branches.js'
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
  const server = new McpServer({ name: 'test-protected-branches', version: '0.0.0' })
  registerProtectedBranchTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('Protected branch tool handlers', () => {
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


  // ── protect_branch ─────────────────────────────────────────────────

  describe('protect_branch', () => {
    it('sends POST to /projects/:id/protected_branches with name', async () => {
      const created = { name: 'main', push_access_levels: [], merge_access_levels: [] }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'protect_branch',
        arguments: { project_id: '42', name: 'main' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/42/protected_branches',
        { name: 'main' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('includes optional access levels in body', async () => {
      mockApi.post.mockResolvedValue({ name: 'develop' })

      await client.callTool({
        name: 'protect_branch',
        arguments: {
          project_id: '10',
          name: 'develop',
          push_access_level: 30,
          merge_access_level: 40,
          allow_force_push: false,
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/10/protected_branches',
        {
          name: 'develop',
          push_access_level: 30,
          merge_access_level: 40,
          allow_force_push: false,
        },
      )
    })

    it('omits undefined optional fields from body', async () => {
      mockApi.post.mockResolvedValue({ name: 'main' })

      await client.callTool({
        name: 'protect_branch',
        arguments: { project_id: '1', name: 'main' },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body).toEqual({ name: 'main' })
      expect(body).not.toHaveProperty('push_access_level')
      expect(body).not.toHaveProperty('merge_access_level')
      expect(body).not.toHaveProperty('allow_force_push')
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({ name: 'main' })

      await client.callTool({
        name: 'protect_branch',
        arguments: { project_id: 'my-group/my-project', name: 'main' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/my-group%2Fmy-project/protected_branches',
        { name: 'main' },
      )
    })
  })

  // ── list_protected_branches ────────────────────────────────────────

  describe('list_protected_branches', () => {
    it('sends GET to /projects/:id/protected_branches', async () => {
      const branches = [{ name: 'main' }, { name: 'release/*' }]
      mockApi.get.mockResolvedValue(branches)

      const result = await client.callTool({
        name: 'list_protected_branches',
        arguments: { project_id: '42' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/42/protected_branches')
      expect(getResultText(result)).toBe(JSON.stringify(branches, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({
        name: 'list_protected_branches',
        arguments: { project_id: 'org/sub-group/repo' },
      })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/org%2Fsub-group%2Frepo/protected_branches')
    })
  })

  // ── unprotect_branch ───────────────────────────────────────────────

  describe('unprotect_branch', () => {
    it('sends DELETE to /projects/:id/protected_branches/:name', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'unprotect_branch',
        arguments: { project_id: '42', name: 'main' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/protected_branches/main')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })

    it('URL-encodes branch names with special characters', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'unprotect_branch',
        arguments: { project_id: '42', name: 'feature/*' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/protected_branches/feature%2F*')
    })

    it('URL-encodes branch names with slashes', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'unprotect_branch',
        arguments: { project_id: '5', name: 'release/1.0' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/5/protected_branches/release%2F1.0')
    })

    it('encodes both project_id and branch name', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'unprotect_branch',
        arguments: { project_id: 'team/repo', name: 'hotfix/urgent-fix' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith(
        '/projects/team%2Frepo/protected_branches/hotfix%2Furgent-fix',
      )
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.get.mockRejectedValue(new GitLabApiError(404, '404 Project Not Found'))

      const result = await client.callTool({
        name: 'list_protected_branches',
        arguments: { project_id: '999' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 404: 404 Project Not Found')
    })

    it('returns connection error on network failure', async () => {
      mockApi.post.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({
        name: 'protect_branch',
        arguments: { project_id: '1', name: 'main' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('disk full'))

      const result = await client.callTool({
        name: 'unprotect_branch',
        arguments: { project_id: '1', name: 'main' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: disk full')
    })
  })
})
