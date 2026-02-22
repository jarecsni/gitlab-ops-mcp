#!/usr/bin/env node

import express from 'express'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createGitLabClient } from './gitlab-client.js'
import { registerAllTools } from './tools/index.js'

const app = express()
app.use(express.json())

// Session store: transport instances keyed by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {}

// GitLab tokens keyed by session ID (extracted from init request)
const sessionTokens: Record<string, string> = {}

function createMcpServerWithToken(gitlabToken: string, apiUrl?: string): McpServer {
  const resolvedApiUrl = apiUrl || process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'
  const client = createGitLabClient(resolvedApiUrl, gitlabToken)

  const server = new McpServer({
    name: 'gitlab-ops-mcp',
    title: 'GitLab Ops MCP',
    version: '1.0.2',
    description: 'The operational layer for GitLab that the standard MCP doesn\'t cover. 21 tools across 7 domains: webhooks, CI/CD variables, branch protection, project settings, groups, access tokens, and pipeline triggers. Designed for automated multi-repo project setup and delivery orchestration.',
    websiteUrl: 'https://github.com/jarecsni/gitlab-ops-mcp',
  })

  registerAllTools(server, client)
  return server
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'gitlab-ops-mcp', transport: 'streamable-http' })
})

// OAuth discovery — tell scanners this server uses header-based auth, not OAuth
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.status(404).json({ error: 'not_supported', error_description: 'This server uses header-based authentication (PRIVATE-TOKEN), not OAuth' })
})

// Satisfy OAuth Dynamic Client Registration probes (Smithery scanner requires this)
app.post('/register', (req, res) => {
  const body = req.body || {}
  res.status(201).json({
    client_id: 'gitlab-ops-mcp-static-client',
    client_name: body.client_name || 'gitlab-ops-mcp-client',
    redirect_uris: body.redirect_uris || [],
    grant_types: body.grant_types || ['authorization_code'],
    response_types: body.response_types || ['code'],
    token_endpoint_auth_method: 'none',
  })
})

// OAuth metadata — point scanners at our fake authorize/token endpoints
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  const base = `${_req.protocol}://${_req.get('host')}`
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
  })
})

// Fake authorize — redirect back with a dummy code
app.get('/authorize', (req, res) => {
  const redirectUri = req.query.redirect_uri as string
  const state = req.query.state as string
  if (redirectUri) {
    const url = new URL(redirectUri)
    url.searchParams.set('code', 'gitlab-ops-mcp-dummy-code')
    if (state) url.searchParams.set('state', state)
    res.redirect(url.toString())
  } else {
    res.status(400).json({ error: 'invalid_request', error_description: 'Missing redirect_uri' })
  }
})

// Fake token exchange — return a dummy access token
app.post('/token', (_req, res) => {
  res.json({
    access_token: 'gitlab-ops-mcp-dummy-token',
    token_type: 'Bearer',
    expires_in: 3600,
  })
})

