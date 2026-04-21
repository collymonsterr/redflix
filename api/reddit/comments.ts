import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  createRedditUrl,
  proxyRedditResponse,
  sendJson,
  type CachedRedditResponse,
} from '../../server/redditProxy'

const COMMENTS_CACHE_TTL_MS = 10 * 60 * 1000
const responseCache = new Map<string, CachedRedditResponse>()

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

  const upstream = createRedditUrl(`/comments/${postId}`)
  upstream.searchParams.set('raw_json', '1')
  upstream.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 20)))
  upstream.searchParams.set('sort', 'top')
  upstream.searchParams.set('depth', '1')

  await proxyRedditResponse(
    upstream,
    res,
    responseCache,
    COMMENTS_CACHE_TTL_MS,
  )
}
