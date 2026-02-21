#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createGitLabClient } from './gitlab-client.js'
import { registerAllTools } from './tools/index.js'

async function main() {
  const token = process.env.GITLAB_PERSONAL_ACCESS_TOKEN
  if (!token) {
    console.error('Error: GITLAB_PERSONAL_ACCESS_TOKEN environment variable is required')
    process.exit(1)
  }

  const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'
  const client = createGitLabClient(apiUrl, token)

  const server = new McpServer({
    name: 'gitlab-ops-mcp',
    title: 'GitLab Ops MCP',
    version: '1.0.2',
    description: 'The operational layer for GitLab that the standard MCP doesn\'t cover. 21 tools across 7 domains: webhooks, CI/CD variables, branch protection, project settings, groups, access tokens, and pipeline triggers. Designed for automated multi-repo project setup and delivery orchestration.',
    websiteUrl: 'https://github.com/jarecsni/gitlab-ops-mcp',
  })

  registerAllTools(server, client)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
