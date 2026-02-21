import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GitLabApiClient } from '../gitlab-client.js'
import { GitLabApiError, GitLabConnectionError, ValidationError } from '../errors.js'

function errorResponse(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  }
}

function jsonResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function handleError(error: unknown) {
  if (error instanceof ValidationError) {
    return errorResponse(`Validation error: ${error.message}`)
  }
  if (error instanceof GitLabApiError) {
    return errorResponse(`GitLab API error ${error.statusCode}: ${error.gitlabMessage}`)
  }
  if (error instanceof GitLabConnectionError) {
    return errorResponse(`GitLab connection error: ${error.message}`)
  }
  return errorResponse(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
}

export function registerAccessTokenTools(server: McpServer, client: GitLabApiClient): void {
  // create_project_access_token
  server.tool(
    'create_project_access_token',
    'Create a scoped, rotatable access token for a project with configurable scopes (api, read_api, read/write_repository, read/write_registry), access level, and expiry date',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      name: z.string().describe('The name of the access token'),
      scopes: z.array(z.string()).describe('Array of scopes (e.g. api, read_api, read_repository)'),
      access_level: z.number().describe('Access level (10=guest, 20=reporter, 30=developer, 40=maintainer)'),
      expires_at: z.string().describe('Expiration date in ISO format (YYYY-MM-DD)'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {
          name: args.name,
          scopes: args.scopes,
          access_level: args.access_level,
          expires_at: args.expires_at,
        }

        const result = await client.post(
          `/projects/${encodeURIComponent(args.project_id)}/access_tokens`,
          body,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_project_access_tokens
  server.tool(
    'list_project_access_tokens',
    'List all access tokens for a project, including their scopes, access levels, and expiry dates',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
    },
    async (args) => {
      try {
        const result = await client.get(
          `/projects/${encodeURIComponent(args.project_id)}/access_tokens`,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // revoke_project_access_token
  server.tool(
    'revoke_project_access_token',
    'Revoke a project access token, immediately invalidating it for all future API requests',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      token_id: z.number().describe('The ID of the access token to revoke'),
    },
    async (args) => {
      try {
        await client.delete(
          `/projects/${encodeURIComponent(args.project_id)}/access_tokens/${args.token_id}`,
        )
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
