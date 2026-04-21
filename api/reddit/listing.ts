/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  createRedditUrl,
  proxyRedditResponse,
  sendJson,
  type CachedRedditResponse,
} from '../../server/redditProxy.js'

const LISTING_CACHE_TTL_MS = 10 * 60 * 1000
const listingResponseCache = new Map<string, CachedRedditResponse>()

const isValidSubreddit = (value: string) => /^[A-Za-z0-9_]{2,32}$/.test(value)
const isValidUsername = (value: string) => /^[A-Za-z0-9_-]{2,32}$/.test(value)
const isValidSort = (value: string) => ['hot', 'top'].includes(value)
const isValidTimeWindow = (value: string) =>
  ['day', 'week', 'month', 'year', 'all'].includes(value)

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing request URL.' })
    return
  }

  const requestUrl = new URL(req.url, 'http://localhost')
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
      ? createRedditUrl(`/user/${name}/submitted`)
      : createRedditUrl(`/r/${name}/${sort}`)
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

  await proxyRedditResponse(
    upstream,
    res,
    listingResponseCache,
    LISTING_CACHE_TTL_MS,
  )
}
