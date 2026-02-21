import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { GitLabApiClient } from '../src/gitlab-client.js'
import { registerAllTools } from '../src/tools/index.js'

function createMockClient(): GitLabApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}

describe('Server initialisation', () => {
  describe('environment variable handling', () => {
    let originalToken: string | undefined
    let originalApiUrl: string | undefined

    beforeEach(() => {
      originalToken = process.env.GITLAB_PERSONAL_ACCESS_TOKEN
      originalApiUrl = process.env.GITLAB_API_URL
    })

    afterEach(() => {
      if (originalToken !== undefined) {
        process.env.GITLAB_PERSONAL_ACCESS_TOKEN = originalToken
      } else {
        delete process.env.GITLAB_PERSONAL_ACCESS_TOKEN
      }
      if (originalApiUrl !== undefined) {
        process.env.GITLAB_API_URL = originalApiUrl
      } else {
        delete process.env.GITLAB_API_URL
      }
    })

    it('missing token produces error and exits', async () => {
      delete process.env.GITLAB_PERSONAL_ACCESS_TOKEN
      delete process.env.GITLAB_API_URL

      const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Dynamically import the entry point so env vars are read fresh.
      // main() is async so we need to let the microtask queue flush.
      await import('../src/index.js?missing-token=' + Date.now())
      await new Promise((r) => setTimeout(r, 50))

      expect(mockError).toHaveBeenCalledWith(
        'Error: GITLAB_PERSONAL_ACCESS_TOKEN environment variable is required',
      )
      expect(mockExit).toHaveBeenCalledWith(1)

      mockExit.mockRestore()
      mockError.mockRestore()
    })

    it('missing API URL defaults to https://gitlab.com/api/v4', () => {
      delete process.env.GITLAB_API_URL
      const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'
      expect(apiUrl).toBe('https://gitlab.com/api/v4')
    })

    it('provided API URL is used when set', () => {
      process.env.GITLAB_API_URL = 'https://my-gitlab.example.com/api/v4'
      const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'
      expect(apiUrl).toBe('https://my-gitlab.example.com/api/v4')
    })
  })

  describe('tool registration via registerAllTools', () => {
    let client: Client

    afterEach(async () => {
      if (client) await client.close()
    })

    it('registers all 22 tools', async () => {
      const mockApi = createMockClient()
      const server = new McpServer({ name: 'test-init', version: '0.0.0' })
      registerAllTools(server, mockApi)

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await server.connect(serverTransport)

      client = new Client({ name: 'test-client', version: '0.0.0' })
      await client.connect(clientTransport)

      const { tools } = await client.listTools()
      expect(tools).toHaveLength(22)
    })

    it('registers all expected tool names', async () => {
      const mockApi = createMockClient()
      const server = new McpServer({ name: 'test-init', version: '0.0.0' })
      registerAllTools(server, mockApi)

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await server.connect(serverTransport)

      client = new Client({ name: 'test-client', version: '0.0.0' })
      await client.connect(clientTransport)

      const { tools } = await client.listTools()
      const toolNames = tools.map((t) => t.name).sort()

      const expectedNames = [
        'create_ci_variable',
        'create_group',
        'create_pipeline_trigger',
        'create_project_access_token',
        'create_webhook',
        'delete_ci_variable',
        'delete_group',
        'delete_pipeline_trigger',
        'delete_webhook',
        'list_ci_variables',
        'list_groups',
        'list_pipeline_triggers',
        'list_project_access_tokens',
        'list_protected_branches',
        'list_webhooks',
        'protect_branch',
        'revoke_project_access_token',
        'test_webhook',
        'unprotect_branch',
        'update_ci_variable',
        'update_project_settings',
        'update_webhook',
      ].sort()

      expect(toolNames).toEqual(expectedNames)
    })

    it('each tool has a description', async () => {
      const mockApi = createMockClient()
      const server = new McpServer({ name: 'test-init', version: '0.0.0' })
      registerAllTools(server, mockApi)

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await server.connect(serverTransport)

      client = new Client({ name: 'test-client', version: '0.0.0' })
      await client.connect(clientTransport)

      const { tools } = await client.listTools()
      for (const tool of tools) {
        expect(tool.description, `${tool.name} should have a description`).toBeTruthy()
      }
    })

    it('each tool has an input schema', async () => {
      const mockApi = createMockClient()
      const server = new McpServer({ name: 'test-init', version: '0.0.0' })
      registerAllTools(server, mockApi)

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await server.connect(serverTransport)

      client = new Client({ name: 'test-client', version: '0.0.0' })
      await client.connect(clientTransport)

      const { tools } = await client.listTools()
      for (const tool of tools) {
        expect(tool.inputSchema, `${tool.name} should have an input schema`).toBeDefined()
      }
    })
  })
})
