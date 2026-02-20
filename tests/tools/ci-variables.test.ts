import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerCiVariableTools } from '../../src/tools/ci-variables.js'
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
  const server = new McpServer({ name: 'test-ci-variables', version: '0.0.0' })
  registerCiVariableTools(server, mockClient)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await client.connect(clientTransport)

  return { server, client }
}

describe('CI variable tool handlers', () => {
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

  // ── list_ci_variables ──────────────────────────────────────────────

  describe('list_ci_variables', () => {
    it('sends GET to /projects/:id/variables', async () => {
      const vars = [{ key: 'API_KEY', value: 'secret', variable_type: 'env_var' }]
      mockApi.get.mockResolvedValue(vars)

      const result = await client.callTool({ name: 'list_ci_variables', arguments: { project_id: '42' } })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/42/variables')
      expect(getResultText(result)).toBe(JSON.stringify(vars, null, 2))
    })

    it('encodes project_id with slashes', async () => {
      mockApi.get.mockResolvedValue([])

      await client.callTool({ name: 'list_ci_variables', arguments: { project_id: 'my-group/my-project' } })

      expect(mockApi.get).toHaveBeenCalledWith('/projects/my-group%2Fmy-project/variables')
    })
  })

  // ── create_ci_variable ─────────────────────────────────────────────

  describe('create_ci_variable', () => {
    it('sends POST to /projects/:id/variables with key and value', async () => {
      const created = { key: 'DB_HOST', value: 'localhost', variable_type: 'env_var' }
      mockApi.post.mockResolvedValue(created)

      const result = await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '99', key: 'DB_HOST', value: 'localhost' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/99/variables',
        { key: 'DB_HOST', value: 'localhost' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(created, null, 2))
    })

    it('includes optional flags in the body', async () => {
      mockApi.post.mockResolvedValue({ key: 'SECRET' })

      await client.callTool({
        name: 'create_ci_variable',
        arguments: {
          project_id: '5',
          key: 'SECRET',
          value: 'hunter2',
          protected: true,
          masked: true,
          environment_scope: 'production',
          variable_type: 'env_var',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/5/variables',
        {
          key: 'SECRET',
          value: 'hunter2',
          protected: true,
          masked: true,
          environment_scope: 'production',
          variable_type: 'env_var',
        },
      )
    })

    it('includes variable_type file when specified', async () => {
      mockApi.post.mockResolvedValue({ key: 'CERT' })

      await client.callTool({
        name: 'create_ci_variable',
        arguments: {
          project_id: '7',
          key: 'CERT',
          value: '-----BEGIN CERTIFICATE-----',
          variable_type: 'file',
        },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/7/variables',
        { key: 'CERT', value: '-----BEGIN CERTIFICATE-----', variable_type: 'file' },
      )
    })

    it('omits undefined optional fields from body', async () => {
      mockApi.post.mockResolvedValue({ key: 'MINIMAL' })

      await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '1', key: 'MINIMAL', value: 'val' },
      })

      const [, body] = mockApi.post.mock.calls[0]
      expect(body).toEqual({ key: 'MINIMAL', value: 'val' })
      expect(body).not.toHaveProperty('protected')
      expect(body).not.toHaveProperty('masked')
      expect(body).not.toHaveProperty('environment_scope')
      expect(body).not.toHaveProperty('variable_type')
    })

    it('encodes project_id with slashes', async () => {
      mockApi.post.mockResolvedValue({ key: 'K' })

      await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: 'team/repo', key: 'K', value: 'V' },
      })

      expect(mockApi.post).toHaveBeenCalledWith(
        '/projects/team%2Frepo/variables',
        { key: 'K', value: 'V' },
      )
    })
  })

  // ── update_ci_variable ─────────────────────────────────────────────

  describe('update_ci_variable', () => {
    it('sends PUT to /projects/:id/variables/:key', async () => {
      const updated = { key: 'DB_HOST', value: 'new-host', variable_type: 'env_var' }
      mockApi.put.mockResolvedValue(updated)

      const result = await client.callTool({
        name: 'update_ci_variable',
        arguments: { project_id: '42', key: 'DB_HOST', value: 'new-host' },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/42/variables/DB_HOST',
        { value: 'new-host' },
      )
      expect(getResultText(result)).toBe(JSON.stringify(updated, null, 2))
    })

    it('includes optional fields in body', async () => {
      mockApi.put.mockResolvedValue({ key: 'K' })

      await client.callTool({
        name: 'update_ci_variable',
        arguments: {
          project_id: '42',
          key: 'K',
          value: 'new-val',
          protected: false,
          masked: true,
          variable_type: 'file',
        },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/42/variables/K',
        { value: 'new-val', protected: false, masked: true, variable_type: 'file' },
      )
    })

    it('URL-encodes the key in the path', async () => {
      mockApi.put.mockResolvedValue({ key: 'MY.VAR' })

      await client.callTool({
        name: 'update_ci_variable',
        arguments: { project_id: '10', key: 'MY.VAR', value: 'updated' },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/10/variables/MY.VAR',
        { value: 'updated' },
      )
    })

    it('encodes project_id with slashes', async () => {
      mockApi.put.mockResolvedValue({ key: 'X' })

      await client.callTool({
        name: 'update_ci_variable',
        arguments: { project_id: 'ns/proj', key: 'X', value: 'v' },
      })

      expect(mockApi.put).toHaveBeenCalledWith(
        '/projects/ns%2Fproj/variables/X',
        { value: 'v' },
      )
    })
  })

  // ── delete_ci_variable ─────────────────────────────────────────────

  describe('delete_ci_variable', () => {
    it('sends DELETE to /projects/:id/variables/:key', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_ci_variable',
        arguments: { project_id: '42', key: 'OLD_VAR' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/42/variables/OLD_VAR')
      expect(JSON.parse(getResultText(result))).toEqual({ status: 'success' })
    })

    it('URL-encodes the key in the path', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'delete_ci_variable',
        arguments: { project_id: '10', key: 'MY.VAR' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/10/variables/MY.VAR')
    })

    it('encodes project_id with slashes', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      await client.callTool({
        name: 'delete_ci_variable',
        arguments: { project_id: 'a/b/c', key: 'K' },
      })

      expect(mockApi.delete).toHaveBeenCalledWith('/projects/a%2Fb%2Fc/variables/K')
    })
  })

  // ── variable_type enum validation ──────────────────────────────────

  describe('variable_type enum validation', () => {
    it('rejects invalid variable_type on create', async () => {
      const result = await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V', variable_type: 'invalid_type' },
      })

      // Zod schema rejects before handler runs — MCP SDK returns an error
      expect(result.isError).toBe(true)
      expect(mockApi.post).not.toHaveBeenCalled()
    })

    it('rejects invalid variable_type on update', async () => {
      const result = await client.callTool({
        name: 'update_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V', variable_type: 'bogus' },
      })

      expect(result.isError).toBe(true)
      expect(mockApi.put).not.toHaveBeenCalled()
    })

    it('accepts env_var as valid variable_type', async () => {
      mockApi.post.mockResolvedValue({ key: 'K' })

      const result = await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V', variable_type: 'env_var' },
      })

      expect(result.isError).toBeFalsy()
      expect(mockApi.post).toHaveBeenCalled()
    })

    it('accepts file as valid variable_type', async () => {
      mockApi.post.mockResolvedValue({ key: 'K' })

      const result = await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V', variable_type: 'file' },
      })

      expect(result.isError).toBeFalsy()
      expect(mockApi.post).toHaveBeenCalled()
    })
  })

  // ── Error handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns GitLab API error with status and message', async () => {
      mockApi.get.mockRejectedValue(new GitLabApiError(404, '404 Project Not Found'))

      const result = await client.callTool({
        name: 'list_ci_variables',
        arguments: { project_id: '999' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 404: 404 Project Not Found')
    })

    it('returns connection error on network failure', async () => {
      mockApi.post.mockRejectedValue(new GitLabConnectionError(new Error('ECONNREFUSED')))

      const result = await client.callTool({
        name: 'create_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('GitLab connection error')
    })

    it('returns unexpected error for unknown exceptions', async () => {
      mockApi.delete.mockRejectedValue(new Error('something broke'))

      const result = await client.callTool({
        name: 'delete_ci_variable',
        arguments: { project_id: '1', key: 'K' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toContain('Unexpected error: something broke')
    })

    it('returns GitLab API error on update failure', async () => {
      mockApi.put.mockRejectedValue(new GitLabApiError(403, '403 Forbidden'))

      const result = await client.callTool({
        name: 'update_ci_variable',
        arguments: { project_id: '1', key: 'K', value: 'V' },
      })

      expect(result.isError).toBe(true)
      expect(getResultText(result)).toBe('GitLab API error 403: 403 Forbidden')
    })
  })

  // ── Response format ────────────────────────────────────────────────

  describe('response format', () => {
    it('returns JSON-stringified response with 2-space indent', async () => {
      const data = { key: 'API_KEY', value: 'secret', protected: true }
      mockApi.get.mockResolvedValue([data])

      const result = await client.callTool({
        name: 'list_ci_variables',
        arguments: { project_id: '1' },
      })

      const text = getResultText(result)
      expect(text).toBe(JSON.stringify([data], null, 2))
      expect(text).toContain('\n')
    })

    it('delete returns { status: "success" } as JSON', async () => {
      mockApi.delete.mockResolvedValue(undefined)

      const result = await client.callTool({
        name: 'delete_ci_variable',
        arguments: { project_id: '1', key: 'K' },
      })

      const parsed = JSON.parse(getResultText(result))
      expect(parsed).toEqual({ status: 'success' })
    })
  })
})
