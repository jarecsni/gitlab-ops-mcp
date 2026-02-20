# Implementation Plan: gitlab-ops-mcp-server

## Overview

Incremental build of the gitlab-ops-mcp server. Start with project scaffolding and the API client, then implement each tool domain one at a time, wiring each into the server as we go. Property tests and unit tests are interleaved with implementation to catch issues early.

## Tasks

- [x] 1. Project scaffolding and core infrastructure
  - [x] 1.1 Initialise the project with package.json, tsconfig.json, and install dependencies (`@modelcontextprotocol/sdk`, `typescript`, `vitest`, `fast-check`)
    - Create `package.json` with name `gitlab-ops-mcp`, bin entry, and scripts (build, test)
    - Create `tsconfig.json` targeting ES2022 with Node module resolution
    - Create `src/` and `tests/` directory structure
    - _Requirements: 1.4_
  - [x] 1.2 Implement error classes in `src/errors.ts`
    - `GitLabApiError` with `statusCode` and `gitlabMessage`
    - `GitLabConnectionError` with `cause`
    - `ValidationError` with `paramName`
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.3 Implement the GitLab API client in `src/gitlab-client.ts`
    - `get`, `post`, `put`, `delete` methods wrapping `fetch`
    - Prepend base URL, attach `PRIVATE-TOKEN` header
    - Throw `GitLabApiError` on non-2xx, `GitLabConnectionError` on network failure
    - _Requirements: 1.5, 9.1, 9.3_
  - [x] 1.4 Implement validation utilities in `src/validation.ts`
    - `requireString`, `requireNumber`, `optionalString`, `optionalNumber`, `optionalBoolean`, `requireEnum`, `optionalEnum`, `optionalStringArray`
    - Each throws `ValidationError` with descriptive message on failure
    - _Requirements: 10.1_
  - [ ]* 1.5 Write unit tests for validation utilities
    - Test each validator function with valid and invalid inputs
    - Test `ValidationError` includes parameter name
    - _Requirements: 10.1_
  - [ ]* 1.6 Write unit tests for GitLab API client
    - Test auth header is attached to all request types
    - Test `GitLabApiError` thrown on 4xx/5xx with status and message
    - Test `GitLabConnectionError` thrown on network failure
    - Test base URL prepending
    - _Requirements: 1.5, 9.1, 9.3_

- [x] 2. Webhook tool handlers
  - [x] 2.1 Implement webhook handlers in `src/tools/webhooks.ts`
    - `create_webhook`, `list_webhooks`, `update_webhook`, `delete_webhook`, `test_webhook`
    - Each validates inputs, builds API path, calls client, returns MCP text content
    - Export `registerWebhookTools(server, client)` function
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 2.2 Write unit tests for webhook handlers
    - Test each handler with mock API client
    - Test correct API path construction with various project_id and hook_id values
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. CI/CD variable tool handlers
  - [x] 3.1 Implement CI variable handlers in `src/tools/ci-variables.ts`
    - `create_ci_variable`, `list_ci_variables`, `update_ci_variable`, `delete_ci_variable`
    - Validate `variable_type` enum when provided
    - Export `registerCiVariableTools(server, client)` function
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_
  - [ ]* 3.2 Write unit tests for CI variable handlers
    - Test each handler with mock API client
    - Test `variable_type` enum validation rejects invalid values
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 10.2_

- [x] 4. Protected branch and project settings tool handlers
  - [x] 4.1 Implement protected branch handlers in `src/tools/protected-branches.ts`
    - `protect_branch`, `list_protected_branches`, `unprotect_branch`
    - Export `registerProtectedBranchTools(server, client)` function
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.2 Implement project settings handler in `src/tools/project-settings.ts`
    - `update_project_settings` with enum validation for `merge_method` and `squash_option`
    - Export `registerProjectSettingsTools(server, client)` function
    - _Requirements: 5.1, 10.4, 10.5_
  - [ ]* 4.3 Write unit tests for protected branch and project settings handlers
    - Test correct API paths for branch name encoding
    - Test `merge_method` and `squash_option` enum validation
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 10.4, 10.5_

- [x] 5. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Group, access token, and pipeline trigger tool handlers
  - [x] 6.1 Implement group handlers in `src/tools/groups.ts`
    - `create_group`, `list_groups`, `delete_group`
    - Validate `visibility` enum when provided
    - Export `registerGroupTools(server, client)` function
    - _Requirements: 6.1, 6.2, 6.3, 10.3_
  - [x] 6.2 Implement access token handlers in `src/tools/access-tokens.ts`
    - `create_project_access_token`, `list_project_access_tokens`, `revoke_project_access_token`
    - Export `registerAccessTokenTools(server, client)` function
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 6.3 Implement pipeline trigger handlers in `src/tools/pipeline-triggers.ts`
    - `create_pipeline_trigger`, `list_pipeline_triggers`, `delete_pipeline_trigger`
    - Export `registerPipelineTriggerTools(server, client)` function
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ]* 6.4 Write unit tests for group, access token, and pipeline trigger handlers
    - Test `visibility` enum validation
    - Test correct API paths for all three domains
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.3_

- [x] 7. Server entry point and tool registration
  - [x] 7.1 Implement tool registration index in `src/tools/index.ts`
    - `registerAllTools(server, client)` calling all domain register functions
    - _Requirements: 1.4_
  - [x] 7.2 Implement server entry point in `src/index.ts`
    - Read env vars, validate token presence, default API URL
    - Create `GitLabApiClient`, create MCP `Server`, register all tools, connect via `StdioServerTransport`
    - Add shebang for npx execution
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 7.3 Write unit tests for server initialisation
    - Test missing token produces error
    - Test missing API URL defaults to `https://gitlab.com/api/v4`
    - Test all 21 tools are registered
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 8. Property-based tests
  - [ ]* 8.1 Write property test for tool-to-API request mapping
    - **Property 1: Tool-to-API request mapping**
    - Generate random valid inputs for each tool, verify correct HTTP method, path, and body sent to API client
    - **Validates: Requirements 2.1-2.5, 3.1-3.4, 4.1-4.3, 5.1, 6.1-6.3, 7.1-7.3, 8.1-8.3**
  - [ ]* 8.2 Write property test for authentication header inclusion
    - **Property 2: Authentication header inclusion**
    - Generate random API calls, verify PRIVATE-TOKEN header is always present and correct
    - **Validates: Requirements 1.5**
  - [ ]* 8.3 Write property test for required parameter validation
    - **Property 3: Required parameter validation**
    - For each tool, omit each required param in turn, verify validation error and no API call made
    - **Validates: Requirements 9.2, 10.1**
  - [ ]* 8.4 Write property test for enum parameter validation
    - **Property 4: Enum parameter validation**
    - Generate random strings outside allowed enum sets, verify validation error and no API call made
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.5**
  - [ ]* 8.5 Write property test for HTTP error propagation
    - **Property 5: HTTP error propagation**
    - Generate random HTTP error statuses and messages, verify MCP error response contains both
    - **Validates: Requirements 9.1**

- [x] 9. Final wiring and npm packaging
  - [x] 9.1 Configure `package.json` for npm publishing
    - Set `bin` field pointing to `dist/index.js`
    - Set `files` to include `dist/`
    - Add `prepublishOnly` script that builds
    - _Requirements: 1.4_
  - [x] 9.2 Add README with configuration example and tool catalogue
    - MCP client configuration JSON
    - List of all 21 tools with brief descriptions
    - _Requirements: 1.1_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per property
- Unit tests use `vitest` with mock API client (no HTTP mocking library needed)
- Checkpoints at tasks 5 and 10 ensure incremental validation
