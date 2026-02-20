import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fc from 'fast-check'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { registerAllTools } from '../../src/tools/index.js'
import { GitLabApiClient } from '../../src/gitlab-client.js'

/**
 * Feature: gitlab-ops-mcp-server, Property 1: Tool-to-API request mapping
 *
 * For any tool invocation with valid inputs, the Tool_Handler SHALL send a request
 * using the correct HTTP method to the correct GitLab API path, with the correct
 * request body constructed from the tool's input parameters.
 *
 * Validates: Requirements 2.1-2.5, 3.1-3.4, 4.1-4.3, 5.1, 6.1-6.3, 7.1-7.3, 8.1-8.3
 */

// --- Shared arbitraries ---

const arbSimpleId = fc.stringMatching(/^[a-z0-9_-]{1,20}$/)

const arbProjectId = fc.oneof(
  arbSimpleId,
  fc.tuple(arbSimpleId, arbSimpleId).map(([a, b]) => `${a}/${b}`),
)

const arbPositiveInt = fc.integer({ min: 1, max: 999999 })
const arbNonEmptyString = fc.stringMatching(/^[a-z0-9_-]{1,30}$/)
const arbOptionalBool = fc.option(fc.boolean(), { nil: undefined })

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
  const server = new McpServer({ name: 'test-prop', version: '0.0.0' })
  registerAllTools(server, mockClient)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-prop-client', version: '0.0.0' })
  await client.connect(clientTransport)
  return { server, client }
}

const NUM_RUNS = 100


