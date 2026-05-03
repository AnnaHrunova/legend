# Legend Desk

Legend Desk is a frontend-only prototype of an internal support ticketing system inspired by common helpdesk workflows.

We are not building Zendesk. We are using a realistic frontend prototype to validate product assumptions before committing to backend architecture.

The intended loop is:

```text
UX -> Behavior -> Insights -> Backend
```

The frontend is used to:

- simulate support workflows
- validate navigation, ticket handling, saved views, macros, and reporting concepts
- collect real user behavior through analytics
- collect contextual user feedback from specific UI areas
- use evidence to design the backend correctly

No real customer data should be added to this prototype.

## Tech Stack

- React
- TypeScript
- Vite
- React Router
- Plain CSS
- Local TypeScript mock data
- `localStorage` for lightweight prototype state
- PostHog for analytics and future session replay
- GitHub Pages for deployment
- MSW is planned for the next mock API layer; it is not wired in yet

## Core Concept

This project is a validation tool, not a production support platform.

The goal is to answer product and engineering questions before backend work starts:

- Which support workflows are actually used?
- Which saved views matter?
- Which filters and fields are required?
- Where do users get stuck?
- Which ticket actions happen together?
- Which UI areas need feedback or redesign?

The backend should be designed only after enough workflow evidence exists.

## Current Prototype Scope

Implemented:

- ticket inbox driven by first-class saved views
- system views: My tickets, Unassigned, Urgent, Waiting on customer, Recently updated, SLA at risk, Escalated, Solved this week
- custom views with local create, edit, duplicate, delete, filters, sorting, visible columns, and color selection
- sidebar split between main navigation, system views, and my views
- ticket search within the current view
- bulk actions
- ticket detail page with status, priority, assignee, team, tags, SLA, conversation, internal notes, public replies, macros, and activity timeline
- create ticket flow
- customers page with customer profile
- reports dashboard
- topics heatmap with predefined support topics, project grouping, time buckets, playback, and drill-down
- admin settings mock
- contextual feedback buttons across major UI areas
- analytics events through a centralized wrapper

Mock data:

- 56 generated tickets
- 10 customers
- 8 agents
- 4 teams: Billing, Technical Support, Compliance, Product Support

## Topics Heatmap

The `/analytics/topics` page is the primary analytics visualization. It shows how user support topics evolve over time across support tickets, Google Play reviews, App Store reviews, projects, and severity.

This is not a click heatmap. It is a support analytics heatmap:

- rows = topics or projects
- columns = time, grouped by week or month
- cell value = number of tickets/reviews in that row and time bucket

We use it to understand:

- what users are struggling with
- which problems are growing
- which issues are declining
- which backend services are under stress

This helps product and engineering teams prioritize fixes, detect incidents, guide product decisions, and design backend systems based on real demand rather than assumptions.

The intended analytics pipeline is:

```text
text -> embeddings -> clustering -> topics -> aggregation -> heatmap
```

In this prototype, the workflow is controlled rather than fully ML-based:

- topics are currently predefined
- tickets are mapped to topics
- topics are aggregated over time
- results are visualized as a heatmap

In the future, embeddings and clustering can be used for automatic topic discovery.

Topics and projects answer different questions:

- Topic = user-facing problem, for example `Payment failed`
- Project = internal system or service, for example `payments service`

The heatmap can be grouped by:

- topics, which gives a user/problem view
- projects, which gives an engineering/service ownership view

Filters can scope the heatmap by:

- source: all data, support tickets, Google Play reviews, or App Store reviews
- severity: critical, medium, or low
- focus: one topic or one project
- time range and granularity

Focus is applied before grouping. Project focus scopes the heatmap to that project: in project grouping it shows one project row, and in topic grouping it shows only topics mapped to that project. Topic focus scopes the heatmap to that topic: in topic grouping it shows one topic row, and in project grouping it shows the projects mapped to that topic.

Cross-project relationships stay in the drill-down/details panel, not as extra heatmap rows. For example, focusing on `eSIM` keeps the heatmap clean while still showing related projects such as `Payments` in details when a topic crosses service boundaries.

Timeline playback shows how topics or projects change over time. It highlights the current bucket while keeping earlier buckets visible, so users can inspect spikes, emerging issues, and problem evolution after releases.

This page is intentionally not a general KPI dashboard. Avoid adding executive summary cards, health-score widgets, or Grafana-style panels unless explicitly requested. The heatmap is the product artifact being validated.

Current limitations:

- clustering is simulated through predefined topics
- topic labeling is simplified
- all data is mock-based

This is a prototype for validation, not production analytics.

