# Legend Desk

Legend Desk started as a frontend-only prototype of an internal support ticketing system inspired by common helpdesk workflows.

We are not building Zendesk. Most of the app is still a realistic frontend prototype used to validate product assumptions before committing to broad backend architecture.

The current exception is the in-app voice support MVP. Voice support now has a small real backend on Hetzner because realtime voice sessions, LiveKit rooms, OpenAI Realtime usage, and mobile-originated tickets cannot be validated honestly with static mock data alone.

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
- Hetzner for the live `app.legenddesk.com` environment
- Docker Compose for the Hetzner runtime
- Caddy for HTTPS and reverse proxying
- Express for the voice session API
- Postgres for mobile-originated voice tickets
- LiveKit Cloud for realtime voice rooms
- LiveKit Agents SDK for the voice agent worker
- OpenAI Realtime for speech understanding and spoken AI responses
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
- in-app voice support MVP with LiveKit/OpenAI Realtime
- mobile voice test page that imitates an iOS/Android app starting a voice support session
- voice tickets created from mobile context and stored in Postgres
- support-side ability to join the same live voice room from the ticket detail page
- contextual feedback buttons across major UI areas
- analytics events through a centralized wrapper

Mock data:

- 56 generated tickets
- 10 customers
- 8 agents
- 4 teams: Billing, Technical Support, Compliance, Product Support

## In-App Voice Support

Legend Desk includes an MVP for authenticated in-app voice support.

The product idea:

```text
Mobile app user has a problem
-> starts voice support from inside the app
-> Legend Desk creates a contextual voice ticket
-> AI voice agent joins the LiveKit room
-> support can join the same live room if human help is needed
-> user does not have to repeat account/app context
```

The point is not to make a phone-call clone. The point is to validate whether mobile app context helps support understand and resolve the problem faster.

### What LiveKit Does

LiveKit is the realtime media layer.

In this project it is responsible for:

- creating voice rooms
- connecting the mobile customer, AI agent, and support agent to the same room
- handling WebRTC audio transport
- issuing participant tokens through our backend
- exposing room/session lifecycle in the LiveKit dashboard

LiveKit does not understand the user's problem by itself. It moves audio and manages realtime participants.

### What OpenAI Does

OpenAI Realtime is the voice intelligence layer.

The AI voice agent uses OpenAI Realtime to:

- listen to the customer
- understand speech
- respond by voice
- use attached app context before asking generic questions
- decide when the issue may need a human handoff

OpenAI usage starts when the LiveKit agent session is active and stops when the LiveKit room is closed or the agent disconnects.

### What Legend Desk Does

Legend Desk owns the support workflow:

- creates the ticket
- stores mobile app context
- shows detected intent, transcript, status, and summary
- lets support join the same room
- lets support mark the voice session as `AI resolved`, `Human resolved`, or `Abandoned`
- closes the LiveKit room when the session ends

Voice call UI states:

- `connecting`
- `live`
- `ending`
- `ended`
- `failed`

### Current Architecture

```text
Mobile voice test page
        |
        | POST /api/mobile-voice-sessions
        v
legend-voice-api on Hetzner
        |
        | creates ticket in Postgres
        | creates LiveKit room
        | creates customer/support tokens
        | dispatches voice agent
        v
LiveKit Cloud room
        |
        +-- mobile customer participant
        +-- AI voice agent participant
        +-- support participant from Legend Desk, if joined
        |
        v
OpenAI Realtime
```

Runtime services on Hetzner:

- `legend-frontend`: Caddy + built Vite frontend
- `legend-voice-api`: Express API for voice session lifecycle
- `legend-voice-agent`: LiveKit Agents worker using OpenAI Realtime
- `legend-postgres`: Postgres storage for mobile-created voice tickets

LiveKit Cloud hosts the realtime voice room. The current AI agent worker is still deployed on Hetzner and registers with LiveKit from there. A cleaner future production setup may move the agent worker into LiveKit Agents Cloud.

### Where The Voice Agent Is Deployed

