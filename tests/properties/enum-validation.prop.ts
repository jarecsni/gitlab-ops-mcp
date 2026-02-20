import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import fc from 'fast-check'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools } from '../../src/tools/index.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'

/**
 * Feature: gitlab-ops-mcp-server, Property 4: Enum parameter validation
 *
 * For any tool with enum-constrained parameters and for any string value not
 * in the allowed set, invoking the tool with that invalid enum value SHALL
 * produce a validation error, and SHALL NOT make any request to the GitLab_API.
 *
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 */

interface EnumSpec {
  toolName: string
  paramName: string
  allowedValues: string[]
  /** Required params (besides the enum) needed to make a valid-ish call */
  requiredArgs: Record<string, unknown>
}

const ENUM_SPECS: EnumSpec[] = [
  {
    toolName: 'create_ci_variable',
    paramName: 'variable_type',
    allowedValues: ['env_var', 'file'],
    requiredArgs: { project_id: 'proj-1', key: 'MY_KEY', value: 'my_value' },
  },
  {
    toolName: 'create_group',
    paramName: 'visibility',
    allowedValues: ['private', 'internal', 'public'],
    requiredArgs: { name: 'test-group', path: 'test-group' },
  },
  {
    toolName: 'update_project_settings',
    paramName: 'merge_method',
    allowedValues: ['merge', 'rebase_merge', 'ff'],
    requiredArgs: { project_id: 'proj-1' },
  },
  {
    toolName: 'update_project_settings',
    paramName: 'squash_option',
    allowedValues: ['default_off', 'default_on', 'always', 'never'],
    requiredArgs: { project_id: 'proj-1' },
  },
]

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
  const server = new McpServer({ name: 'test-enum-validation', version: '0.0.0' })
  registerAllTools(server, mockClient)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-enum-validation-client', version: '0.0.0' })
  await client.connect(clientTransport)
  return { server, client }
}

/**
 * Arbitrary that generates strings guaranteed NOT to be in the allowed set.
 * Uses fc.string() filtered to exclude valid enum values.
 */
function arbInvalidEnum(allowedValues: string[]): fc.Arbitrary<string> {
  return fc.string().filter((s) => !allowedValues.includes(s))
}

const NUM_RUNS = 100

// --- Tests ---

describe('Feature: gitlab-ops-mcp-server, Property 4: Enum parameter validation', () => {
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

  for (const spec of ENUM_SPECS) {
    it(`${spec.toolName}: invalid "${spec.paramName}" returns error and makes no API call`, async () => {
      await fc.assert(
        fc.asyncProperty(
          arbInvalidEnum(spec.allowedValues),
          async (invalidValue) => {
            mockApi.get.mockClear()
            mockApi.post.mockClear()
            mockApi.put.mockClear()
            mockApi.delete.mockClear()

            const args = { ...spec.requiredArgs, [spec.paramName]: invalidValue }
            const result = await client.callTool({ name: spec.toolName, arguments: args })

            // Zod enum validation at the MCP SDK level should reject the invalid value
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
})
