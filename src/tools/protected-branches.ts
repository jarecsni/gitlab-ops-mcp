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

export function registerProtectedBranchTools(server: McpServer, client: GitLabApiClient): void {
  // protect_branch
  server.tool(
    'protect_branch',
    'Protect a branch with optional access level restrictions',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      name: z.string().describe('The name of the branch or wildcard pattern to protect'),
      push_access_level: z.number().optional().describe('Access level for push (0=no one, 30=developer, 40=maintainer)'),
      merge_access_level: z.number().optional().describe('Access level for merge (0=no one, 30=developer, 40=maintainer)'),
      allow_force_push: z.boolean().optional().describe('Allow force push to the protected branch'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { name: args.name }
        if (args.push_access_level !== undefined) body.push_access_level = args.push_access_level
        if (args.merge_access_level !== undefined) body.merge_access_level = args.merge_access_level
        if (args.allow_force_push !== undefined) body.allow_force_push = args.allow_force_push

        const result = await client.post(
          `/projects/${encodeURIComponent(args.project_id)}/protected_branches`,
          body,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_protected_branches
  server.tool(
    'list_protected_branches',
    'List all protected branches for a project',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
    },
    async (args) => {
      try {
        const result = await client.get(
          `/projects/${encodeURIComponent(args.project_id)}/protected_branches`,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // unprotect_branch
  server.tool(
    'unprotect_branch',
    'Remove protection from a branch',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      name: z.string().describe('The name of the branch to unprotect'),
    },
    async (args) => {
      try {
        await client.delete(
          `/projects/${encodeURIComponent(args.project_id)}/protected_branches/${encodeURIComponent(args.name)}`,
        )
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