The current voice agent is:

```text
server/legend-voice-agent.mjs
```

It runs in the Hetzner Docker Compose service:

```text
legend-voice-agent
```

This service starts a LiveKit Agents worker. The worker connects to the LiveKit Cloud project using:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_NAME
OPENAI_API_KEY
OPENAI_REALTIME_MODEL
OPENAI_REALTIME_VOICE
```

When `legend-voice-api` creates a room, it dispatches this registered worker into that room. The agent then joins the LiveKit room as an AI participant and uses OpenAI Realtime to understand and answer the customer by voice.

So the split is:

```text
LiveKit Cloud
  owns the room, WebRTC media, participants, and session lifecycle

Hetzner legend-voice-agent
  runs our custom agent code and connects to LiveKit as a worker

OpenAI Realtime
  performs speech understanding and spoken AI responses
```

The agent is not deployed inside LiveKit Agents Cloud yet. That was a deliberate MVP choice.

Why it is on Hetzner right now:

- fastest path after the frontend and voice API were already deployed there
- one Docker Compose deploy controls frontend, voice API, Postgres, and agent together
- easier to inspect logs through the same Hetzner deployment
- no separate LiveKit agent project layout or CLI deploy was required to prove the product flow
- enough for validating mobile start, AI voice response, support join, lifecycle close, and OpenAI usage stop

Why LiveKit Agents Cloud may be better later:

- the voice worker runs in LiveKit's managed agent runtime
- less operational work on our server
- fewer native WebRTC/runtime dependency issues in our Docker image
- cleaner separation: Hetzner owns LegendDesk/product API, LiveKit owns realtime agent execution
- likely better scaling and lifecycle management for production voice workloads

The practical difference:

```text
Current MVP:
Hetzner runs agent code -> agent connects to LiveKit Cloud room

Future cleaner setup:
LiveKit Agents Cloud runs agent code -> Hetzner only creates rooms/tokens/tickets
```

Both approaches use LiveKit rooms. The difference is where the custom AI worker process lives. Today it lives on our Hetzner server. In LiveKit Agents Cloud it would live in LiveKit's hosted agent runtime.

We should move the agent to LiveKit Agents Cloud after the handoff/product lifecycle is proven, not before. Otherwise we would be mixing product validation with runtime migration work, which is a lovely way to create two problems and debug neither properly.

Relevant files:

```text
server/voice-session-server.mjs      # Express voice API and Postgres persistence
server/legend-voice-agent.mjs        # LiveKit/OpenAI Realtime voice agent
src/pages/MobileVoiceTestPage.tsx    # temporary mobile app simulator
src/pages/TicketDetailPage.tsx       # support-side voice panel and join/end controls
src/voice/voiceSessionApi.ts         # frontend API client for voice endpoints
docker-compose.hetzner.yml           # Hetzner runtime services
Dockerfile.frontend                  # frontend, voice-api, and voice-agent image targets
Caddyfile                            # HTTPS and /api reverse proxy
```

### Voice API Endpoints

The voice API is reverse-proxied under `https://app.legenddesk.com/api`.

Start a support-created voice session from an existing ticket:

```text
POST /api/voice-sessions
```

Start a mobile-originated voice session and create a ticket:

```text
POST /api/mobile-voice-sessions
```

List mobile-originated voice tickets stored in Postgres:

```text
GET /api/mobile-voice-sessions/tickets
```

End a LiveKit room:

```text
POST /api/voice-sessions/end
```

Health check:

```text
GET /healthz
```

Expected healthy response includes:

```json
{
  "ok": true,
  "livekitConfigured": true,
  "databaseConfigured": true,
  "databaseReady": true,
  "statusAssist": {
    "configured": true,
    "agentName": "legend-status-change-assist-agent"
  },
  "agentName": "legend-voice-agent"
}
```

### Mobile Test Page

The temporary mobile-app simulator is:

```text
https://app.legenddesk.com/mobile-voice-test
```

It imitates the iOS/Android app.

Flow:

