import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools } from '../../src/tools/index.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'
import { GitLabApiError } from '../../src/errors.js'

/**
 * Feature: gitlab-ops-mcp-server, Property 5: HTTP error propagation
 *
 * For any tool invocation where the GitLab_API returns a non-2xx HTTP status,
 * the Tool_Handler SHALL return an MCP error response containing both the HTTP
 * status code and the error message from the response body.
 *
 * Validates: Requirements 9.1
 */

const NUM_RUNS = 100

const arbHttpErrorStatus = fc.integer({ min: 400, max: 599 })
const arbErrorMessage = fc.string({ minLength: 1, maxLength: 80 })

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

async function setupHarness(mockClient: GitLabApiClient) {
  const server = new McpServer({ name: 'test-error-prop', version: '0.0.0' })
  registerAllTools(server, mockClient)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-error-prop-client', version: '0.0.0' })
  await client.connect(clientTransport)
  return { server, client }
}

describe('Feature: gitlab-ops-mcp-server, Property 5: HTTP error propagation', () => {
  let mockApi: ReturnType<typeof createMockClient>
  let client: Client

  beforeAll(async () => {
    mockApi = createMockClient()
    const harness = await setupHarness(mockApi)
    client = harness.client
  })

  afterAll(async () => {
    await client.close()
  })

  function configureAllMethodsToThrow(statusCode: number, message: string) {
    const error = new GitLabApiError(statusCode, message)
    mockApi.get.mockRejectedValue(error)
    mockApi.post.mockRejectedValue(error)
    mockApi.put.mockRejectedValue(error)
    mockApi.delete.mockRejectedValue(error)
  }

  /**
   * Validates: Requirements 9.1
   */
  it('GET tool (list_webhooks) propagates HTTP error status and message', async () => {
    await fc.assert(
      fc.asyncProperty(arbHttpErrorStatus, arbErrorMessage, async (statusCode, message) => {
        configureAllMethodsToThrow(statusCode, message)

        const result = await client.callTool({
          name: 'list_webhooks',
          arguments: { project_id: 'test' },
        })

        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ type: string; text: string }>)[0].text
        expect(text).toContain(String(statusCode))
        expect(text).toContain(message)
        expect(text).toBe(`GitLab API error ${statusCode}: ${message}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('POST tool (create_webhook) propagates HTTP error status and message', async () => {
    await fc.assert(
      fc.asyncProperty(arbHttpErrorStatus, arbErrorMessage, async (statusCode, message) => {
        configureAllMethodsToThrow(statusCode, message)

        const result = await client.callTool({
          name: 'create_webhook',
          arguments: { project_id: 'test', url: 'https://example.com' },
        })

        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ type: string; text: string }>)[0].text
        expect(text).toBe(`GitLab API error ${statusCode}: ${message}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('PUT tool (update_webhook) propagates HTTP error status and message', async () => {
    await fc.assert(
      fc.asyncProperty(arbHttpErrorStatus, arbErrorMessage, async (statusCode, message) => {
        configureAllMethodsToThrow(statusCode, message)

        const result = await client.callTool({
          name: 'update_webhook',
          arguments: { project_id: 'test', hook_id: 1 },
        })

        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ type: string; text: string }>)[0].text
        expect(text).toBe(`GitLab API error ${statusCode}: ${message}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('DELETE tool (delete_webhook) propagates HTTP error status and message', async () => {
    await fc.assert(
      fc.asyncProperty(arbHttpErrorStatus, arbErrorMessage, async (statusCode, message) => {
        configureAllMethodsToThrow(statusCode, message)

        const result = await client.callTool({
          name: 'delete_webhook',
          arguments: { project_id: 'test', hook_id: 1 },
        })

        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ type: string; text: string }>)[0].text
        expect(text).toBe(`GitLab API error ${statusCode}: ${message}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
