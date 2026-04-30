# Legend Desk

Frontend-only React/Vite prototype for an internal Zendesk-like support ticketing workflow.

The app uses mocked local data, React Router, TypeScript, plain CSS, and `localStorage` for simple state persistence. There is no backend and no analytics provider yet; important actions call `src/analytics/analytics.ts`, which currently logs events to the console.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173/`.

## Build

```bash
npm run build
```

The production output is written to `dist/`.

## Preview Production Build

```bash
npm run preview
```

## GitHub Pages Deployment

Deployment is configured with GitHub Actions in `.github/workflows/deploy.yml`.

1. Push the repository to GitHub.
2. In GitHub, go to `Settings -> Pages`.
3. Set the source to `GitHub Actions`.
4. Push to the `main` branch or run the workflow manually.

The workflow builds with `GITHUB_PAGES=true`. `vite.config.ts` then sets the Vite `base` path from the repository name in `GITHUB_REPOSITORY`.

If the repository is renamed or deployed under a custom path, check `vite.config.ts` and update the fallback repository name if needed:

```ts
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'legend';
```

The workflow also copies `dist/index.html` to `dist/404.html` so direct React Router URLs work on GitHub Pages.

## Useful Scripts

```bash
npm run dev      # start local Vite dev server
npm run build    # type-check and build
npm run preview  # preview dist build locally
npm run lint     # run ESLint
```

## Prototype Scope

- Ticket inbox with filters, search, sorting, queue views, and bulk actions
- Ticket detail workflow with assignment, status/priority/team changes, tags, replies, notes, timeline, and macros
- Ticket creation flow persisted in `localStorage`
- Customer directory with profile and recent tickets
- Mock reports dashboard
- Mock admin configuration page
- 56 generated mock tickets, 10 customers, 8 agents, 4 teams

To reset local prototype data, clear the browser key `legend.support.tickets.v1` from `localStorage`.
