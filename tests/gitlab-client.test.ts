import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGitLabClient } from '../src/gitlab-client.js'
import { GitLabApiError, GitLabConnectionError } from '../src/errors.js'

const BASE_URL = 'https://gitlab.example.com/api/v4'
const TOKEN = 'glpat-test-token-abc123'

let fetchSpy: ReturnType<typeof vi.fn>

function mockFetchResponse(status: number, body: unknown, ok?: boolean) {
  return fetchSpy.mockResolvedValueOnce({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })
}

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GitLab API Client', () => {
  describe('PRIVATE-TOKEN header', () => {
    it('attaches PRIVATE-TOKEN on GET requests', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/1')

      expect(fetchSpy).toHaveBeenCalledOnce()
      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN)
    })

    it('attaches PRIVATE-TOKEN on POST requests', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.post('/projects/1/hooks', { url: 'https://example.com' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN)
    })

    it('attaches PRIVATE-TOKEN on PUT requests', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.put('/projects/1/hooks/5', { url: 'https://updated.com' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN)
    })

    it('attaches PRIVATE-TOKEN on DELETE requests', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/5')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['PRIVATE-TOKEN']).toBe(TOKEN)
    })
  })

  describe('base URL prepending', () => {
    it('prepends base URL to the path on GET', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/42/hooks')

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://gitlab.example.com/api/v4/projects/42/hooks')
    })

    it('prepends base URL to the path on POST', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.post('/groups', { name: 'test' })

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://gitlab.example.com/api/v4/groups')
    })

    it('prepends base URL to the path on PUT', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.put('/projects/1', { merge_method: 'ff' })

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://gitlab.example.com/api/v4/projects/1')
    })

    it('prepends base URL to the path on DELETE', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/9')

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://gitlab.example.com/api/v4/projects/1/hooks/9')
    })
  })

  describe('query params on GET', () => {
    it('appends query params to the URL', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/groups', { search: 'devops', owned: 'true' })

      const [url] = fetchSpy.mock.calls[0]
      expect(url).toContain('?')
      expect(url).toContain('search=devops')
      expect(url).toContain('owned=true')
    })

    it('does not append ? when params are empty', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/1/hooks', {})

      const [url] = fetchSpy.mock.calls[0]
      expect(url).not.toContain('?')
    })

    it('does not append ? when params are undefined', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/1/hooks')

      const [url] = fetchSpy.mock.calls[0]
      expect(url).not.toContain('?')
    })
  })

  describe('Content-Type header', () => {
    it('sets Content-Type: application/json on POST', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.post('/projects/1/hooks', { url: 'https://example.com' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['Content-Type']).toBe('application/json')
    })

    it('sets Content-Type: application/json on PUT', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.put('/projects/1/hooks/5', { url: 'https://updated.com' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['Content-Type']).toBe('application/json')
    })

    it('does not set Content-Type on GET', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/1/hooks')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['Content-Type']).toBeUndefined()
    })

    it('does not set Content-Type on DELETE', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/5')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.headers['Content-Type']).toBeUndefined()
    })
  })

  describe('JSON body on POST/PUT', () => {
    it('sends JSON-stringified body on POST', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      const body = { url: 'https://example.com', push_events: true }
      await client.post('/projects/1/hooks', body)

      const [, init] = fetchSpy.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual(body)
    })

    it('sends JSON-stringified body on PUT', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      const body = { merge_method: 'ff', squash_option: 'always' }
      await client.put('/projects/1', body)

      const [, init] = fetchSpy.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual(body)
    })

    it('does not send body on GET', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects/1/hooks')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.body).toBeUndefined()
    })

    it('does not send body on DELETE', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/5')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.body).toBeUndefined()
    })
  })

  describe('HTTP method', () => {
    it('uses GET method for get()', async () => {
      mockFetchResponse(200, [])
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.get('/projects')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.method).toBe('GET')
    })

    it('uses POST method for post()', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.post('/groups', { name: 'test' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.method).toBe('POST')
    })

    it('uses PUT method for put()', async () => {
      mockFetchResponse(200, { id: 1 })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.put('/projects/1', { merge_method: 'ff' })

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.method).toBe('PUT')
    })

    it('uses DELETE method for delete()', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/5')

      const [, init] = fetchSpy.mock.calls[0]
      expect(init.method).toBe('DELETE')
    })
  })

  describe('GitLabApiError on 4xx/5xx', () => {
    it('throws GitLabApiError on 404 with message from JSON body', async () => {
      mockFetchResponse(404, { message: '404 Project Not Found' }, false)
      const client = createGitLabClient(BASE_URL, TOKEN)

      await expect(client.get('/projects/999')).rejects.toThrow(GitLabApiError)
      try {
        await client.get('/projects/999')
      } catch (e) {
        // first call already threw, use the error from the first rejection
      }
    })

    it('captures statusCode and gitlabMessage on 404', async () => {
      mockFetchResponse(404, { message: '404 Project Not Found' }, false)
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.get('/projects/999')
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabApiError)
        const err = e as GitLabApiError
        expect(err.statusCode).toBe(404)
        expect(err.gitlabMessage).toBe('404 Project Not Found')
      }
    })

    it('captures statusCode and gitlabMessage on 401', async () => {
      mockFetchResponse(401, { message: '401 Unauthorized' }, false)
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.post('/projects/1/hooks', { url: 'https://x.com' })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabApiError)
        const err = e as GitLabApiError
        expect(err.statusCode).toBe(401)
        expect(err.gitlabMessage).toBe('401 Unauthorized')
      }
    })

    it('captures statusCode and gitlabMessage on 500', async () => {
      mockFetchResponse(500, { error: 'Internal Server Error' }, false)
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.put('/projects/1', { merge_method: 'ff' })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabApiError)
        const err = e as GitLabApiError
        expect(err.statusCode).toBe(500)
        expect(err.gitlabMessage).toBe('Internal Server Error')
      }
    })

    it('falls back to text body when JSON parsing fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new Error('not json') },
        text: async () => 'Bad Gateway',
      })
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.get('/projects/1')
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabApiError)
        const err = e as GitLabApiError
        expect(err.statusCode).toBe(502)
        expect(err.gitlabMessage).toBe('Bad Gateway')
      }
    })

    it('throws GitLabApiError on DELETE with 403', async () => {
      mockFetchResponse(403, { message: '403 Forbidden' }, false)
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.delete('/projects/1/hooks/5')
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabApiError)
        const err = e as GitLabApiError
        expect(err.statusCode).toBe(403)
        expect(err.gitlabMessage).toBe('403 Forbidden')
      }
    })
  })

  describe('GitLabConnectionError on network failure', () => {
    it('throws GitLabConnectionError when fetch rejects', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'))
      const client = createGitLabClient(BASE_URL, TOKEN)

      await expect(client.get('/projects')).rejects.toThrow(GitLabConnectionError)
    })

    it('wraps the original error as cause', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND gitlab.example.com')
      fetchSpy.mockRejectedValueOnce(networkError)
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.post('/groups', { name: 'test' })
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabConnectionError)
        expect((e as GitLabConnectionError).cause).toBe(networkError)
      }
    })

    it('wraps non-Error rejections as Error cause', async () => {
      fetchSpy.mockRejectedValueOnce('socket hang up')
      const client = createGitLabClient(BASE_URL, TOKEN)

      try {
        await client.delete('/projects/1/hooks/5')
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(GitLabConnectionError)
        expect((e as GitLabConnectionError).cause).toBeInstanceOf(Error)
        expect((e as GitLabConnectionError).cause.message).toBe('socket hang up')
      }
    })
  })

  describe('DELETE returns void', () => {
    it('resolves to undefined on successful DELETE', async () => {
      mockFetchResponse(200, null)
      const client = createGitLabClient(BASE_URL, TOKEN)
      const result = await client.delete('/projects/1/hooks/5')

      expect(result).toBeUndefined()
    })

    it('does not attempt to parse response body on DELETE', async () => {
      const jsonSpy = vi.fn()
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: jsonSpy,
        text: async () => '',
      })
      const client = createGitLabClient(BASE_URL, TOKEN)
      await client.delete('/projects/1/hooks/5')

      expect(jsonSpy).not.toHaveBeenCalled()
    })
  })

  describe('response parsing', () => {
    it('returns parsed JSON on GET', async () => {
      const data = [{ id: 1, url: 'https://example.com' }]
      mockFetchResponse(200, data)
      const client = createGitLabClient(BASE_URL, TOKEN)
      const result = await client.get('/projects/1/hooks')

      expect(result).toEqual(data)
    })

    it('returns parsed JSON on POST', async () => {
      const data = { id: 42, url: 'https://new-hook.com' }
      mockFetchResponse(200, data)
      const client = createGitLabClient(BASE_URL, TOKEN)
      const result = await client.post('/projects/1/hooks', { url: 'https://new-hook.com' })

      expect(result).toEqual(data)
    })

    it('returns parsed JSON on PUT', async () => {
      const data = { id: 1, merge_method: 'ff' }
      mockFetchResponse(200, data)
      const client = createGitLabClient(BASE_URL, TOKEN)
      const result = await client.put('/projects/1', { merge_method: 'ff' })

      expect(result).toEqual(data)
    })
  })
})
