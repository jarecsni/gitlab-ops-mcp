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

function createMcpServerWithToken(gitlabToken: string): McpServer {
  const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'
  const client = createGitLabClient(apiUrl, gitlabToken)

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

// Handle POST requests — client-to-server communication
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && transports[sessionId]) {
    // Reuse existing session
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session — extract GitLab token from header
    const gitlabToken = req.headers['x-gitlab-token'] as string | undefined
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

    const server = createMcpServerWithToken(gitlabToken)
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
