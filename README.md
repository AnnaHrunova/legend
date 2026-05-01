# Legend Desk

Legend Desk is a frontend-only prototype of an internal Zendesk-like support ticketing system.

The goal is to validate internal support workflows before investing in a real backend, authentication, permissions, data model, integrations, and production analytics. The current version is intentionally lightweight, clickable, and deployable as a static frontend.

## Product Vision

Legend Desk is planned as an internal company support platform for handling customer and operational support requests in one place.

Long term, the system should support:

- shared support queues
- ticket assignment and ownership
- customer conversation history
- internal notes and collaboration
- macros and repeatable workflows
- saved views for shared and personal ticket queues
- SLA tracking
- reports and operational metrics
- admin configuration for teams, agents, statuses, priorities, macros, and SLA policies
- analytics for understanding how users interact with the support workflow

The current prototype focuses on validating the workflow and user experience. It does not use real customer data.

## Current Prototype

This version is built with:

- React
- TypeScript
- Vite
- React Router
- plain CSS
- local mock data
- `localStorage` for simple state persistence
- GitHub Pages deployment via GitHub Actions

There is no backend yet. All ticket, customer, user, macro, report, and admin data is mocked locally in the frontend.

Implemented screens and workflows:

- ticket inbox driven by first-class saved views
- system views for My tickets, Unassigned, Urgent, Waiting on customer, Recently updated, SLA at risk, Escalated, and Solved this week
- custom views with local create, edit, duplicate, delete, filters, sorting, and visible columns
- ticket search within the current view and bulk actions
- ticket detail page with status, priority, assignee, team, tags, SLA info, conversation, internal notes, and activity timeline
- public replies and internal notes
- macro selector that inserts predefined response text
- create ticket flow
- customers page with customer profile and recent tickets
- reports dashboard with mocked operational metrics
- admin page showing future configuration areas

## Analytics Plan

PostHog is integrated through the central analytics wrapper. UI components do not call PostHog directly.

Analytics files:

```text
src/analytics/posthogClient.ts  # initializes PostHog once
src/analytics/analytics.ts      # exports track() and identify()
```

Required environment variables:

```bash
VITE_POSTHOG_KEY=your_posthog_project_api_key_here
```

Use `.env.example` as the template for local setup. Do not commit `.env`, `.env.local`, or real PostHog keys.

`track()` sends explicit events to PostHog and also logs them in development mode for easier validation. If `VITE_POSTHOG_KEY` is missing, PostHog is not initialized and development logging still works. The EU ingestion endpoint is configured in `src/analytics/posthogClient.ts` as `https://eu.i.posthog.com`. Autocapture and automatic pageview capture are disabled, so there is no global click tracking or DOM-based tracking.

Important actions already call `track()`, including:

- `ticket_opened`
- `ticket_created`
- `ticket_status_changed`
- `ticket_assignee_changed`
- `ticket_priority_changed`
- `ticket_reply_submitted`
- `internal_note_submitted`
- `macro_applied`
- `view_opened`
- `view_created`
- `view_edited`
- `view_duplicated`
- `view_deleted`
- `view_filter_changed`
- `view_sort_changed`
- `view_column_visibility_changed`
- `filter_applied`
- `search_used`
- `bulk_action_completed`

For GitHub Pages deployment, add configuration in GitHub:

```text
Settings -> Secrets and variables -> Actions
```

Required repository secret:

```text
VITE_POSTHOG_KEY
```

The GitHub Pages workflow passes `secrets.VITE_POSTHOG_KEY` to the Vite build. The PostHog API host is intentionally not configurable through GitHub Actions; it stays in code as the EU endpoint.

Important: in Vite frontend apps, variables prefixed with `VITE_` are embedded into the built JavaScript bundle. The PostHog project API key is not a private backend secret, but it still should not be hardcoded in source code.

To validate events:

1. Run the app with PostHog env vars configured.
2. Open a ticket, create a ticket, submit a reply, apply a macro, search, or edit a view.
3. In development, confirm the event appears in the browser console.
4. In PostHog, open `Product Analytics -> Events` and look for the event name.

Pricing and compliance requirements should be checked when analytics work begins, because vendor plans and company policies can change.

## Using Analytics to Design the Backend

PostHog data can later be used as practical input for backend planning.

The idea is not to blindly generate a backend from analytics. The useful approach is to collect evidence about how people actually use the prototype, then use that evidence to prompt and design the backend more accurately.

Examples of useful analytics signals:

- which ticket views are used most often
- which filters and sorts people rely on
- which bulk actions are common
- which ticket fields change most frequently
- where users abandon a flow
- which macros are applied
- how often users create notes versus public replies
- which admin configuration areas become important

Those signals can help define:

- real backend entities
- API endpoints
- database tables and indexes
- permission boundaries
- audit log requirements
- SLA automation rules
- reporting requirements

For example, if PostHog shows that users constantly filter by `team`, `assignee`, `status`, `priority`, and `SLA risk`, the backend should treat those as first-class query fields instead of bolting them on later.

Possible future prompt input for backend planning:

```text
We have a React prototype for an internal support desk.
PostHog shows that the most used workflows are:
- opening urgent tickets
- filtering by team and SLA risk
- assigning tickets in bulk
- adding internal notes before public replies
- applying escalation macros

Design the backend API, database schema, and event/audit model for these workflows.
Prioritize ticket list performance, permissions, SLA tracking, and future reporting.
```

This makes the backend roadmap grounded in observed behavior rather than assumptions. Less guessing, fewer beautiful-but-useless abstractions. Very refreshing. Unfortunately rare.

## Mock API Plan

The current prototype imports mock data directly from local TypeScript files.

That is enough for the first clickable prototype, but the next step can introduce MSW.

MSW would let the frontend call realistic API endpoints while still avoiding a real backend:

```text
Browser
  -> React UI
  -> fetch('/api/tickets')
  -> MSW intercepts the request
  -> mocked ticket data is returned
```

Why MSW may be useful in the next phase:

- components can be written against API-like contracts
- frontend behavior gets closer to the real production architecture
- request loading and error states can be tested earlier
- the future backend can replace MSW with less refactoring

Planned mock endpoints could include:

- `GET /api/tickets`
- `GET /api/tickets/:id`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `GET /api/customers`
- `GET /api/reports/summary`
- `GET /api/admin/config`

## Architecture Roadmap

### Phase 1: Clickable Frontend Prototype

Status: complete.

Purpose:

- validate navigation and support workflows
- demo the concept internally
- collect feedback before backend work

Includes:

- local mock data
- local state updates
- `localStorage` persistence
- first-class saved ticket views
- GitHub Pages deployment
- analytics wrapper with console logging

### Phase 2: More Realistic Mock Layer

Purpose:

- move from imported mock data to API-shaped mocked requests
- add loading states, empty states, and error states
- make frontend contracts closer to a future backend

Likely additions:

- MSW
- mock REST handlers
- better fixtures for tickets, comments, users, teams, and SLA policies

### Phase 3: Product Analytics

Purpose:

- understand how internal users interact with the prototype
- measure workflow friction before building production backend features
- collect evidence for backend API and data model decisions

Likely additions:

- event naming governance
- dashboards and funnels
- privacy review for tracked properties
- analytics summaries that can be used for backend planning prompts

PostHog must remain integrated through the existing analytics wrapper, not directly inside pages and components.

### Phase 4: Backend and Authentication

Purpose:

- replace mocked data with real persisted data
- support real users, permissions, and ticket ownership

Likely additions:

- API backend
- database
- authentication
- role-based access
- audit trail
- file attachments
- email or messaging integrations

### Phase 5: Production Support Platform

Purpose:

- turn the prototype into a reliable internal support tool

Likely additions:

- SLA automation
- notifications
- saved views
- advanced reporting
- admin editing
- search indexing
- customer history
- integration with company systems

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Then edit `.env`:

```bash
VITE_POSTHOG_KEY=your_real_posthog_project_api_key
```

Restart the dev server after changing `.env`.

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173/
```

## Build

```bash
npm run build
```

The production output is written to:

```text
dist/
```

## Preview Production Build

```bash
npm run preview
```

## Useful Scripts

```bash
npm run dev      # start local Vite dev server
npm run build    # type-check and build
npm run preview  # preview dist build locally
npm run lint     # run ESLint
```

## GitHub Pages Deployment

Deployment is configured with GitHub Actions:

```text
.github/workflows/deploy.yml
```

To deploy:

1. Push the repository to GitHub.
2. In GitHub, open `Settings -> Pages`.
3. Set the source to `GitHub Actions`.
4. Push to the `main` branch or run the workflow manually.

The workflow builds with:

```text
GITHUB_PAGES=true
```

When that flag is enabled, `vite.config.ts` sets the Vite `base` path from the GitHub repository name:

```ts
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'legend';
```

If the repository is renamed or deployed under a custom path, check `vite.config.ts` and update the fallback repository name if needed.

The workflow also copies:

```text
dist/index.html -> dist/404.html
```

This allows direct React Router URLs to work on GitHub Pages.

## Resetting Local Prototype Data

Ticket changes are stored in browser `localStorage`.

To reset the prototype back to the original mock data, clear this key:

```text
legend.support.tickets.v1
```

To reset custom saved views, clear this key:

```text
legend.support.customViews.v1
```

## Current Data Model

The prototype includes:

- 56 generated mock tickets
- 10 mock customers
- 8 mock agents
- 4 teams:
  - Billing
  - Technical Support
  - Compliance
  - Product Support

Ticket statuses:

- New
- Open
- Pending
- Waiting on customer
- Escalated
- Solved
- Closed

Priorities:

- Low
- Normal
- High
- Urgent

System ticket views:

- My tickets
- Unassigned
- Urgent
- Waiting on customer
- Recently updated
- SLA at risk
- Escalated
- Solved this week

## Notes

This project intentionally does not use real Zendesk assets, logos, branding, or copied UI. It is an original internal support tool prototype inspired by common helpdesk workflows.

No real customer data should be added to this prototype.