1. Open `/mobile-voice-test`.
2. Click `Start voice support`.
3. The page sends authenticated mobile app context to `/api/mobile-voice-sessions`.
4. The backend creates a Postgres-backed voice ticket.
5. The backend creates a LiveKit room and dispatches the AI agent.
6. The page joins the room with the `customerToken`.
7. Legend Desk syncs mobile-created voice tickets into the inbox.
8. A support user can open the ticket and click `Join call`.

The page can also join an already-created room when opened with:

```text
/mobile-voice-test?serverUrl=...&token=...&roomName=...&ticketId=...&name=...
```

That path is useful from the `Open customer test` button inside a voice ticket.

### How To Test The Mobile Voice Page

Use this page when you want to test the flow as if the user started support from the real iOS/Android app.

1. Open:

```text
https://app.legenddesk.com/mobile-voice-test
```

2. Click:

```text
Start voice support
```

3. Allow microphone access in the browser.

4. The page should show:

- connection status
- LiveKit room name
- created ticket id
- participant count
- live captions when transcription is published

5. Open Legend Desk in another tab:

```text
https://app.legenddesk.com/views/my-tickets
```

6. Wait up to 5 seconds. The frontend polls:

```text
GET /api/mobile-voice-sessions/tickets
```

The new mobile-created voice ticket should appear in the inbox.

7. Open the ticket and use the voice panel:

- `Join call`: support joins the same LiveKit room as the customer and AI agent
- `Open customer test`: opens the same room as the mobile customer
- `AI resolved`: closes the session as AI-handled
- `Human resolved`: closes the session after support joined or handled the issue
- `Abandoned`: closes the session as abandoned

8. After testing, always end the session with one of the ending actions. This deletes the LiveKit room through:

```text
POST /api/voice-sessions/end
```

This matters because an active LiveKit room can keep the AI voice agent and OpenAI Realtime session alive. Да, это именно тот случай, где забытая тестовая вкладка может тихо жрать деньги, потому что, конечно, голосовой AI не питается святым духом.

If the LiveKit dashboard still shows an active session, copy the room name from the ticket and close it manually:

```bash
curl -X POST https://app.legenddesk.com/api/voice-sessions/end \
  -H 'Content-Type: application/json' \
  -d '{"roomName":"legend-voice_..."}'
```

Expected result:

```json
{
  "ended": true
}
```

If the response includes `alreadyEnded: true`, the room was already gone in LiveKit and the API treated the close as successful.

### Human Handoff

Human handoff means support joins the same LiveKit room where the customer and AI agent already are.

Current behavior:

- the customer starts from the mobile test page
- AI joins first and starts the contextual voice interaction
- the ticket appears in Legend Desk with app context, status, summary, and transcript area
- support can click `Join call`
- support joins the same room as another participant
- support can end the session as `Human resolved`

Why this matters:

- support sees authenticated user context immediately
- support sees current screen, last action, app version, and recent errors
- the user should not need to repeat what app state they were in
- the handoff is a continuation of the same voice session, not a new call

Current limitation: AI-initiated handoff is not fully automated yet. A support user can request or complete handoff from the UI, but the next product step is for the voice agent to trigger a handoff state itself when confidence is low or the user asks for a person.

### Transcript And Summary

The current MVP captures LiveKit transcription events in the frontend while a support user is in the room and syncs them into the ticket's `voiceSession.transcript`.

This is enough to validate the ticket UI and handoff experience, but it is not the final production transcript architecture.

Future production options:

- LiveKit transcription webhooks
- agent callbacks from `legend-voice-agent`
- backend collector service
- direct transcript persistence into Postgres

### Ending Sessions

Voice sessions must be ended explicitly to stop LiveKit/OpenAI usage.

Use one of the ticket actions:

- `AI resolved`
- `Human resolved`
- `Abandoned`

All three call:

```text
POST /api/voice-sessions/end
```

That endpoint deletes the LiveKit room. If the room is already gone, the API treats it as a successful idempotent close and returns `alreadyEnded: true`.

