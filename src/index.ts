#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createGitLabClient } from './gitlab-client.js'
import { registerAllTools } from './tools/index.js'

// Smithery session configuration schema — tells Smithery what config to
// collect from users when they connect to this server.
export const configSchema = {
  type: 'object' as const,
  required: ['gitlabPersonalAccessToken'],
  properties: {
    gitlabPersonalAccessToken: {
      type: 'string' as const,
      description: 'GitLab Personal Access Token for API authentication',
    },
    gitlabApiUrl: {
      type: 'string' as const,
      default: 'https://gitlab.com/api/v4',
      description: 'GitLab API base URL (defaults to gitlab.com)',
    },
  },
}

async function main() {
  const token = process.env.GITLAB_PERSONAL_ACCESS_TOKEN!
  const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'

  const client = createGitLabClient(apiUrl, token)

  const server = new McpServer({
    name: 'gitlab-ops-mcp',
    version: '0.0.0',
  })

  registerAllTools(server, client)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Auto-run when a token is available (i.e. normal CLI / MCP client usage).
// When Smithery imports this module to scan configSchema, no token is set
// and main() is skipped — exactly what we want.
if (process.env.GITLAB_PERSONAL_ACCESS_TOKEN) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
