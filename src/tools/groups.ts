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

export function registerGroupTools(server: McpServer, client: GitLabApiClient): void {
  // create_group
  server.tool(
    'create_group',
    'Create a new GitLab group or subgroup',
    {
      name: z.string().describe('The name of the group'),
      path: z.string().describe('The URL-friendly path of the group'),
      visibility: z.enum(['private', 'internal', 'public']).optional().describe('Group visibility level'),
      parent_id: z.number().optional().describe('Parent group ID for creating a subgroup'),
      description: z.string().optional().describe('Group description'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { name: args.name, path: args.path }
        if (args.visibility !== undefined) body.visibility = args.visibility
        if (args.parent_id !== undefined) body.parent_id = args.parent_id
        if (args.description !== undefined) body.description = args.description

        const result = await client.post('/groups', body)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_groups
  server.tool(
    'list_groups',
    'List GitLab groups with optional filters',
    {
      search: z.string().optional().describe('Search term to filter groups by name'),
      owned: z.boolean().optional().describe('Limit to groups owned by the current user'),
      min_access_level: z.number().optional().describe('Minimum access level to filter groups'),
    },
    async (args) => {
      try {
        const params: Record<string, string> = {}
        if (args.search !== undefined) params.search = args.search
        if (args.owned !== undefined) params.owned = String(args.owned)
        if (args.min_access_level !== undefined) params.min_access_level = String(args.min_access_level)

        const result = await client.get('/groups', params)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // delete_group
  server.tool(
    'delete_group',
    'Delete a GitLab group',
    {
      group_id: z.number().describe('The ID of the group to delete'),
    },
    async (args) => {
      try {
        await client.delete(`/groups/${args.group_id}`)
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
