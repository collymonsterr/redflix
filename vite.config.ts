import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const REDDIT_USER_AGENT =
  'Mozilla/5.0 (compatible; RedditMediaViewer/0.1; +local)'
const LISTING_CACHE_TTL_MS = 10 * 60 * 1000

type CachedListingResponse = {
  body: string
  contentType: string
  expiresAt: number
  statusCode: number
}

const listingResponseCache = new Map<string, CachedListingResponse>()

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const isValidSubreddit = (value: string) => /^[A-Za-z0-9_]{2,32}$/.test(value)
const isValidUsername = (value: string) => /^[A-Za-z0-9_-]{2,32}$/.test(value)
const isValidSort = (value: string) => ['hot', 'top'].includes(value)
const isValidTimeWindow = (value: string) =>
  ['day', 'week', 'month', 'year', 'all'].includes(value)

const redditApiMiddleware = async (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => {
  if (!req.url) {
    next()
    return
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  if (requestUrl.pathname !== '/api/reddit/listing') {
    next()
    return
  }

  const kind = requestUrl.searchParams.get('kind')?.trim() ?? 'subreddit'
  const name =
    requestUrl.searchParams.get('name')?.trim() ??
    requestUrl.searchParams.get('subreddit')?.trim() ??
    ''
  const sort = requestUrl.searchParams.get('sort')?.trim() ?? 'hot'
  const timeWindow = requestUrl.searchParams.get('t')?.trim() ?? ''
  const after = requestUrl.searchParams.get('after')?.trim() ?? ''
  const limit = Number.parseInt(
    requestUrl.searchParams.get('limit')?.trim() ?? '40',
    10,
  )

  if (kind !== 'subreddit' && kind !== 'user') {
    sendJson(res, 400, { error: 'Invalid listing kind.' })
    return
  }

  if (kind === 'subreddit' && !isValidSubreddit(name)) {
    sendJson(res, 400, { error: 'Invalid subreddit name.' })
    return
  }

  if (kind === 'user' && !isValidUsername(name)) {
    sendJson(res, 400, { error: 'Invalid username.' })
    return
  }

  if (!isValidSort(sort)) {
    sendJson(res, 400, { error: 'Invalid sort value.' })
    return
  }

  if (timeWindow && !isValidTimeWindow(timeWindow)) {
    sendJson(res, 400, { error: 'Invalid time window.' })
    return
  }

  const upstream =
    kind === 'user'
      ? new URL(`https://www.reddit.com/user/${name}/submitted/.json`)
      : new URL(`https://www.reddit.com/r/${name}/${sort}.json`)
  upstream.searchParams.set('raw_json', '1')
  upstream.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 100)))

  if (after) {
    upstream.searchParams.set('after', after)
  }

  if (kind === 'user') {
    upstream.searchParams.set('sort', 'top')
    upstream.searchParams.set('t', timeWindow || 'all')
  } else if (sort === 'top' && timeWindow) {
    upstream.searchParams.set('t', timeWindow)
  }

  const cacheKey = upstream.toString()
  const cached = listingResponseCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    res.statusCode = cached.statusCode
    res.setHeader('Content-Type', cached.contentType)
    res.setHeader('X-Reddit-Cache', 'HIT')
    res.end(cached.body)
    return
  }

  try {
    const response = await fetch(upstream, {
      headers: {
        'user-agent': REDDIT_USER_AGENT,
      },
    })

    const body = await response.text()
    const contentType =
      response.headers.get('content-type') ?? 'application/json; charset=utf-8'

    if (response.ok) {
      listingResponseCache.set(cacheKey, {
        body,
        contentType,
        expiresAt: Date.now() + LISTING_CACHE_TTL_MS,
        statusCode: response.status,
      })
    } else if (response.status === 429 && cached) {
      res.statusCode = cached.statusCode
      res.setHeader('Content-Type', cached.contentType)
      res.setHeader('X-Reddit-Cache', 'STALE')
      res.end(cached.body)
      return
    }

    res.statusCode = response.status
    res.setHeader('Content-Type', contentType)
    res.end(body)
  } catch (error) {
    sendJson(res, 502, {
      error: 'Failed to reach Reddit.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const redditApiPlugin = () => ({
  name: 'reddit-api-middleware',
  configureServer(server: {
    middlewares: {
      use: (
        handler: (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void,
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use((req, res, next) => {
      void redditApiMiddleware(req, res, next)
    })
  },
  configurePreviewServer(server: {
    middlewares: {
      use: (
        handler: (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void,
        ) => void,
      ) => void
    }
  }) {
    server.middlewares.use((req, res, next) => {
      void redditApiMiddleware(req, res, next)
    })
  },
})

export default defineConfig({
  plugins: [react(), redditApiPlugin()],
})
