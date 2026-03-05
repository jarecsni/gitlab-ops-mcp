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

export function registerProjectTools(server: McpServer, client: GitLabApiClient): void {
  server.tool(
    'create_project',
    'Create a new GitLab project with optional namespace (group) support. Unlike create_repository, this supports namespace_id for creating projects inside groups.',
    {
      name: z.string().describe('The name of the project'),
      namespace_id: z.number().optional().describe('Numeric ID of the group/namespace to create the project in. If omitted, creates under the authenticated user\'s namespace'),
      description: z.string().optional().describe('Project description'),
      visibility: z.enum(['private', 'internal', 'public']).optional().describe('Project visibility level (default: private)'),
      initialize_with_readme: z.boolean().optional().describe('Seed the project with a README.md (default: false)'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { name: args.name }
        if (args.namespace_id !== undefined) body.namespace_id = args.namespace_id
        if (args.description !== undefined) body.description = args.description
        if (args.visibility !== undefined) body.visibility = args.visibility
        if (args.initialize_with_readme !== undefined) body.initialize_with_readme = args.initialize_with_readme

        const result = await client.post('/projects', body)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
