# Panel navigation and URL state

The panel mounts at `/app/`. The paths below are relative to that mount. The History API and routing store own navigation. Appearance and locale preferences use local storage; filters and pagination use the URL.

| Path | View |
| --- | --- |
| `/boards`, `/boards/:id`, `/boards/:id/settings` | Board list, Kanban and board configuration |
| `/tasks/:slug` | Task or subtask details |
| `/agents`, `/agents/:slug`, `/agents/:slug/settings` | Agent list, profile and settings |
| `/teams`, `/teams/:slug`, `/teams/:slug/settings` | Team list, membership and settings |

Agent, team and task URLs use immutable slugs. The client resolves them before fetching child records or mutating by UUID. Old UUID links are replaced with the canonical URL while preserving filters and the validated internal return destination. Boards retain UUID URLs.

## Query parameters

List filters use prefixes such as `boards.name`, `agents.role`, `teams.archived` and `kanban.executor`. Pagination uses scoped `offset` and `limit`; Kanban tracks each column's offset separately. A changed filter resets only its scope. Invalid values fall back to defaults.

Task `tab` selects a detail view, including specification, plans, comments, attachments, summaries and timeline. `plans.selected` identifies a plan independently of pagination. `revision.<planId>.selected` identifies a revision and `revision.<planId>.show` expands history. `timeline.includeChildren` controls descendant events.

The `from` parameter carries a validated internal origin including query state. Back and Forward restore views, while scroll positions are session-local. With no valid return origin, a task returns to its board, an agent to the agent list and a team to the team list. Deep links need an SPA fallback for panel routes. Reserve API, MCP and asset paths for their own handlers.
