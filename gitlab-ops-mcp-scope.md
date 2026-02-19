# gitlab-ops-mcp — Scope Document

## Overview

A supplementary MCP server for GitLab that provides the operational and orchestration layer missing from the standard GitLab MCP (`@zereight/mcp-gitlab`).

The existing MCP covers developer workspace operations: repos, files, branches, MRs, issues, pipelines, releases, commits. `gitlab-ops-mcp` covers the automation and project governance layer: webhooks, CI variables, branch protection, project settings, groups, and access tokens.

Together they provide complete GitLab API coverage for automated multi-repo project setup and delivery orchestration.

## Motivation

Methodology M (an AI-driven multi-team delivery method) requires a root repo to orchestrate multiple managed repos. Setting up and maintaining this orchestration requires GitLab operations that the existing MCP doesn't expose:

- Webhooks so the root repo can watch managed repos for tag events
- CI/CD variables for cross-repo configuration
- Branch protection to enforce merge-only workflows
- Project settings for consistent merge strategies across repos
- Groups for namespace isolation (workshops, demos, team boundaries)
- Project access tokens for scoped cross-repo CI communication

Without these, project setup requires manual GitLab UI work — which defeats the purpose of an AI-driven methodology.

## What the existing GitLab MCP already covers

For reference, these are handled and should NOT be duplicated:

- Project CRUD, forking, members, repository tree
- File read/write, multi-file push
- Branch creation
- Merge request CRUD, diffs, merge
- Issue CRUD, listing, assignment
- Pipeline CRUD, jobs, job output
- Release CRUD
- Commit listing, details, diffs
- Namespace listing

## Tool Catalogue

### 1. Webhooks

Manage project-level webhooks. Primary use: managed repos fire tag_push events to trigger root repo topology bumps.

**Tools:**
- `create_webhook` — Create a webhook on a project
  - Inputs: `project_id`, `url`, `token` (secret), event flags (`tag_push_events`, `push_events`, `merge_requests_events`, `pipeline_events`, etc.)
  - Returns: webhook object with `id`
- `list_webhooks` — List all webhooks for a project
  - Inputs: `project_id`
- `update_webhook` — Update an existing webhook
  - Inputs: `project_id`, `hook_id`, same fields as create
- `delete_webhook` — Remove a webhook
  - Inputs: `project_id`, `hook_id`
- `test_webhook` — Trigger a test event for a webhook
  - Inputs: `project_id`, `hook_id`, `trigger` (e.g. `tag_push`)

**GitLab API:** `POST/GET/PUT/DELETE /projects/:id/hooks`

### 2. CI/CD Variables

Manage project-level CI/CD variables. Used for environment-specific config: API URLs, registry credentials, cross-repo tokens.

**Tools:**
- `create_ci_variable` — Create a CI/CD variable
  - Inputs: `project_id`, `key`, `value`, `protected` (bool), `masked` (bool), `environment_scope` (default `*`), `variable_type` (`env_var` or `file`)
  - Returns: variable object
- `list_ci_variables` — List all CI/CD variables for a project
  - Inputs: `project_id`
- `update_ci_variable` — Update an existing variable
  - Inputs: `project_id`, `key`, `value`, and optional fields
- `delete_ci_variable` — Remove a variable
  - Inputs: `project_id`, `key`

**GitLab API:** `POST/GET/PUT/DELETE /projects/:id/variables`

### 3. Protected Branches

Manage branch protection rules. Enforces merge-only workflows on main.

**Tools:**
- `protect_branch` — Protect a branch
  - Inputs: `project_id`, `name` (branch name or wildcard), `push_access_level` (0=no one, 30=dev, 40=maintainer), `merge_access_level`, `allow_force_push` (bool)
  - Returns: protected branch object
- `list_protected_branches` — List protected branches
  - Inputs: `project_id`
- `unprotect_branch` — Remove protection from a branch
  - Inputs: `project_id`, `name`

**GitLab API:** `POST/GET/DELETE /projects/:id/protected_branches`

### 4. Project Settings

Update project-level configuration. Ensures consistent merge strategies, pipeline requirements, and housekeeping across all repos in an M-type project.

