# RedFlix

RedFlix is a private Reddit media viewer built for fast browsing of image, GIF, and video-heavy subreddits in fullscreen, grid, and cinema-style layouts.

## Current Highlights

- SFW home at `/` and a separate NSFW home at `/nsfw`
- Viewer, grid, and cinema browsing modes
- Favorites, followed creators, and followed subreddits
- Comment preview panel with links back to the Reddit thread
- Quick-exit safe cover screen with a return button
- Local homepage curation editor via `Edit home`
- Browser-only persistence with no database or login

## Tech Stack

- React 19
- TypeScript
- Vite
- Vercel serverless proxy for Reddit API requests

## Local Development

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

## Checks

```bash
npm run lint
npm run build
```

## Vercel Deployment

This project is ready to import into Vercel from GitHub.

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Hosted deployments need Reddit API credentials in Vercel:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`

The Reddit listing proxy lives at `api/reddit/listing.ts` and uses shared logic from `server/redditProxy.ts`.

## Documentation

- [Agent guidance](AGENTS.md)
- [Current app state](docs/CURRENT-STATE.md)
- [Deployment and troubleshooting](docs/DEPLOYMENT.md)
- [Homepage curation editor](docs/HOMEPAGE-CURATION.md)
