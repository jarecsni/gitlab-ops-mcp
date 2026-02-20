import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GitLabApiClient } from '../gitlab-client.js'
import { registerWebhookTools } from './webhooks.js'
import { registerCiVariableTools } from './ci-variables.js'
import { registerProtectedBranchTools } from './protected-branches.js'
import { registerProjectSettingsTools } from './project-settings.js'
import { registerGroupTools } from './groups.js'
import { registerAccessTokenTools } from './access-tokens.js'
import { registerPipelineTriggerTools } from './pipeline-triggers.js'

export function registerAllTools(server: McpServer, client: GitLabApiClient): void {
  registerWebhookTools(server, client)
  registerCiVariableTools(server, client)
  registerProtectedBranchTools(server, client)
  registerProjectSettingsTools(server, client)
  registerGroupTools(server, client)
  registerAccessTokenTools(server, client)
  registerPipelineTriggerTools(server, client)
}
