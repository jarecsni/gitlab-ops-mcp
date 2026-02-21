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

export function registerWebhookTools(server: McpServer, client: GitLabApiClient): void {
  // create_webhook
  server.tool(
    'create_webhook',
    'Create a project-level webhook with configurable event subscriptions (push, tag, MR, pipeline, etc.) and optional secret token verification',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      url: z.string().describe('The webhook URL'),
      token: z.string().optional().describe('Secret token for webhook verification'),
      push_events: z.boolean().optional().describe('Trigger on push events'),
      merge_requests_events: z.boolean().optional().describe('Trigger on merge request events'),
      tag_push_events: z.boolean().optional().describe('Trigger on tag push events'),
      issues_events: z.boolean().optional().describe('Trigger on issue events'),
      pipeline_events: z.boolean().optional().describe('Trigger on pipeline events'),
      job_events: z.boolean().optional().describe('Trigger on job events'),
      note_events: z.boolean().optional().describe('Trigger on comment events'),
      releases_events: z.boolean().optional().describe('Trigger on release events'),
      enable_ssl_verification: z.boolean().optional().describe('Enable SSL verification'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = { url: args.url }
        if (args.token !== undefined) body.token = args.token
        if (args.push_events !== undefined) body.push_events = args.push_events
        if (args.merge_requests_events !== undefined) body.merge_requests_events = args.merge_requests_events
        if (args.tag_push_events !== undefined) body.tag_push_events = args.tag_push_events
        if (args.issues_events !== undefined) body.issues_events = args.issues_events
        if (args.pipeline_events !== undefined) body.pipeline_events = args.pipeline_events
        if (args.job_events !== undefined) body.job_events = args.job_events
        if (args.note_events !== undefined) body.note_events = args.note_events
        if (args.releases_events !== undefined) body.releases_events = args.releases_events
        if (args.enable_ssl_verification !== undefined) body.enable_ssl_verification = args.enable_ssl_verification

        const result = await client.post(`/projects/${encodeURIComponent(args.project_id)}/hooks`, body)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // list_webhooks
  server.tool(
    'list_webhooks',
    'List all webhooks configured on a GitLab project, including their URLs, event subscriptions, and SSL verification status',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
    },
    async (args) => {
      try {
        const result = await client.get(`/projects/${encodeURIComponent(args.project_id)}/hooks`)
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // update_webhook
  server.tool(
    'update_webhook',
    'Update an existing webhook\'s URL, secret token, event subscriptions, or SSL settings',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      hook_id: z.number().describe('The ID of the webhook to update'),
      url: z.string().optional().describe('The webhook URL'),
      token: z.string().optional().describe('Secret token for webhook verification'),
      push_events: z.boolean().optional().describe('Trigger on push events'),
      merge_requests_events: z.boolean().optional().describe('Trigger on merge request events'),
      tag_push_events: z.boolean().optional().describe('Trigger on tag push events'),
      issues_events: z.boolean().optional().describe('Trigger on issue events'),
      pipeline_events: z.boolean().optional().describe('Trigger on pipeline events'),
      job_events: z.boolean().optional().describe('Trigger on job events'),
      note_events: z.boolean().optional().describe('Trigger on comment events'),
      releases_events: z.boolean().optional().describe('Trigger on release events'),
      enable_ssl_verification: z.boolean().optional().describe('Enable SSL verification'),
    },
    async (args) => {
      try {
        const body: Record<string, unknown> = {}
        if (args.url !== undefined) body.url = args.url
        if (args.token !== undefined) body.token = args.token
        if (args.push_events !== undefined) body.push_events = args.push_events
        if (args.merge_requests_events !== undefined) body.merge_requests_events = args.merge_requests_events
        if (args.tag_push_events !== undefined) body.tag_push_events = args.tag_push_events
        if (args.issues_events !== undefined) body.issues_events = args.issues_events
        if (args.pipeline_events !== undefined) body.pipeline_events = args.pipeline_events
        if (args.job_events !== undefined) body.job_events = args.job_events
        if (args.note_events !== undefined) body.note_events = args.note_events
        if (args.releases_events !== undefined) body.releases_events = args.releases_events
        if (args.enable_ssl_verification !== undefined) body.enable_ssl_verification = args.enable_ssl_verification

        const result = await client.put(
          `/projects/${encodeURIComponent(args.project_id)}/hooks/${args.hook_id}`,
          body,
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // delete_webhook
  server.tool(
    'delete_webhook',
    'Remove a webhook from a GitLab project',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      hook_id: z.number().describe('The ID of the webhook to delete'),
    },
    async (args) => {
      try {
        await client.delete(`/projects/${encodeURIComponent(args.project_id)}/hooks/${args.hook_id}`)
        return jsonResponse({ status: 'success' })
      } catch (error) {
        return handleError(error)
      }
    },
  )

  // test_webhook
  server.tool(
    'test_webhook',
    'Trigger a test event (push, tag_push, etc.) against a webhook to verify it is receiving and processing events correctly',
    {
      project_id: z.string().describe('Project ID or URL-encoded path'),
      hook_id: z.number().describe('The ID of the webhook to test'),
      trigger: z.string().describe('The event type to trigger (e.g. push_events, tag_push_events)'),
    },
    async (args) => {
      try {
        const result = await client.post(
          `/projects/${encodeURIComponent(args.project_id)}/hooks/${args.hook_id}/test/${args.trigger}`,
          {},
        )
        return jsonResponse(result)
      } catch (error) {
        return handleError(error)
      }
    },
  )
}