**Tools:**
- `update_project_settings` — Update project settings
  - Inputs: `project_id`, and any of:
    - `merge_method`: `merge` | `rebase_merge` | `ff`
    - `only_allow_merge_if_pipeline_succeeds`: bool
    - `remove_source_branch_after_merge`: bool
    - `squash_option`: `default_off` | `default_on` | `always` | `never`
    - `auto_devops_enabled`: bool
    - `shared_runners_enabled`: bool
    - `container_registry_enabled`: bool
  - Returns: updated project object

**GitLab API:** `PUT /projects/:id`

### 5. Groups / Subgroups

Manage GitLab groups. Used for namespace isolation — workshop instances, team boundaries, demo environments.

**Tools:**
- `create_group` — Create a group or subgroup
  - Inputs: `name`, `path`, `visibility` (`private` | `internal` | `public`), `parent_id` (for subgroups), `description`
  - Returns: group object with `id`
- `list_groups` — List groups
  - Inputs: `search` (optional), `owned` (bool, optional), `min_access_level` (optional)
- `delete_group` — Delete a group (cascades to all projects within)
  - Inputs: `group_id`

**GitLab API:** `POST/GET/DELETE /groups`

### 6. Project Access Tokens

Manage scoped access tokens for cross-repo CI communication. Cleaner than personal tokens — scoped to a project, rotatable, auditable.

**Tools:**
- `create_project_access_token` — Create a project access token
  - Inputs: `project_id`, `name`, `scopes` (array: `api`, `read_api`, `read_repository`, `write_repository`, `read_registry`, `write_registry`), `access_level` (10=guest, 20=reporter, 30=dev, 40=maintainer), `expires_at` (ISO date)
  - Returns: token object (token value only available on creation)
- `list_project_access_tokens` — List tokens for a project
  - Inputs: `project_id`
- `revoke_project_access_token` — Revoke a token
  - Inputs: `project_id`, `token_id`

**GitLab API:** `POST/GET/DELETE /projects/:id/access_tokens`

## Implementation Approach

- Node.js / TypeScript
- Uses `@modelcontextprotocol/sdk` for MCP server implementation
- Thin REST wrappers around GitLab API v4
- Same auth pattern as existing MCP: `GITLAB_PERSONAL_ACCESS_TOKEN` and `GITLAB_API_URL` via environment variables
- Publishable to npm as `gitlab-ops-mcp`

## Configuration

```
{
  "mcpServers": {
    "gitlab-ops": {
      "command": "npx",
      "args": ["-y", "gitlab-ops-mcp"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-...",
        "GITLAB_API_URL": "https://gitlab.com/api/v4"
      },
      "autoApprove": [
        "list_webhooks",
        "list_ci_variables",
        "list_protected_branches",
        "list_groups",
        "list_project_access_tokens"
      ]
    }
  }
}
```

## Relationship to Existing MCP

The two servers are complementary, not competing:

- `@zereight/mcp-gitlab` = developer workspace (what you work with daily)
- `gitlab-ops-mcp` = project operations (what you set up once and automate)

Read-only tools (list operations) are safe to auto-approve. Mutating tools (create, update, delete) should require confirmation.

### 7. Pipeline Trigger Tokens

Manage pipeline trigger tokens for cross-project pipeline triggering. The root repo needs to trigger its own pipeline when a managed repo tags — webhooks are one mechanism, but GitLab's native cross-project triggers via tokens are another (and often simpler for CI-to-CI communication).

**Tools:**
- `create_pipeline_trigger` — Create a pipeline trigger token
  - Inputs: `project_id`, `description`
  - Returns: trigger object with `token`
- `list_pipeline_triggers` — List trigger tokens for a project
  - Inputs: `project_id`
- `delete_pipeline_trigger` — Remove a trigger token
  - Inputs: `project_id`, `trigger_id`

**GitLab API:** `POST/GET/DELETE /projects/:id/triggers`

**Note:** The actual cross-project trigger invocation (`POST /projects/:id/trigger/pipeline`) could also be added, but in practice this is called from within CI pipelines (via `curl`), not from the MCP. Include if useful for testing/demo purposes.

## Estimated Scope

- 21 tools across 7 domains
- ~600-800 lines of implementation code
- Thin REST wrappers — no business logic, no state

## Out of Scope

- Anything the existing GitLab MCP already handles (no duplication)
- Runner registration (infrastructure concern, not API-automatable on SaaS)
- GitLab admin-level operations (instance settings, user management)
- Jira/external integrations (separate concern)
