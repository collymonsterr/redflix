import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'

const REDDIT_USER_AGENT =
  'Mozilla/5.0 (compatible; RedditMediaViewer/0.1; +https://github.com/collymonsterr/redflix)'
const COMMENTS_CACHE_TTL_MS = 10 * 60 * 1000

type CachedResponse = {
  body: string
  contentType: string
  expiresAt: number
  statusCode: number
}

const responseCache = new Map<string, CachedResponse>()

const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const isValidPostId = (value: string) => /^[A-Za-z0-9]{3,16}$/.test(value)

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing request URL.' })
    return
  }

  const requestUrl = new URL(req.url, 'http://localhost')
  const postId = requestUrl.searchParams.get('postId')?.trim() ?? ''
  const limit = Number.parseInt(
    requestUrl.searchParams.get('limit')?.trim() ?? '8',
    10,
  )

  if (!isValidPostId(postId)) {
    sendJson(res, 400, { error: 'Invalid post id.' })
    return
  }

  const upstream = new URL(`https://api.reddit.com/comments/${postId}`)
  upstream.searchParams.set('raw_json', '1')
  upstream.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 20)))
  upstream.searchParams.set('sort', 'top')
  upstream.searchParams.set('depth', '1')

  const cacheKey = upstream.toString()
  const cached = responseCache.get(cacheKey)
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
      responseCache.set(cacheKey, {
        body,
        contentType,
        expiresAt: Date.now() + COMMENTS_CACHE_TTL_MS,
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
