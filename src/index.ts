#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createGitLabClient } from './gitlab-client.js'
import { registerAllTools } from './tools/index.js'

// ---------------------------------------------------------------------------
// Smithery integration
// ---------------------------------------------------------------------------

// Zod config schema — Smithery reads this to know what to collect from users.
export const configSchema = z.object({
  gitlabPersonalAccessToken: z.string().describe('GitLab Personal Access Token for API authentication'),
  gitlabApiUrl: z.string().default('https://gitlab.com/api/v4').describe('GitLab API base URL (defaults to gitlab.com)'),
})

// Default export — Smithery's hosted runtime calls this to create a server.
export default function createServer(config: z.infer<typeof configSchema>) {
  const client = createGitLabClient(config.gitlabApiUrl, config.gitlabPersonalAccessToken)
  const server = new McpServer({ name: 'gitlab-ops-mcp', version: '0.0.0' })
  registerAllTools(server, client)
  return server
}

// Sandbox server — lets Smithery scan tools without real credentials.
export function createSandboxServer() {
  return createServer({
    gitlabPersonalAccessToken: 'sandbox-token',
    gitlabApiUrl: 'https://gitlab.com/api/v4',
  })
}

// ---------------------------------------------------------------------------
// Stdio entry point (npx / local usage)
// ---------------------------------------------------------------------------

async function main() {
  const token = process.env.GITLAB_PERSONAL_ACCESS_TOKEN!
  const apiUrl = process.env.GITLAB_API_URL ?? 'https://gitlab.com/api/v4'

  const server = createServer({
    gitlabPersonalAccessToken: token,
    gitlabApiUrl: apiUrl,
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Only run stdio when a token is present (skipped during Smithery scan).
if (process.env.GITLAB_PERSONAL_ACCESS_TOKEN) {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