If a session appears stuck in the LiveKit dashboard, use the room name from the ticket and call:

```bash
curl -X POST https://app.legenddesk.com/api/voice-sessions/end \
  -H 'Content-Type: application/json' \
  -d '{"roomName":"legend-voice_..."}'
```

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

## Tester Identification

Tester identification is not authentication. There is no login, password, OAuth, backend, or access control.

The prototype asks first-time users for a lightweight tester profile so PostHog events, contextual feedback, and session replay can be connected to the same tester during validation.

Required fields:

- full name
- email
- role / team

Anonymous mode is intentionally not supported. Tester identity is still local-only and is not authentication.

During prototype validation, the tester profile also acts as the active support agent for local workflow behavior:

- `Assignee: Current user` filters use the tester profile when one exists
- `Assign to me` assigns tickets to the same visible tester identity
- assignee selectors include the active tester agent
- if the tester does not match one of the mock agents, the app creates a local synthetic agent identity from the profile for filtering and assignment

This does not add authentication, authorization, passwords, sessions, or backend identity. It only keeps the visible validation persona and local mock workflow behavior consistent.

Profile storage:

- stored locally in `localStorage`
- key: `legendDeskTesterProfile`
- stable across reloads
- no automatic expiration
- can be reset from the top bar tester profile control

Stored shape:

```ts
type TesterProfile = {
  testerId: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
};
```

The analytics wrapper enriches every `track()` event with tester context when a profile exists:

- `testerId`
- `testerName`
- `testerEmail`
- `testerRole`

Feedback uses the same `track()` path, so `feedback_submitted` events receive tester context automatically.

## Ticket View Semantics

System ticket views are prototype queues, not backend queries. Their filters should still match what a support lead sees on screen.

Operational queues exclude completed tickets unless their purpose is explicitly historical:

- `Urgent` shows active urgent tickets only
- `SLA at risk` shows active tickets that are close to or past SLA targets
- `Solved this week` is the historical solved/closed view for the last seven days

The Reports `Solved this week` KPI uses the same filter as the `Solved this week` system view so the sidebar count and dashboard metric stay aligned during validation.

## Support Workflow Features

The prototype includes support-focused workflow tools. These are intentionally not dashboards or backend systems; they exist to validate how agents handle real tickets day to day.

Status changes can require fixed fields for operational quality. When a required status is selected, the ticket detail opens a status drawer. The frontend sends the current ticket and the fixed field contract to:

```text
POST /api/status-change-assist
```

`legend-status-change-assist-agent` runs in `legend-voice-api` and uses Codex/ChatGPT authorization from `CODEX_AUTH_JSON`; it does not use `OPENAI_API_KEY`. The agent may only return values from the provided field options and known backend signal IDs. If Codex auth is unavailable, the drawer remains manual.

## AI Zendesk Agent

Legend includes a local AI-powered support tester for prototype validation.
The agent uses Playwright to inspect the deployed app and a Codex-authenticated model to act
as a senior Zendesk power user. It writes evidence-backed findings for Codex
triage and prepares a separate fix prompt that should only be used after owner
confirmation.

Run:

```bash
npm run audit:ai:zendesk:prod
```

The runner uses Codex/ChatGPT authorization from `CODEX_HOME/auth.json` or
`CODEX_AUTH_JSON`; API-key auth is rejected. The default model is `gpt-5.5`;
override it with `OPENAI_MODEL` or `--model`. Only `triage` mode is supported
locally right now.

The agent opens `https://app.legenddesk.com`, explores the UI, captures
screenshots, and writes:

- `.legend-ai-audits/latest-ai-summary.md`
- `.legend-ai-audits/latest-ai.md`
- `.legend-ai-audits/latest-ai.json`
- `.legend-ai-audits/latest-ai-codex-prompt.md`
- `.legend-ai-audits/latest-ai-fix-prompt.md`
- `.legend-ai-audits/screenshots/*.png`

