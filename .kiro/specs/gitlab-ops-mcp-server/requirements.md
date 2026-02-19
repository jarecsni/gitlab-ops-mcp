# Requirements Document

## Introduction

gitlab-ops-mcp is a supplementary MCP server for GitLab that provides the operational and orchestration layer missing from the standard GitLab MCP (`@zereight/mcp-gitlab`). It exposes 21 MCP tools across 7 domains — Webhooks, CI/CD Variables, Protected Branches, Project Settings, Groups/Subgroups, Project Access Tokens, and Pipeline Trigger Tokens — as thin REST wrappers around GitLab API v4. The server is built with Node.js/TypeScript using `@modelcontextprotocol/sdk` and is publishable to npm as `gitlab-ops-mcp`.

## Glossary

- **MCP_Server**: The gitlab-ops-mcp Model Context Protocol server process
- **GitLab_API**: The GitLab REST API v4 endpoint configured via GITLAB_API_URL
- **Tool_Handler**: A registered MCP tool function that processes a specific tool invocation
- **Webhook**: A GitLab project-level HTTP callback configuration that fires on specified events
- **CI_Variable**: A project-level CI/CD environment variable stored in GitLab
- **Protected_Branch**: A branch protection rule that restricts push and merge access
- **Project_Settings**: Configurable project-level options such as merge method and pipeline requirements
- **Group**: A GitLab namespace used for organising projects, supporting nested subgroups
- **Project_Access_Token**: A scoped, rotatable access token bound to a specific project
- **Pipeline_Trigger_Token**: A token used to trigger pipelines via API, typically for cross-project CI communication
- **API_Client**: The internal HTTP client module responsible for making authenticated requests to the GitLab_API

## Requirements

### Requirement 1: Server Initialisation and Authentication

**User Story:** As a developer, I want the MCP server to initialise with GitLab credentials from environment variables, so that I can connect to any GitLab instance without hardcoded configuration.

#### Acceptance Criteria

1. WHEN the MCP_Server starts, THE MCP_Server SHALL read `GITLAB_PERSONAL_ACCESS_TOKEN` and `GITLAB_API_URL` from environment variables
2. IF `GITLAB_PERSONAL_ACCESS_TOKEN` is not set, THEN THE MCP_Server SHALL exit with a descriptive error message
3. IF `GITLAB_API_URL` is not set, THEN THE MCP_Server SHALL default to `https://gitlab.com/api/v4`
4. WHEN the MCP_Server starts, THE MCP_Server SHALL register all 21 tools with the MCP SDK and begin accepting tool invocations via stdio transport
5. THE API_Client SHALL include the `PRIVATE-TOKEN` header with the configured token value on every request to the GitLab_API

### Requirement 2: Webhook Management

**User Story:** As a DevOps engineer, I want to manage project-level webhooks, so that managed repos can fire events (e.g. tag_push) to trigger orchestration workflows.

#### Acceptance Criteria

1. WHEN a `create_webhook` tool is invoked with `project_id`, `url`, optional `token`, and event flags, THE Tool_Handler SHALL send a POST request to `/projects/:id/hooks` and return the created webhook object including its `id`
2. WHEN a `list_webhooks` tool is invoked with `project_id`, THE Tool_Handler SHALL send a GET request to `/projects/:id/hooks` and return the array of webhook objects
3. WHEN an `update_webhook` tool is invoked with `project_id`, `hook_id`, and updated fields, THE Tool_Handler SHALL send a PUT request to `/projects/:id/hooks/:hook_id` and return the updated webhook object
4. WHEN a `delete_webhook` tool is invoked with `project_id` and `hook_id`, THE Tool_Handler SHALL send a DELETE request to `/projects/:id/hooks/:hook_id` and return a success confirmation
5. WHEN a `test_webhook` tool is invoked with `project_id`, `hook_id`, and `trigger` event type, THE Tool_Handler SHALL send a POST request to `/projects/:id/hooks/:hook_id/test/:trigger` and return the test result

### Requirement 3: CI/CD Variable Management

**User Story:** As a DevOps engineer, I want to manage project-level CI/CD variables, so that I can configure environment-specific settings like API URLs, registry credentials, and cross-repo tokens.

#### Acceptance Criteria

1. WHEN a `create_ci_variable` tool is invoked with `project_id`, `key`, `value`, and optional flags (`protected`, `masked`, `environment_scope`, `variable_type`), THE Tool_Handler SHALL send a POST request to `/projects/:id/variables` and return the created variable object
2. WHEN a `list_ci_variables` tool is invoked with `project_id`, THE Tool_Handler SHALL send a GET request to `/projects/:id/variables` and return the array of variable objects
3. WHEN an `update_ci_variable` tool is invoked with `project_id`, `key`, `value`, and optional fields, THE Tool_Handler SHALL send a PUT request to `/projects/:id/variables/:key` and return the updated variable object
4. WHEN a `delete_ci_variable` tool is invoked with `project_id` and `key`, THE Tool_Handler SHALL send a DELETE request to `/projects/:id/variables/:key` and return a success confirmation

### Requirement 4: Protected Branch Management

**User Story:** As a DevOps engineer, I want to manage branch protection rules, so that I can enforce merge-only workflows on main branches across managed repos.

#### Acceptance Criteria

