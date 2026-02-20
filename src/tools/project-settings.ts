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

export function registerProjectSettingsTools(server: McpServer, client: GitLabApiClient): void {
  server.tool(
    'update_project_settings',
    'Update project-level settings such as merge strategy, pipeline requirements, and housekeeping options',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      merge_method: z.enum(['merge', 'rebase_merge', 'ff']).optional().describe('Merge method: merge, rebase_merge, or ff'),
      squash_option: z.enum(['default_off', 'default_on', 'always', 'never']).optional().describe('Squash option: default_off, default_on, always, or never'),
      only_allow_merge_if_pipeline_succeeds: z.boolean().optional().describe('Only allow merge if pipeline succeeds'),
      remove_source_branch_after_merge: z.boolean().optional().describe('Remove source branch after merge'),
      auto_devops_enabled: z.boolean().optional().describe('Enable Auto DevOps'),
      shared_runners_enabled: z.boolean().optional().describe('Enable shared runners'),
      container_registry_enabled: z.boolean().optional().describe('Enable container registry'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {}
        if (args.merge_method !== undefined) body.merge_method = args.merge_method
        if (args.squash_option !== undefined) body.squash_option = args.squash_option
        if (args.only_allow_merge_if_pipeline_succeeds !== undefined) body.only_allow_merge_if_pipeline_succeeds = args.only_allow_merge_if_pipeline_succeeds
        if (args.remove_source_branch_after_merge !== undefined) body.remove_source_branch_after_merge = args.remove_source_branch_after_merge
        if (args.auto_devops_enabled !== undefined) body.auto_devops_enabled = args.auto_devops_enabled
        if (args.shared_runners_enabled !== undefined) body.shared_runners_enabled = args.shared_runners_enabled
        if (args.container_registry_enabled !== undefined) body.container_registry_enabled = args.container_registry_enabled

        const result = await client.put(`/projects/${encodeURIComponent(args.project_id)}`, body)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