This is intentionally a triage-first agent, not an autonomous product owner.
Bagutka can show the short summary in Telegram and ask for confirmation before
routing the fix prompt through Nexus into the `legend` project thread. The fix
prompt instructs Codex to create a new branch from `origin/main`, implement only
safe evidence-backed fixes, update docs when behavior changes, run local checks,
commit, push the branch, and deploy that exact branch to production through the
Hetzner workflow. Main merge and PR creation still require a separate explicit
ask after the deployed branch is reviewed.

Bagutka relays the fix turn progress through explicit milestones:

- `LEGEND FIX STATUS 1/3: code ready`
- `LEGEND FIX STATUS 2/3: code pushed`
- `LEGEND FIX STATUS 3/3: branch deployed`

### Macros

Macros are reusable reply templates for common support situations such as eSIM setup, refunds, payment failures, missing documents, notifications, login reset, known issue acknowledgement, and ticket closure.

Agents can search macros, insert a macro into the relevant reply draft, edit the text before sending, and optionally apply suggested metadata such as tags, status, or project ownership. On App Store or Google Play review tickets, macro insertion fills the review reply composer so the review-specific send action becomes available.

Macro instrumentation helps answer:

- which macros are actually used
- whether agents edit macro text before sending
- whether suggested metadata is useful
- where better templates are needed

Key events:

- `macro_picker_opened`
- `macro_searched`
- `macro_applied`
- `macro_metadata_applied`
- `macro_reply_submitted`

`macro_reply_submitted` includes whether the inserted macro text was edited and a simple changed-length percentage.

### Possible Duplicates

The ticket detail page suggests possible duplicate or related tickets using deterministic prototype logic:

- same topic
- overlapping projects
- nearby release/time window
- same review source

Agents can open a related ticket, link it locally as related, or simulate a merge. Merge simulation does not delete or mutate another ticket; it only records local prototype state on the current ticket.

Key events:

- `duplicates_panel_viewed`
- `related_ticket_opened`
- `ticket_linked_as_related`
- `ticket_merge_mocked`

Future versions may replace this deterministic logic with embeddings or similarity search after the workflow is validated.

### Known Issues

Known issues connect repeated tickets and reviews to active product or operational problems. A matching known issue appears on the ticket detail side panel only when source/platform constraints match and the reported symptom aligns with the known issue topic or issue text. A broad shared project such as Payments is not enough to surface an actionable known issue reply.

Agents can link a ticket to a known issue, apply a suggested known-issue reply into the relevant reply draft, and open a compact details modal with affected projects, topics, linked tickets, and representative items. On App Store or Google Play review tickets, known-issue replies fill the review reply composer rather than the generic public reply composer.

Key events:

- `known_issue_suggested_viewed`
- `ticket_linked_to_known_issue`
- `known_issue_reply_applied`
- `known_issue_details_opened`

This is not incident management. There is no ownership workflow, incident timeline, mitigation tracking, or backend synchronization.

### Prototype Limitations

- no broad production backend for the whole ticketing product
- the voice MVP is the only current backend-backed path
- no real duplicate merging
- no real incident management
- no real ML duplicate detection yet
- known issues and macros are local mock data
- relationship state is mocked and stored locally with tickets
- mobile-originated voice tickets are stored in Postgres, but most non-voice ticket changes are still local prototype state
- if a support user changes a mobile-originated ticket in the UI, those changes currently stay in frontend state and are not written back to Postgres

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
- `macro_picker_opened`
- `macro_metadata_applied`
- `macro_reply_submitted`
- `bulk_action_completed`
- `duplicates_panel_viewed`
- `ticket_linked_as_related`
- `ticket_merge_mocked`
- `known_issue_suggested_viewed`
- `ticket_linked_to_known_issue`
- `known_issue_reply_applied`

Expected properties:

