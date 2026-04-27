# RedFlix Agent Guide

This file is for Codex, Claude Code, and any other coding agent working in this repo.

## Project Summary

RedFlix is a private Reddit media viewer focused on:

- fast browsing
- fullscreen media viewing
- grid and cinema-style discovery
- separate SFW and NSFW home experiences
- local-only persistence with no user accounts or backend database

## Core Product Rules

- `/` must stay the default SFW homepage.
- `/nsfw` is the explicit NSFW homepage.
- Do not mix SFW and NSFW homepage suggestions by default.
- Keep the UI visually clean and compact. Avoid adding heavy explanatory copy in the interface.
- Fullscreen should prioritize media, not chrome.
- LocalStorage is the main persistence layer unless the user explicitly asks for something more complex.

## Important Current Features

- Viewer, grid, and cinema modes
- Favorites
- Followed creators
- Followed subreddits
- Comment preview panel
- Quick-exit safe-cover screen with return path
- Homepage curation editor via `Edit home`

## Deployment Notes

- Frontend is Vite.
- Hosted Reddit requests go through the Vercel function in `api/reddit/listing.ts`.
- Shared proxy logic lives in `server/redditProxy.ts`.
- Production relies on:
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`
  - `REDDIT_USER_AGENT`

## Local State

Key browser-local state includes:

- favorites
- followed creators
- followed subreddits
- saved subreddits
- sessions / continue watching
- seen items
- viewer settings
- homepage curation
- NSFW state
- privacy lock

## Editing Preferences

- Prefer focused fixes over broad refactors unless the user asks for restructuring.
- Preserve the existing look and feel unless the task is specifically design-related.
- Avoid changing unrelated files.
- Do not add tests unless the user asks.
- Keep comments brief and high signal.

## Documentation Rule

When a change affects product behavior, deployment, operations, routes, storage, or editor/admin workflows:

- update the relevant Markdown files before pushing
- keep `README.md` accurate
- keep `docs/CURRENT-STATE.md` accurate for user-visible behavior
- keep `docs/DEPLOYMENT.md` accurate for hosting and Reddit proxy changes
- keep `docs/HOMEPAGE-CURATION.md` accurate when homepage editing changes

If a pushed change does not require doc updates, verify that explicitly before pushing.

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
```
