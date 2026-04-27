# Deployment

This project is built as a static Vite app plus a Vercel serverless function for Reddit listing requests.

## Local Run

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run lint
npm run build
```

## Vercel Setup

Use these settings when importing the repo into Vercel:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

## Required Environment Variables

Hosted deployments need Reddit API credentials:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`

Recommended user agent format:

```text
RedFlix/0.1 by u/your_reddit_username
```

If `REDDIT_USER_AGENT` is missing, the proxy falls back to a generic placeholder user agent. Production should still always set the real environment variable.

## How the Reddit Proxy Works

- `api/reddit/listing.ts` validates incoming requests and builds the upstream Reddit URL.
- `server/redditProxy.ts` handles OAuth token fetching, request forwarding, and short-lived response caching.
- With credentials present, the proxy uses `oauth.reddit.com`.
- Without credentials, it falls back to `api.reddit.com`, which is more likely to be blocked on hosted platforms.
- The client-side listing, comment, and preview request caches are bounded so they do not grow forever during long sessions.

## Common Problems

### 403 on Vercel

Usually means Reddit blocked the hosted request.

Check:

- the Vercel project has all three environment variables
- the Reddit client ID and secret are correct
- the Reddit app still has valid access for this use case

### 401 during OAuth

Usually means the Reddit credentials are wrong or expired.

Check:

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- the Reddit app still exists and has not been rotated

### 429 Too Many Requests

This means Reddit rate-limited the current fetch pattern.

Notes:

- the proxy caches listing responses for a short period
- some views may fall back to cached results when possible
- very aggressive homepage fetching can still hit rate limits

### Missing Thumbnails

Usually one of these:

- the subreddit request failed upstream
- Reddit returned a post without a usable preview
- the proxy was blocked and the frontend fell back to placeholders

## Operational Notes

- All user state is browser-local. Vercel deployment does not create shared accounts or cloud sync.
- Deploying a new build does not erase a user's local favorites, follows, or homepage curation.
- If a deployment looks correct locally but broken on Vercel, check the proxy response before debugging the frontend.