1. WHEN a `protect_branch` tool is invoked with `project_id`, `name`, and optional access levels (`push_access_level`, `merge_access_level`, `allow_force_push`), THE Tool_Handler SHALL send a POST request to `/projects/:id/protected_branches` and return the protected branch object
2. WHEN a `list_protected_branches` tool is invoked with `project_id`, THE Tool_Handler SHALL send a GET request to `/projects/:id/protected_branches` and return the array of protected branch objects
3. WHEN an `unprotect_branch` tool is invoked with `project_id` and `name`, THE Tool_Handler SHALL send a DELETE request to `/projects/:id/protected_branches/:name` and return a success confirmation

### Requirement 5: Project Settings Management

**User Story:** As a DevOps engineer, I want to update project-level settings, so that I can ensure consistent merge strategies, pipeline requirements, and housekeeping across all repos.

#### Acceptance Criteria

1. WHEN an `update_project_settings` tool is invoked with `project_id` and one or more setting fields (`merge_method`, `only_allow_merge_if_pipeline_succeeds`, `remove_source_branch_after_merge`, `squash_option`, `auto_devops_enabled`, `shared_runners_enabled`, `container_registry_enabled`), THE Tool_Handler SHALL send a PUT request to `/projects/:id` with the provided fields and return the updated project object

### Requirement 6: Group and Subgroup Management

**User Story:** As a DevOps engineer, I want to manage GitLab groups and subgroups, so that I can create namespace isolation for workshops, demos, and team boundaries.

#### Acceptance Criteria

1. WHEN a `create_group` tool is invoked with `name`, `path`, optional `visibility`, optional `parent_id`, and optional `description`, THE Tool_Handler SHALL send a POST request to `/groups` and return the created group object including its `id`
2. WHEN a `list_groups` tool is invoked with optional filters (`search`, `owned`, `min_access_level`), THE Tool_Handler SHALL send a GET request to `/groups` with query parameters and return the array of group objects
3. WHEN a `delete_group` tool is invoked with `group_id`, THE Tool_Handler SHALL send a DELETE request to `/groups/:id` and return a success confirmation

### Requirement 7: Project Access Token Management

**User Story:** As a DevOps engineer, I want to manage project access tokens, so that I can create scoped, rotatable credentials for cross-repo CI communication.

#### Acceptance Criteria

1. WHEN a `create_project_access_token` tool is invoked with `project_id`, `name`, `scopes`, `access_level`, and `expires_at`, THE Tool_Handler SHALL send a POST request to `/projects/:id/access_tokens` and return the created token object including the token value
2. WHEN a `list_project_access_tokens` tool is invoked with `project_id`, THE Tool_Handler SHALL send a GET request to `/projects/:id/access_tokens` and return the array of token objects
3. WHEN a `revoke_project_access_token` tool is invoked with `project_id` and `token_id`, THE Tool_Handler SHALL send a DELETE request to `/projects/:id/access_tokens/:token_id` and return a success confirmation

### Requirement 8: Pipeline Trigger Token Management

**User Story:** As a DevOps engineer, I want to manage pipeline trigger tokens, so that I can set up cross-project pipeline triggering for CI-to-CI communication.

#### Acceptance Criteria

1. WHEN a `create_pipeline_trigger` tool is invoked with `project_id` and `description`, THE Tool_Handler SHALL send a POST request to `/projects/:id/triggers` and return the created trigger object including the `token`
2. WHEN a `list_pipeline_triggers` tool is invoked with `project_id`, THE Tool_Handler SHALL send a GET request to `/projects/:id/triggers` and return the array of trigger objects
3. WHEN a `delete_pipeline_trigger` tool is invoked with `project_id` and `trigger_id`, THE Tool_Handler SHALL send a DELETE request to `/projects/:id/triggers/:trigger_id` and return a success confirmation

### Requirement 9: Error Handling

**User Story:** As a developer, I want consistent and informative error responses from all tools, so that I can diagnose and resolve issues without inspecting raw HTTP responses.

#### Acceptance Criteria

1. IF the GitLab_API returns an HTTP error status (4xx or 5xx), THEN THE Tool_Handler SHALL return an MCP error response containing the HTTP status code and the error message from the GitLab_API response body
2. IF a required input parameter is missing from a tool invocation, THEN THE Tool_Handler SHALL return an MCP error response describing the missing parameter
3. IF the GitLab_API is unreachable (network error or timeout), THEN THE Tool_Handler SHALL return an MCP error response indicating a connectivity failure

### Requirement 10: Tool Input Validation

**User Story:** As a developer, I want all tool inputs to be validated before making API calls, so that invalid requests are caught early with clear error messages.

#### Acceptance Criteria

1. WHEN any tool is invoked, THE Tool_Handler SHALL validate that all required parameters are present and of the correct type before making a request to the GitLab_API
2. WHEN `create_ci_variable` is invoked, THE Tool_Handler SHALL validate that `variable_type` is one of `env_var` or `file` when provided
3. WHEN `create_group` is invoked, THE Tool_Handler SHALL validate that `visibility` is one of `private`, `internal`, or `public` when provided
4. WHEN `update_project_settings` is invoked, THE Tool_Handler SHALL validate that `merge_method` is one of `merge`, `rebase_merge`, or `ff` when provided
5. WHEN `update_project_settings` is invoked, THE Tool_Handler SHALL validate that `squash_option` is one of `default_off`, `default_on`, `always`, or `never` when provided