describe('Feature: gitlab-ops-mcp-server, Property 1: Tool-to-API request mapping', () => {
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

  function resetMocks() {
    mockApi.get.mockClear()
    mockApi.post.mockClear()
    mockApi.put.mockClear()
    mockApi.delete.mockClear()
  }

  // ── Webhooks (Req 2.1-2.5) ──

  it('create_webhook: POST /projects/:id/hooks with body', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbNonEmptyString,
        arbOptionalBool,
        arbOptionalBool,
        async (projectId, url, pushEvents, tagPushEvents) => {
          resetMocks()
          const args: Record<string, unknown> = { project_id: projectId, url }
          const expectedBody: Record<string, unknown> = { url }
          if (pushEvents !== undefined) { args.push_events = pushEvents; expectedBody.push_events = pushEvents }
          if (tagPushEvents !== undefined) { args.tag_push_events = tagPushEvents; expectedBody.tag_push_events = tagPushEvents }

          await client.callTool({ name: 'create_webhook', arguments: args })

          expect(mockApi.post).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/hooks`,
            expect.objectContaining(expectedBody),
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_webhooks: GET /projects/:id/hooks', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, async (projectId) => {
        resetMocks()
        await client.callTool({ name: 'list_webhooks', arguments: { project_id: projectId } })
        expect(mockApi.get).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/hooks`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('update_webhook: PUT /projects/:id/hooks/:hook_id', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbPositiveInt,
        arbOptionalBool,
        async (projectId, hookId, pushEvents) => {
          resetMocks()
          const args: Record<string, unknown> = { project_id: projectId, hook_id: hookId }
          if (pushEvents !== undefined) args.push_events = pushEvents

          await client.callTool({ name: 'update_webhook', arguments: args })

          expect(mockApi.put).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/hooks/${hookId}`,
            expect.any(Object),
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('delete_webhook: DELETE /projects/:id/hooks/:hook_id', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbPositiveInt, async (projectId, hookId) => {
        resetMocks()
        await client.callTool({ name: 'delete_webhook', arguments: { project_id: projectId, hook_id: hookId } })
        expect(mockApi.delete).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/hooks/${hookId}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('test_webhook: POST /projects/:id/hooks/:hook_id/test/:trigger', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbPositiveInt, arbNonEmptyString, async (projectId, hookId, trigger) => {
        resetMocks()
        await client.callTool({ name: 'test_webhook', arguments: { project_id: projectId, hook_id: hookId, trigger } })
        expect(mockApi.post).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/hooks/${hookId}/test/${trigger}`,
          {},
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })


  // ── CI Variables (Req 3.1-3.4) ──

  it('create_ci_variable: POST /projects/:id/variables with body', async () => {
    const arbVarType = fc.option(fc.constantFrom('env_var' as const, 'file' as const), { nil: undefined })
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbNonEmptyString,
        arbNonEmptyString,
        arbOptionalBool,
        arbVarType,
        async (projectId, key, value, isProtected, variableType) => {
          resetMocks()
          const args: Record<string, unknown> = { project_id: projectId, key, value }
          const expectedBody: Record<string, unknown> = { key, value }
          if (isProtected !== undefined) { args.protected = isProtected; expectedBody.protected = isProtected }
          if (variableType !== undefined) { args.variable_type = variableType; expectedBody.variable_type = variableType }

          await client.callTool({ name: 'create_ci_variable', arguments: args })

          expect(mockApi.post).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/variables`,
            expect.objectContaining(expectedBody),
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_ci_variables: GET /projects/:id/variables', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, async (projectId) => {
        resetMocks()
        await client.callTool({ name: 'list_ci_variables', arguments: { project_id: projectId } })
        expect(mockApi.get).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/variables`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('update_ci_variable: PUT /projects/:id/variables/:key with body', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbNonEmptyString,
        arbNonEmptyString,
        async (projectId, key, value) => {
          resetMocks()
          await client.callTool({ name: 'update_ci_variable', arguments: { project_id: projectId, key, value } })
          expect(mockApi.put).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/variables/${encodeURIComponent(key)}`,
            expect.objectContaining({ value }),
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('delete_ci_variable: DELETE /projects/:id/variables/:key', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbNonEmptyString, async (projectId, key) => {
        resetMocks()
        await client.callTool({ name: 'delete_ci_variable', arguments: { project_id: projectId, key } })
        expect(mockApi.delete).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/variables/${encodeURIComponent(key)}`,
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })


  // ── Protected Branches (Req 4.1-4.3) ──

  it('protect_branch: POST /projects/:id/protected_branches with body', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbNonEmptyString,
        fc.option(fc.constantFrom(0, 30, 40), { nil: undefined }),
        arbOptionalBool,
        async (projectId, name, pushAccessLevel, allowForcePush) => {
          resetMocks()
          const args: Record<string, unknown> = { project_id: projectId, name }
          const expectedBody: Record<string, unknown> = { name }
          if (pushAccessLevel !== undefined) { args.push_access_level = pushAccessLevel; expectedBody.push_access_level = pushAccessLevel }
          if (allowForcePush !== undefined) { args.allow_force_push = allowForcePush; expectedBody.allow_force_push = allowForcePush }

          await client.callTool({ name: 'protect_branch', arguments: args })

          expect(mockApi.post).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/protected_branches`,
            expect.objectContaining(expectedBody),
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_protected_branches: GET /projects/:id/protected_branches', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, async (projectId) => {
        resetMocks()
        await client.callTool({ name: 'list_protected_branches', arguments: { project_id: projectId } })
        expect(mockApi.get).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/protected_branches`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('unprotect_branch: DELETE /projects/:id/protected_branches/:name', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbNonEmptyString, async (projectId, name) => {
        resetMocks()
        await client.callTool({ name: 'unprotect_branch', arguments: { project_id: projectId, name } })
        expect(mockApi.delete).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/protected_branches/${encodeURIComponent(name)}`,
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // ── Project Settings (Req 5.1) ──

  it('update_project_settings: PUT /projects/:id with settings body', async () => {
    const arbMergeMethod = fc.option(fc.constantFrom('merge' as const, 'rebase_merge' as const, 'ff' as const), { nil: undefined })
    const arbSquashOption = fc.option(fc.constantFrom('default_off' as const, 'default_on' as const, 'always' as const, 'never' as const), { nil: undefined })
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbMergeMethod,
        arbSquashOption,
        arbOptionalBool,
        async (projectId, mergeMethod, squashOption, removeSourceBranch) => {
          resetMocks()
          const args: Record<string, unknown> = { project_id: projectId }
          if (mergeMethod !== undefined) args.merge_method = mergeMethod
          if (squashOption !== undefined) args.squash_option = squashOption
          if (removeSourceBranch !== undefined) args.remove_source_branch_after_merge = removeSourceBranch

          await client.callTool({ name: 'update_project_settings', arguments: args })

          expect(mockApi.put).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}`,
            expect.any(Object),
          )
          // Verify body contains only the fields we set
          const [, body] = mockApi.put.mock.calls[0]
          if (mergeMethod !== undefined) expect(body.merge_method).toBe(mergeMethod)
          if (squashOption !== undefined) expect(body.squash_option).toBe(squashOption)
          if (removeSourceBranch !== undefined) expect(body.remove_source_branch_after_merge).toBe(removeSourceBranch)
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })


  // ── Groups (Req 6.1-6.3) ──

  it('create_group: POST /groups with body', async () => {
    const arbVisibility = fc.option(fc.constantFrom('private' as const, 'internal' as const, 'public' as const), { nil: undefined })
    await fc.assert(
      fc.asyncProperty(
        arbNonEmptyString,
        arbNonEmptyString,
        arbVisibility,
        fc.option(arbPositiveInt, { nil: undefined }),
        async (name, path, visibility, parentId) => {
          resetMocks()
          const args: Record<string, unknown> = { name, path }
          const expectedBody: Record<string, unknown> = { name, path }
          if (visibility !== undefined) { args.visibility = visibility; expectedBody.visibility = visibility }
          if (parentId !== undefined) { args.parent_id = parentId; expectedBody.parent_id = parentId }

          await client.callTool({ name: 'create_group', arguments: args })

          expect(mockApi.post).toHaveBeenCalledWith('/groups', expect.objectContaining(expectedBody))
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_groups: GET /groups with query params', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(arbNonEmptyString, { nil: undefined }),
        arbOptionalBool,
        async (search, owned) => {
          resetMocks()
          const args: Record<string, unknown> = {}
          if (search !== undefined) args.search = search
          if (owned !== undefined) args.owned = owned

          await client.callTool({ name: 'list_groups', arguments: args })

          expect(mockApi.get).toHaveBeenCalledWith('/groups', expect.any(Object))
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('delete_group: DELETE /groups/:id', async () => {
    await fc.assert(
      fc.asyncProperty(arbPositiveInt, async (groupId) => {
        resetMocks()
        await client.callTool({ name: 'delete_group', arguments: { group_id: groupId } })
        expect(mockApi.delete).toHaveBeenCalledWith(`/groups/${groupId}`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // ── Access Tokens (Req 7.1-7.3) ──

  it('create_project_access_token: POST /projects/:id/access_tokens with body', async () => {
    const arbAccessLevel = fc.constantFrom(10, 20, 30, 40)
    const arbScopes = fc.array(fc.constantFrom('api', 'read_api', 'read_repository', 'write_repository'), { minLength: 1, maxLength: 4 })
    await fc.assert(
      fc.asyncProperty(
        arbProjectId,
        arbNonEmptyString,
        arbScopes,
        arbAccessLevel,
        arbNonEmptyString,
        async (projectId, name, scopes, accessLevel, expiresAt) => {
          resetMocks()
          const args = { project_id: projectId, name, scopes, access_level: accessLevel, expires_at: expiresAt }

          await client.callTool({ name: 'create_project_access_token', arguments: args })

          expect(mockApi.post).toHaveBeenCalledWith(
            `/projects/${encodeURIComponent(projectId)}/access_tokens`,
            { name, scopes, access_level: accessLevel, expires_at: expiresAt },
          )
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_project_access_tokens: GET /projects/:id/access_tokens', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, async (projectId) => {
        resetMocks()
        await client.callTool({ name: 'list_project_access_tokens', arguments: { project_id: projectId } })
        expect(mockApi.get).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/access_tokens`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('revoke_project_access_token: DELETE /projects/:id/access_tokens/:token_id', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbPositiveInt, async (projectId, tokenId) => {
        resetMocks()
        await client.callTool({ name: 'revoke_project_access_token', arguments: { project_id: projectId, token_id: tokenId } })
        expect(mockApi.delete).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/access_tokens/${tokenId}`,
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // ── Pipeline Triggers (Req 8.1-8.3) ──

  it('create_pipeline_trigger: POST /projects/:id/triggers with body', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbNonEmptyString, async (projectId, description) => {
        resetMocks()
        await client.callTool({ name: 'create_pipeline_trigger', arguments: { project_id: projectId, description } })
        expect(mockApi.post).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/triggers`,
          { description },
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('list_pipeline_triggers: GET /projects/:id/triggers', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, async (projectId) => {
        resetMocks()
        await client.callTool({ name: 'list_pipeline_triggers', arguments: { project_id: projectId } })
        expect(mockApi.get).toHaveBeenCalledWith(`/projects/${encodeURIComponent(projectId)}/triggers`)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('delete_pipeline_trigger: DELETE /projects/:id/triggers/:trigger_id', async () => {
    await fc.assert(
      fc.asyncProperty(arbProjectId, arbPositiveInt, async (projectId, triggerId) => {
        resetMocks()
        await client.callTool({ name: 'delete_pipeline_trigger', arguments: { project_id: projectId, trigger_id: triggerId } })
        expect(mockApi.delete).toHaveBeenCalledWith(
          `/projects/${encodeURIComponent(projectId)}/triggers/${triggerId}`,
        )
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
