import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { createGitLabClient } from '../../src/gitlab-client.js'

/**
 * Feature: gitlab-ops-mcp-server, Property 2: Authentication header inclusion
 *
 * For any request made by the API_Client to the GitLab_API, the request SHALL
 * include a `PRIVATE-TOKEN` header whose value equals the configured
 * `GITLAB_PERSONAL_ACCESS_TOKEN`.
 *
 * Validates: Requirements 1.5
 */

const NUM_RUNS = 100

const arbToken = fc.stringMatching(/^[a-zA-Z0-9_-]{1,40}$/)
const arbBaseUrl = fc.constantFrom(
  'https://gitlab.com/api/v4',
  'https://gitlab.example.com/api/v4',
  'https://self-hosted.dev/api/v4',
)
const arbPath = fc.stringMatching(/^\/[a-z0-9/_-]{1,50}$/)
const arbBody = fc.dictionary(
  fc.stringMatching(/^[a-z_]{1,15}$/),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 1, maxKeys: 5 },
)

let fetchSpy: ReturnType<typeof vi.fn>

function mockOkResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '{}',
  }
}

beforeEach(() => {
  fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(mockOkResponse()))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Feature: gitlab-ops-mcp-server, Property 2: Authentication header inclusion', () => {
  it('PRIVATE-TOKEN header is present and correct on GET requests', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, async (baseUrl, token, path) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.get(path)

        expect(fetchSpy).toHaveBeenCalledOnce()
        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['PRIVATE-TOKEN']).toBe(token)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('PRIVATE-TOKEN header is present and correct on POST requests', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, arbBody, async (baseUrl, token, path, body) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.post(path, body)

        expect(fetchSpy).toHaveBeenCalledOnce()
        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['PRIVATE-TOKEN']).toBe(token)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('PRIVATE-TOKEN header is present and correct on PUT requests', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, arbBody, async (baseUrl, token, path, body) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.put(path, body)

        expect(fetchSpy).toHaveBeenCalledOnce()
        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['PRIVATE-TOKEN']).toBe(token)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('PRIVATE-TOKEN header is present and correct on DELETE requests', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, async (baseUrl, token, path) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.delete(path)

        expect(fetchSpy).toHaveBeenCalledOnce()
        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['PRIVATE-TOKEN']).toBe(token)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('Content-Type: application/json is set for POST requests (which have bodies)', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, arbBody, async (baseUrl, token, path, body) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.post(path, body)

        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['Content-Type']).toBe('application/json')
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('Content-Type: application/json is set for PUT requests (which have bodies)', async () => {
    await fc.assert(
      fc.asyncProperty(arbBaseUrl, arbToken, arbPath, arbBody, async (baseUrl, token, path, body) => {
        fetchSpy.mockClear()
        const client = createGitLabClient(baseUrl, token)
        await client.put(path, body)

        const [, init] = fetchSpy.mock.calls[0]
        expect(init.headers['Content-Type']).toBe('application/json')
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
