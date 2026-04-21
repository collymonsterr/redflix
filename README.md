# Redflix

A private Reddit media viewer for browsing image and video feeds in fullscreen, grid, and cinema modes.

## Local Development

```bash
npm install
npm run dev
```

Open the local URL Vite prints in the terminal.

## Build

```bash
npm run lint
npm run build
```

## Vercel

This project is ready to import into Vercel from GitHub.

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

The Reddit JSON proxy is implemented as a Vercel function at `api/reddit/listing.ts`.