```ts
macro_applied: {
  ticketId: string;
  macroId: string;
  macroName: string;
  category: string;
}

macro_reply_submitted: {
  ticketId: string;
  macroId: string;
  macroName: string;
  wasEdited: boolean;
  changedLengthPercent: number;
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
- `macro_picker`
- `possible_duplicates_panel`
- `known_issue_panel`
- `known_issue_details`
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
  macroId?: string;
  knownIssueId?: string;
  relatedTicketId?: string;
  topicId?: string;
  projectIds?: string[];
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
npm run voice:api    # start the local voice API
npm run voice:agent  # start the local LiveKit/OpenAI voice agent
npm run build    # type-check and build
npm run preview  # preview production build
npm run lint     # run ESLint
```

For local voice testing, run the Vite app and voice API in separate terminals:

```bash
npm run dev
npm run voice:api
```

The local voice API reads `.env.local` and `.env`. Without `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`, it returns mock voice metadata. With LiveKit/OpenAI credentials present, it creates real LiveKit rooms and dispatches the agent.

To run the voice agent locally as well:

```bash
npm run voice:agent
```

## GitHub Pages Deployment

The static prototype can still be deployed to GitHub Pages via GitHub Actions:

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

## Hetzner Deployment

Hetzner is the main live environment for `app.legenddesk.com` and for the voice MVP.

It does not remove the GitHub Pages path, but voice support requires Hetzner because it needs an API, Postgres, LiveKit credentials, and an always-on agent worker.

Current live path:

```text
Browser -> Cloudflare proxy -> Hetzner -> Caddy -> Legend frontend
```

Voice API path:

```text
Browser/mobile test page -> Cloudflare proxy -> Hetzner -> Caddy -> legend-voice-api
```

Production frontend:

```text
https://app.legenddesk.com
```

Cloudflare should use:

```text
SSL/TLS mode: Full (strict)
app.legenddesk.com: Proxied
```

Files:

```text
Dockerfile.frontend
docker-compose.hetzner.yml
Caddyfile
.github/workflows/deploy-hetzner.yml
docs/HETZNER_DEPLOYMENT.md
```

How it works:

1. GitHub Actions builds three Docker images:
   - `ghcr.io/annahrunova/legend-frontend`
   - `ghcr.io/annahrunova/legend-voice-api`
   - `ghcr.io/annahrunova/legend-voice-agent`
2. The images are pushed to GitHub Container Registry.
3. The workflow SSHes into the Hetzner server.
4. Docker Compose pulls and runs frontend, voice API, voice agent, and Postgres.
5. Caddy serves the app, manages HTTPS automatically, and proxies `/api/*` and `/healthz` to `legend-voice-api`.
6. `legend-voice-api` runs its small Postgres migration on startup.
7. `legend-voice-agent` registers with LiveKit and waits for dispatch jobs.
8. The workflow checks `https://app.legenddesk.com` after deployment.

The workflow is manual-only:

```text
GitHub -> Actions -> Deploy to Hetzner -> Run workflow
```

Initial target domain:

```text
app.legenddesk.com
```

The API currently lives under the app domain:

```text
https://app.legenddesk.com/api
```

`api.legenddesk.com` is still reserved for a future split, but it is not needed for the current MVP.

Required runtime environment on Hetzner:

```text
HETZNER_DOMAIN
CADDY_EMAIL
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_NAME
OPENAI_API_KEY
OPENAI_REALTIME_MODEL
OPENAI_REALTIME_VOICE
POSTGRES_PASSWORD
```

The deploy workflow preserves existing `/opt/legend/.env` values. It creates `POSTGRES_PASSWORD` and the default `OPENAI_REALTIME_MODEL=gpt-realtime-2` automatically if missing. Do not print secrets in logs.

Server setup, DNS, and required GitHub secrets are documented in:

```text
docs/HETZNER_DEPLOYMENT.md
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

The voice MVP is the deliberate exception. It has a narrow backend because the product question depends on real realtime behavior:

- can a mobile user start support from inside the app?
- does authenticated app context reduce repeated explanation?
- can AI handle the first part of the conversation?
- can a human support agent join the same room without restarting the interaction?
- do voice sessions close cleanly so LiveKit/OpenAI usage stops?

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
