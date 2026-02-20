import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fc from 'fast-check'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools } from '../../src/tools/index.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'

/**
 * Feature: gitlab-ops-mcp-server, Property 3: Required parameter validation
 *
 * For any tool and for any required parameter of that tool, invoking the tool
 * with that parameter missing SHALL produce a validation error, and SHALL NOT
 * make any request to the GitLab_API.
 *
 * Validates: Requirements 9.2, 10.1
 */

// --- Arbitraries for generating valid filler values by Zod type ---

const arbString = fc.stringMatching(/^[a-z0-9_-]{1,20}$/)
const arbNumber = fc.integer({ min: 1, max: 999999 })
const arbStringArray = fc.array(fc.constantFrom('api', 'read_api', 'read_repository'), { minLength: 1, maxLength: 3 })

type ParamType = 'string' | 'number' | 'string[]'

interface ToolSpec {
  name: string
  requiredParams: Record<string, ParamType>
}

/**
 * Complete catalogue of tools and their required parameters, derived from
 * the Zod schemas in src/tools/*.ts. Each param is tagged with its Zod type
 * so we can generate appropriate random filler values.
 *
 * list_groups is excluded — it has no required params.
 */
const TOOL_SPECS: ToolSpec[] = [
  // Webhooks
  { name: 'create_webhook', requiredParams: { project_id: 'string', url: 'string' } },
  { name: 'list_webhooks', requiredParams: { project_id: 'string' } },
  { name: 'update_webhook', requiredParams: { project_id: 'string', hook_id: 'number' } },
  { name: 'delete_webhook', requiredParams: { project_id: 'string', hook_id: 'number' } },
  { name: 'test_webhook', requiredParams: { project_id: 'string', hook_id: 'number', trigger: 'string' } },
  // CI Variables
  { name: 'create_ci_variable', requiredParams: { project_id: 'string', key: 'string', value: 'string' } },
  { name: 'list_ci_variables', requiredParams: { project_id: 'string' } },
  { name: 'update_ci_variable', requiredParams: { project_id: 'string', key: 'string', value: 'string' } },
  { name: 'delete_ci_variable', requiredParams: { project_id: 'string', key: 'string' } },
  // Protected Branches
  { name: 'protect_branch', requiredParams: { project_id: 'string', name: 'string' } },
  { name: 'list_protected_branches', requiredParams: { project_id: 'string' } },
  { name: 'unprotect_branch', requiredParams: { project_id: 'string', name: 'string' } },
  // Project Settings
  { name: 'update_project_settings', requiredParams: { project_id: 'string' } },
  // Groups
  { name: 'create_group', requiredParams: { name: 'string', path: 'string' } },
  { name: 'delete_group', requiredParams: { group_id: 'number' } },
  // Access Tokens
  { name: 'create_project_access_token', requiredParams: { project_id: 'string', name: 'string', scopes: 'string[]', access_level: 'number', expires_at: 'string' } },
  { name: 'list_project_access_tokens', requiredParams: { project_id: 'string' } },
  { name: 'revoke_project_access_token', requiredParams: { project_id: 'string', token_id: 'number' } },
  // Pipeline Triggers
  { name: 'create_pipeline_trigger', requiredParams: { project_id: 'string', description: 'string' } },
  { name: 'list_pipeline_triggers', requiredParams: { project_id: 'string' } },
  { name: 'delete_pipeline_trigger', requiredParams: { project_id: 'string', trigger_id: 'number' } },
]

// --- Arbitrary that generates a valid value for a given param type ---

function arbForType(type: ParamType): fc.Arbitrary<unknown> {
  switch (type) {
    case 'string': return arbString
    case 'number': return arbNumber
    case 'string[]': return arbStringArray
  }
}

/**
 * Build an arbitrary that generates a full set of valid args for a tool,
 * but with one specific required param omitted.
 */
function arbArgsWithout(spec: ToolSpec, omitParam: string): fc.Arbitrary<Record<string, unknown>> {
  const entries = Object.entries(spec.requiredParams).filter(([k]) => k !== omitParam)
  if (entries.length === 0) {
    return fc.constant({})
  }
  const arbs = entries.map(([, type]) => arbForType(type))
  return fc.tuple(...(arbs as [fc.Arbitrary<unknown>, ...fc.Arbitrary<unknown>[]])).map((values) => {
    const args: Record<string, unknown> = {}
    entries.forEach(([key], i) => {
      args[key] = values[i]
    })
    return args
  })
}

// --- Harness ---

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ mocked: true }),
    post: vi.fn().mockResolvedValue({ mocked: true }),
    put: vi.fn().mockResolvedValue({ mocked: true }),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as GitLabApiClient & {
    get: ReturnType<typeof vi.fn>
    post: ReturnType<typeof vi.fn>
    put: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

async function setupHarness(mockClient: GitLabApiClient) {
  const server = new McpServer({ name: 'test-required-params', version: '0.0.0' })
  registerAllTools(server, mockClient)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-required-params-client', version: '0.0.0' })
  await client.connect(clientTransport)
  return { server, client }
}

const NUM_RUNS = 100

// --- Tests ---

describe('Feature: gitlab-ops-mcp-server, Property 3: Required parameter validation', () => {
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

  afterEach(() => {
    mockApi.get.mockClear()
    mockApi.post.mockClear()
    mockApi.put.mockClear()
    mockApi.delete.mockClear()
  })

  for (const spec of TOOL_SPECS) {
    const paramNames = Object.keys(spec.requiredParams)

    for (const omitParam of paramNames) {
      it(`${spec.name}: omitting "${omitParam}" returns error and makes no API call`, async () => {
        await fc.assert(
          fc.asyncProperty(
            arbArgsWithout(spec, omitParam),
            async (args) => {
              mockApi.get.mockClear()
              mockApi.post.mockClear()
              mockApi.put.mockClear()
              mockApi.delete.mockClear()

              const result = await client.callTool({ name: spec.name, arguments: args })

              // MCP SDK returns isError when Zod validation fails on missing required param
              expect(result.isError).toBe(true)

              // No API calls should have been made
              expect(mockApi.get).not.toHaveBeenCalled()
              expect(mockApi.post).not.toHaveBeenCalled()
              expect(mockApi.put).not.toHaveBeenCalled()
              expect(mockApi.delete).not.toHaveBeenCalled()
            },
          ),
          { numRuns: NUM_RUNS },
        )
      })
    }
  }
})
