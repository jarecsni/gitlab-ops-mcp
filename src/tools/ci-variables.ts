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

export function registerCiVariableTools(server: McpServer, client: GitLabApiClient): void {
  // create_ci_variable
  server.tool(
    'create_ci_variable',
    'Create a project-level CI/CD variable',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      key: z.string().describe('The key of the variable'),
      value: z.string().describe('The value of the variable'),
      protected: z.boolean().optional().describe('Whether the variable is protected'),
      masked: z.boolean().optional().describe('Whether the variable is masked in job logs'),
      environment_scope: z.string().optional().describe('The environment scope of the variable'),
      variable_type: z.enum(['env_var', 'file']).optional().describe('The type of variable: env_var or file'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { key: args.key, value: args.value }
        if (args.protected !== undefined) body.protected = args.protected
        if (args.masked !== undefined) body.masked = args.masked
        if (args.environment_scope !== undefined) body.environment_scope = args.environment_scope
        if (args.variable_type !== undefined) body.variable_type = args.variable_type

        const result = await client.post(`/projects/${encodeURIComponent(args.project_id)}/variables`, body)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_ci_variables
  server.tool(
    'list_ci_variables',
    'List all CI/CD variables for a project',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
    },
    async (args) => {
      try {
        const result = await client.get(`/projects/${encodeURIComponent(args.project_id)}/variables`)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // update_ci_variable
  server.tool(
    'update_ci_variable',
    'Update an existing project CI/CD variable',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      key: z.string().describe('The key of the variable to update'),
      value: z.string().describe('The new value of the variable'),
      protected: z.boolean().optional().describe('Whether the variable is protected'),
      masked: z.boolean().optional().describe('Whether the variable is masked in job logs'),
      environment_scope: z.string().optional().describe('The environment scope of the variable'),
      variable_type: z.enum(['env_var', 'file']).optional().describe('The type of variable: env_var or file'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { value: args.value }
        if (args.protected !== undefined) body.protected = args.protected
        if (args.masked !== undefined) body.masked = args.masked
        if (args.environment_scope !== undefined) body.environment_scope = args.environment_scope
        if (args.variable_type !== undefined) body.variable_type = args.variable_type

        const result = await client.put(
          `/projects/${encodeURIComponent(args.project_id)}/variables/${encodeURIComponent(args.key)}`,
          body,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // delete_ci_variable
  server.tool(
    'delete_ci_variable',
    'Delete a project CI/CD variable',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      key: z.string().describe('The key of the variable to delete'),
    },
    async (args) => {
      try {
        await client.delete(
          `/projects/${encodeURIComponent(args.project_id)}/variables/${encodeURIComponent(args.key)}`,
        )
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
