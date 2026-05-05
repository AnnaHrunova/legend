# AGENTS.md

## 🚫 Primary Rule

This is NOT a production system.  
This is a frontend-only prototype for validating UX and user behavior.

DO NOT turn this into a full Zendesk clone.

---

## 🎯 Goal

The only goal of this project:

UX → Behavior → Insights → Backend Design

Everything in this repository must support this pipeline.

---

## 🧠 Product Scope Discipline

Before implementing anything, ask:

1. Is this based on observed user behavior?
2. Does this support an existing validated workflow?
3. Is this required to answer a product question?

If any answer is “no” → DO NOT IMPLEMENT.

---

## 📊 Analytics (CRITICAL)

All tracking MUST go through:

src/analytics/analytics.ts

### Hard rules

- NEVER call PostHog directly
- NEVER import posthog in UI components
- ALWAYS use:

track(eventName, properties)

---

## 🧪 Tester Identification

Tester identification is prototype-only.

### Rules

- DO NOT add authentication
- DO NOT add anonymous tester mode
- DO NOT add passwords, OAuth, or backend identity
- keep tester profile storage in `localStorage`
- required tester fields are full name, email, and role/team
- enrich events centrally through `src/analytics/analytics.ts`

---

## 📉 Event Model Rules

### Allowed

Semantic events:
- ticket_opened
- ticket_status_changed
- ticket_assignee_changed

### Forbidden

UI noise:
- button_clicked
- div_clicked
- generic click tracking

### Adding events

Before adding a new event:
- check if it already exists
- prefer adding properties instead of new events

---

## 💬 Feedback System (STRICT)

Single event:

track("feedback_submitted", {...})

### DO NOT:

- create multiple feedback events
- invent event names like:
    - ticket_feedback_submitted
    - ui_feedback

### ALWAYS use:

{
text,
context,
path,
ticketId?,
viewId?
}

---

## 🧩 Feedback Context System

Contexts are defined in:

src/analytics/feedbackContexts.ts

### Rules

- DO NOT invent random context names
- DO NOT use component names like Button123 or DivWrapper

### Use only semantic contexts:

- ticket_status_selector
- ticket_reply_box
- ticket_filters
- ticket_list
- sidebar_navigation

### If new context is needed:
- add it centrally in feedbackContexts.ts
- keep naming consistent

---

## 🚫 Backend Rules

This is a frontend prototype.

### DO NOT:

- add real API calls
- remove MSW
- introduce databases
- simulate backend logic deeply

### Allowed:

- simple mocks
- fake responses
- local state

---

## 🧱 Architecture Constraints

### DO NOT introduce:

- Redux
- Zustand
- GraphQL
- complex state layers
- microservices concepts

### Use:

- simple React state
- small local stores if needed

---

## 🎨 UI Rules

- prioritize clarity over completeness
- keep UI simple
- avoid feature overload
- remove instead of adding
- do not reintroduce a separate platform dropdown unless explicitly requested
- do not turn Topics Heatmap into a generic KPI/Grafana dashboard
- keep the heatmap as the primary artifact; avoid executive summary widgets unless explicitly requested

---

## 🧰 Support Workflow Features

Macros, possible duplicates, related tickets, and known issues are allowed only when they help validate ticket handling.

### Rules

- do not turn Known Issues into a full incident management system unless explicitly requested
- do not implement real duplicate merging in the prototype
- do not add backend APIs for workflow features
- do not add direct PostHog calls in workflow components
- all workflow tracking must go through `analytics.track()`
- keep workflow UI on ticket detail focused on daily support actions

---

## 🔁 State Changes

All important user actions MUST:

1. update UI state
2. call track()

Example:

onStatusChange() {
updateState()
track("ticket_status_changed", {...})
}

---

## 🔍 Funnels & Validation

This project depends on:

- funnels (PostHog)
- session replay
- feedback events

### DO NOT:

- remove tracked steps
- rename events casually
- break flows

---

## ⚠️ Dangerous Changes

Be extremely careful with:

- event names
- analytics.track usage
- navigation flows
- feedback contexts

These break data analysis.

---

## 🧪 Safe Changes

Allowed:

- UI improvements
- bug fixes
- clarity improvements
- better tracking properties

---

## 🛑 Feature Addition Checklist

Before adding ANY feature:

- Is it visible in analytics?
- Did users try to do it?
- Is there feedback about it?

If not → DO NOT ADD.

---

## 📦 Build Requirements

All changes MUST:

- build successfully
- not break GitHub Pages
- not break analytics
- not remove tracking

---

## 🧭 Guiding Principle

This is not a product.

This is a tool to learn what the product should be.

---

## ❌ Anti-Patterns

Avoid:

- “let’s make it like Zendesk”
- adding advanced automation
- adding workflow engines
- adding unused features
- guessing user needs

---

## ✅ Correct Approach

- observe behavior
- measure with events
- validate with funnels
- confirm with feedback
- THEN design backend

---

## 🧨 Final Rule

If you are unsure:

DO LESS.

Not more.
