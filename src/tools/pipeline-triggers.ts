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

export function registerPipelineTriggerTools(server: McpServer, client: GitLabApiClient): void {
  // create_pipeline_trigger
  server.tool(
    'create_pipeline_trigger',
    'Create a pipeline trigger token for cross-project pipeline triggering via the GitLab API',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      description: z.string().describe('Description of the trigger token'),
    },
    async (args) => {
      try {
        const result = await client.post(
          `/projects/${encodeURIComponent(args.project_id)}/triggers`,
          { description: args.description },
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_pipeline_triggers
  server.tool(
    'list_pipeline_triggers',
    'List all pipeline trigger tokens for a project, including their descriptions and ownership',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
    },
    async (args) => {
      try {
        const result = await client.get(
          `/projects/${encodeURIComponent(args.project_id)}/triggers`,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // delete_pipeline_trigger
  server.tool(
    'delete_pipeline_trigger',
    'Remove a pipeline trigger token, preventing any further pipeline triggers using it',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      trigger_id: z.number().describe('The ID of the trigger token to delete'),
    },
    async (args) => {
      try {
        await client.delete(
          `/projects/${encodeURIComponent(args.project_id)}/triggers/${args.trigger_id}`,
        )
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