Reference: [Document Clustering With LLM Embeddings in Scikit-Learn](https://machinelearningmastery.com/document-clustering-with-llm-embeddings-in-scikit-learn/)

This article explains how text can be converted into embeddings and grouped into topics using clustering algorithms.

## Analytics Filter UX

Topics Heatmap uses one filter model through `src/components/analytics/AnalyticsFilterPanel.tsx`.

Source is the single source of truth:

- `All data` includes support tickets, Google Play reviews, and App Store reviews
- `Support tickets` scopes analytics to support tickets only
- `Google Play reviews` implies Android
- `App Store reviews` implies iOS

There is intentionally no separate platform dropdown. Platform is derived from source, because `Google Play + iOS` and `App Store + Android` are invalid combinations. Do not reintroduce a platform selector unless the product model changes explicitly.

Filters use progressive disclosure:

- primary controls are source, group by, severity, time range, and granularity
- contextual controls appear only when needed
- active chips summarize state but are not the main control surface

Focus mode scopes the heatmap, playback, and drill-down panel to one analysis target:

- `All topics and projects`
- `One project`
- `One topic`

This lets users inspect a single service or user-facing problem over time without unrelated data adding noise. The UX is designed to avoid redundant choices, reduce cognitive load, and make invalid filter combinations impossible.

## Analytics Architecture

All analytics tracking must go through:

```text
src/analytics/analytics.ts
```

Allowed API:

```ts
track(eventName: string, properties?: Record<string, unknown>): void
```

Optional identity API:

```ts
identify(userId: string, properties?: Record<string, unknown>): void
```

Components must not import or call PostHog directly.

PostHog setup lives in:

```text
src/analytics/posthogClient.ts
```

Why this architecture matters:

- components stay decoupled from the analytics vendor
- PostHog can be replaced later without touching UI code
- event naming stays centralized and reviewable
- it prevents random tracking calls and analytics noise

Autocapture and automatic pageview tracking are disabled. Tracking is explicit only.

## Event Model

Events must be semantic. Do not add low-level UI noise such as `button_clicked`.

Current event model:

### Navigation

- `app_opened`
- `view_opened`

`view_opened` properties:

```ts
{
  view: 'inbox' | 'ticket_detail' | 'customers' | 'reports' | 'admin';
}
```

### Ticket Lifecycle

- `ticket_opened`
- `ticket_created`
- `ticket_status_changed`
- `ticket_assignee_changed`
- `ticket_priority_changed`

Expected properties:

```ts
ticket_opened: {
  ticketId: string;
  source: 'view' | 'search' | 'filter';
}

ticket_created: {
  ticketId: string;
  priority: string;
  team: string;
}

ticket_status_changed: {
  ticketId: string;
  fromStatus: string;
  toStatus: string;
}

ticket_assignee_changed: {
  ticketId: string;
  fromAssignee?: string;
  toAssignee: string;
}

ticket_priority_changed: {
  ticketId: string;
  fromPriority: string;
  toPriority: string;
}
```

### Communication

- `ticket_reply_submitted`
- `internal_note_submitted`

Properties:

```ts
{
  ticketId: string;
}
```

### Discovery

- `filter_applied`
- `search_used`

Expected properties:

```ts
filter_applied: {
  view: string;
  filters: string[];
}

search_used: {
  queryLength: number;
}
```

Do not send raw search text unless there is a reviewed privacy reason.

### Advanced Actions

- `macro_applied`
- `bulk_action_completed`

Expected properties:

```ts
macro_applied: {
  ticketId: string;
  macroName: string;
}

bulk_action_completed: {
  action: 'assign' | 'status_change' | 'tag_add' | string;
  count: number;
}
```

## Funnels

Funnels should be created in PostHog to understand workflow progression and drop-off.

Recommended funnels:

1. Activation

```text
view_opened -> ticket_opened
```

2. Ticket workflow

```text
ticket_opened -> ticket_assignee_changed -> ticket_status_changed
```

3. Discovery

```text
view_opened -> filter_applied -> ticket_opened
```

4. Creation

```text
ticket_created
```

If a future explicit start event is added, this funnel can become:

```text
ticket_created_clicked -> ticket_created
```

Funnels identify where users drop off. Session replay explains why.

## Session Replay

PostHog session replay can be used later to understand:

- confusion
- dead clicks
- missing affordances
- layout problems
- unclear copy
- broken workflow assumptions

Recommended analysis workflow:

```text
funnel -> drop-off -> replay -> product insight -> UX change
```

Before enabling replay, review privacy settings carefully. The prototype should not collect real customer data.

## Contextual Feedback

Users can leave feedback directly from the UI.

Feedback uses one event:

```text
feedback_submitted
```

Do not create separate feedback events such as `ticket_status_feedback_submitted`.

Feedback is context-based so it can be grouped and filtered in PostHog.

Implemented contexts include:

- `global`
- `sidebar_navigation`
- `views_list`
- `view_builder`
- `ticket_list`
- `ticket_filters`
- `ticket_search`
- `ticket_bulk_actions`
- `ticket_detail`
- `ticket_status_selector`
- `ticket_assignee_selector`
- `ticket_priority_selector`
- `ticket_tags`
- `ticket_conversation`
- `ticket_reply_box`
- `ticket_internal_note_box`
- `ticket_macros`
- `ticket_activity_timeline`
- `ticket_sla`
- `create_ticket_form`
- `customers_list`
- `customer_profile`
- `reports_dashboard`
- `admin_settings`

Feedback event shape:

```ts
{
  text: string;
  context: string;
  path: string;
  pageTitle?: string;
  componentLabel?: string;
  ticketId?: string;
  viewId?: string;
}
```

Feedback is not stored in a backend and is not stored in `localStorage`. It is sent to PostHog only.

## How To View Data

In PostHog:

- `Product Analytics -> Events`: raw events, including `feedback_submitted`
- `Product Analytics -> Insights`: funnels and trends
- `Dashboards`: overview reporting
- `Session Replay`: behavior before and after key events, if replay is enabled

Useful feedback properties:

- `text`
- `context`
- `path`
- `ticketId`
- `viewId`
- `componentLabel`
- `pageTitle`

## Development Setup

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env
```

Add the PostHog project key:

```bash
VITE_POSTHOG_KEY=your_real_posthog_project_api_key
```

Restart the dev server after changing `.env`.

Start development:

```bash
npm run dev
```

Common scripts:

```bash
npm run dev      # start Vite
npm run build    # type-check and build
npm run preview  # preview production build
npm run lint     # run ESLint
```

## Deployment

Deployment is handled by GitHub Pages via GitHub Actions:

```text
.github/workflows/deploy.yml
```

Deployment steps:

1. Push to `main`.
2. GitHub Actions builds the Vite app.
3. The workflow uploads `dist`.
4. GitHub Pages serves the static site.

Required GitHub secret:

```text
VITE_POSTHOG_KEY
```

Configure it in:

```text
GitHub -> Settings -> Secrets and variables -> Actions -> Secrets
```

Important:

- `.env` is not committed
- `.env.local` is not committed
- `.env.example` is committed
- Vite embeds `VITE_` variables into the frontend bundle at build time
- the PostHog project key is not a backend secret, but it should not be hardcoded in source code

The PostHog EU ingestion endpoint is configured in code:

```text
https://eu.i.posthog.com
```

## Product Workflow

The intended validation process:

1. Users interact with the prototype.
2. Events are collected.
3. Funnels are analyzed.
4. Session replay is reviewed for drop-offs or confusion.
5. Contextual feedback is analyzed.
6. Insights are generated.
7. UX is improved.
8. Backend requirements are designed from observed behavior.

This loop should repeat until the core support workflow is clear.

## Backend Philosophy

The backend should be built after validation, not before.

Backend design should be driven by:

- real workflows
- repeated user behavior
- observed ticket lifecycle patterns
- high-value saved views and filters
- reporting needs
- SLA and automation requirements
- feedback from users testing the prototype

Avoid building backend abstractions from assumptions. A beautiful abstraction for a workflow nobody uses is still useless.

## Rules For Contributors And AI Agents

Follow these rules when extending the project:

- do not add random features without a product reason
- do not introduce new analytics events without a clear question they answer
- do not call PostHog directly from UI components
- keep all tracking behind `src/analytics/analytics.ts`
- do not store contextual feedback in `localStorage`
- do not add a backend until validation requires it
- keep UI changes simple and workflow-focused
- prefer removing confusing features over adding more controls
- keep mock data realistic but fake
- avoid real customer data
- preserve GitHub Pages deployment
- run `npm run build` and `npm run lint` before pushing

## Future Work

Only after validation:

- MSW mock API layer
- real backend API
- authentication and permissions
- database schema
- SLA engine
- automation rules
- notifications
- email or messaging integrations
- advanced reporting
- saved view sharing
- admin editing
- audit log

Future work should be prioritized by analytics, replay, and feedback evidence.

## Resetting Local Prototype State

Ticket changes are stored locally for prototype convenience.

Reset tickets:

```text
legend.support.tickets.v1
```

Reset custom saved views:

```text
legend.support.customViews.v1
```
