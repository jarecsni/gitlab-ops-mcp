import { GitLabApiError, GitLabConnectionError } from './errors.js'

export interface GitLabApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>
  post<T>(path: string, body: Record<string, unknown>): Promise<T>
  put<T>(path: string, body: Record<string, unknown>): Promise<T>
  delete(path: string): Promise<void>
}

export function createGitLabClient(baseUrl: string, token: string): GitLabApiClient {
  async function request<T>(method: string, path: string, body?: Record<string, unknown>, params?: Record<string, string>): Promise<T> {
    let url = `${baseUrl}${path}`

    if (params && Object.keys(params).length > 0) {
      const search = new URLSearchParams(params)
      url += `?${search.toString()}`
    }

    const headers: Record<string, string> = {
      'PRIVATE-TOKEN': token,
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
    }

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch (error) {
      throw new GitLabConnectionError(error instanceof Error ? error : new Error(String(error)))
    }

    if (!response.ok) {
      let message: string
      try {
        const errorBody = await response.json() as Record<string, unknown>
        message = (errorBody.message ?? errorBody.error ?? JSON.stringify(errorBody)) as string
      } catch {
        message = await response.text()
      }
      throw new GitLabApiError(response.status, message)
    }

    if (method === 'DELETE') {
      return undefined as T
    }

    return await response.json() as T
  }

  return {
    get<T>(path: string, params?: Record<string, string>): Promise<T> {
      return request<T>('GET', path, undefined, params)
    },
    post<T>(path: string, body: Record<string, unknown>): Promise<T> {
      return request<T>('POST', path, body)
    },
    put<T>(path: string, body: Record<string, unknown>): Promise<T> {
      return request<T>('PUT', path, body)
    },
    async delete(path: string): Promise<void> {
      await request<void>('DELETE', path)
    },
  }
}