// Static MCP server card for registry scanners (Smithery, etc.)
app.get('/.well-known/mcp/server-card.json', (_req, res) => {
  res.json({
    name: 'gitlab-ops-mcp',
    title: 'GitLab Ops MCP',
    version: '1.0.2',
    description: 'The operational layer for GitLab that the standard MCP doesn\'t cover. 21 tools across 7 domains: webhooks, CI/CD variables, branch protection, project settings, groups, access tokens, and pipeline triggers. Designed for automated multi-repo project setup and delivery orchestration.',
    websiteUrl: 'https://github.com/jarecsni/gitlab-ops-mcp',
    transport: 'streamable-http',
    endpoint: '/mcp',
    authentication: {
      type: 'header',
      header: 'X-GitLab-Token',
      description: 'GitLab personal access token (glpat-...) with api scope',
    },
    tools: [
      { name: 'create_webhook', description: 'Create a project-level webhook with configurable event subscriptions (push, tag, MR, pipeline, etc.) and optional secret token verification' },
      { name: 'list_webhooks', description: 'List all webhooks configured on a GitLab project, including their URLs, event subscriptions, and SSL verification status' },
      { name: 'update_webhook', description: 'Update an existing webhook\'s URL, secret token, event subscriptions, or SSL settings' },
      { name: 'delete_webhook', description: 'Remove a webhook from a GitLab project' },
      { name: 'test_webhook', description: 'Trigger a test event (push, tag_push, etc.) against a webhook to verify it is receiving and processing events correctly' },
      { name: 'create_ci_variable', description: 'Create a project-level CI/CD variable with optional protection, masking, environment scoping, and file type support' },
      { name: 'list_ci_variables', description: 'List all CI/CD variables for a project, including their keys, protection status, masking, and environment scopes' },
      { name: 'update_ci_variable', description: 'Update an existing CI/CD variable\'s value, protection, masking, environment scope, or type' },
      { name: 'delete_ci_variable', description: 'Remove a CI/CD variable from a project by key' },
      { name: 'protect_branch', description: 'Protect a branch (or wildcard pattern) with configurable push/merge access levels and force-push settings' },
      { name: 'list_protected_branches', description: 'List all protected branches for a project, including their push/merge access levels and force-push settings' },
      { name: 'unprotect_branch', description: 'Remove protection rules from a branch, restoring default push and merge permissions' },
      { name: 'update_project_settings', description: 'Update project-level settings: merge strategy, squash policy, pipeline requirements, source branch cleanup, Auto DevOps, shared runners, and container registry' },
      { name: 'create_group', description: 'Create a new GitLab group or subgroup with configurable visibility and description for namespace isolation' },
      { name: 'list_groups', description: 'List GitLab groups with optional search, ownership, and minimum access level filters' },
      { name: 'delete_group', description: 'Delete a GitLab group and all projects within it (cascading delete)' },
      { name: 'create_project_access_token', description: 'Create a scoped, rotatable access token for a project with configurable scopes, access level, and expiry date' },
      { name: 'list_project_access_tokens', description: 'List all access tokens for a project, including their scopes, access levels, and expiry dates' },
      { name: 'revoke_project_access_token', description: 'Revoke a project access token, immediately invalidating it for all future API requests' },
      { name: 'create_pipeline_trigger', description: 'Create a pipeline trigger token for cross-project pipeline triggering via the GitLab API' },
      { name: 'list_pipeline_triggers', description: 'List all pipeline trigger tokens for a project, including their descriptions and ownership' },
      { name: 'delete_pipeline_trigger', description: 'Remove a pipeline trigger token, preventing any further pipeline triggers using it' },
    ],
  })
})

// Handle POST requests — client-to-server communication
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && transports[sessionId]) {
    // Reuse existing session
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session — extract GitLab token and optional API URL from headers
    const gitlabToken = req.headers['x-gitlab-token'] as string | undefined
    const gitlabApiUrl = req.headers['x-gitlab-api-url'] as string | undefined
    if (!gitlabToken) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Missing X-GitLab-Token header',
        },
        id: null,
      })
      return
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        transports[newSessionId] = transport
        sessionTokens[newSessionId] = gitlabToken
      },
    })

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId]
        delete sessionTokens[transport.sessionId]
      }
    }

    const server = createMcpServerWithToken(gitlabToken, gitlabApiUrl)
    await server.connect(transport)
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    })
    return
  }

  await transport.handleRequest(req, res, req.body)
})

// Handle GET — server-to-client notifications via SSE
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }
  await transports[sessionId].handleRequest(req, res)
})

// Handle DELETE — session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }
  await transports[sessionId].handleRequest(req, res)
})

const PORT = parseInt(process.env.PORT ?? '3000', 10)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`gitlab-ops-mcp HTTP server listening on port ${PORT}`)
  console.log(`Endpoint: http://0.0.0.0:${PORT}/mcp`)
})
