/// <reference types="node" />
import type { ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'

const DEFAULT_REDDIT_USER_AGENT = 'RedFlix/0.1 by u/redflix_user'
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000

export type CachedRedditResponse = {
  body: string
  contentType: string
  expiresAt: number
  statusCode: number
}

type RedditTokenCache = {
  accessToken: string
  expiresAt: number
}

type RedditCredentials = {
  clientId: string
  clientSecret: string
}

let tokenCache: RedditTokenCache | null = null

const getRedditCredentials = (): RedditCredentials | null => {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim()
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    return null
  }

  return { clientId, clientSecret }
}

const getRedditUserAgent = () =>
  process.env.REDDIT_USER_AGENT?.trim() || DEFAULT_REDDIT_USER_AGENT

const getRedditAccessToken = async () => {
  const credentials = getRedditCredentials()
  if (!credentials) {
    return null
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_EXPIRY_SKEW_MS) {
    return tokenCache.accessToken
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`,
      ).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': getRedditUserAgent(),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(
      `Reddit OAuth failed with ${response.status}: ${responseText.slice(
        0,
        240,
      )}`,
    )
  }

  const payload = JSON.parse(responseText) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token) {
    throw new Error('Reddit OAuth response did not include an access token.')
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }

  return tokenCache.accessToken
}

export const createRedditUrl = (pathname: string) => {
  const baseUrl = getRedditCredentials()
    ? 'https://oauth.reddit.com'
    : 'https://api.reddit.com'

  return new URL(`${baseUrl}${pathname}`)
}

export const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export async function proxyRedditResponse(
  upstream: URL,
  res: ServerResponse,
  responseCache: Map<string, CachedRedditResponse>,
  cacheTtlMs: number,
) {
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
    const accessToken = await getRedditAccessToken()
    const response = await fetch(upstream, {
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        'user-agent': getRedditUserAgent(),
      },
    })

    const body = await response.text()
    const contentType =
      response.headers.get('content-type') ?? 'application/json; charset=utf-8'
    const isRedditNetworkBlock =
      response.status === 403 &&
      /blocked by network security|developer token/i.test(body)

    if (isRedditNetworkBlock) {
      sendJson(res, 403, {
        code: accessToken
          ? 'reddit_oauth_blocked'
          : 'reddit_credentials_required',
        error: accessToken
          ? 'Reddit blocked the authenticated proxy request. Check the Reddit app credentials and user agent in Vercel.'
          : 'Reddit blocked this Vercel deployment. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Vercel, then redeploy.',
      })
      return
    }

    if (response.ok) {
      responseCache.set(cacheKey, {
        body,
        contentType,
        expiresAt: Date.now() + cacheTtlMs,
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
