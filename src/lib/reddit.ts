export type SortMode = 'hot' | 'day' | 'week' | 'month' | 'year' | 'all'
export type MediaFilter = 'both' | 'photos' | 'videos'
export type OrientationFilter = 'both' | 'portrait' | 'landscape'
export type DisplayMode = 'viewer' | 'grid'
export type ViewerItemKind = 'image' | 'video' | 'embed'
export type ViewerItemOrientation =
  | 'portrait'
  | 'landscape'
  | 'square'
  | 'unknown'

export type ViewerItem = {
  key: string
  postId: string
  title: string
  author: string
  subreddit: string
  permalink: string
  over18: boolean
  kind: ViewerItemKind
  mediaUrl: string
  audioUrl: string | null
  posterUrl: string | null
  mediaType: 'photo' | 'video'
  orientation: ViewerItemOrientation
  width: number | null
  height: number | null
  duration: number | null
  sourceHost: string
  galleryIndex: number | null
  galleryTotal: number | null
}

export type ListingPage = {
  after: string | null
  items: ViewerItem[]
}

export type RedditComment = {
  id: string
  author: string
  body: string
  permalink: string
  score: number
}

export type ListingRequest = {
  subreddit: string
  sortMode: SortMode
  after?: string | null
  limit?: number
}

export type UserListingRequest = {
  username: string
  sortMode: SortMode
  after?: string | null
  limit?: number
}

type RedditListing = {
  data?: {
    after?: string | null
    children?: RedditListingChild[]
  }
}

type RedditListingChild = {
  kind?: string
  data?: RedditPost
}

type RedditCommentListing = {
  data?: {
    children?: RedditCommentChild[]
  }
}

type RedditCommentChild = {
  kind?: string
  data?: {
    author?: string
    body?: string
    id?: string
    permalink?: string
    score?: number
  }
}

type RedditGalleryMetadata = {
  m?: string
  s?: {
    u?: string
    mp4?: string
    x?: number
    y?: number
  }
}

type RedditPreviewImage = {
  source?: {
    url?: string
    width?: number
    height?: number
  }
  variants?: {
    mp4?: {
      source?: {
        url?: string
        width?: number
        height?: number
      }
    }
  }
}

type RedditVideoBlock = {
  fallback_url?: string
  dash_url?: string
  has_audio?: boolean
  hls_url?: string
  duration?: number
  width?: number
  height?: number
}

type RedditOEmbed = {
  html?: string
  thumbnail_url?: string
  width?: number
  height?: number
}

type RedditMediaBlock = {
  reddit_video?: RedditVideoBlock
  oembed?: RedditOEmbed
  type?: string
}

type RedditPost = {
  id: string
  title: string
  author: string
  subreddit: string
  permalink: string
  over_18: boolean
  url?: string
  url_overridden_by_dest?: string
  thumbnail?: string
  is_gallery?: boolean
  gallery_data?: {
    items?: Array<{ media_id: string }>
  }
  media_metadata?: Record<string, RedditGalleryMetadata>
  secure_media?: RedditMediaBlock
  media?: RedditMediaBlock
  preview?: {
    images?: RedditPreviewImage[]
    reddit_video_preview?: RedditVideoBlock
  }
  crosspost_parent_list?: RedditPost[]
}

const listingCache = new Map<string, Promise<ListingPage>>()
const commentCache = new Map<string, Promise<RedditComment[]>>()

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|bmp|webp)$/i
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)$/i

export const defaultViewerSettings = {
  displayMode: 'viewer' as DisplayMode,
  mediaFilter: 'both' as MediaFilter,
  orientationFilter: 'both' as OrientationFilter,
  sortMode: 'hot' as SortMode,
  maxDuration: 180,
  hideSeen: false,
  autoAdvance: true,
  muted: false,
  volume: 0.5,
  imageDelaySeconds: 6,
}

export function normalizeViewerSettings(
  value: Partial<typeof defaultViewerSettings> | unknown,
) {
  const parsed =
    value && typeof value === 'object'
      ? (value as Partial<typeof defaultViewerSettings>)
      : {}

  const displayMode: DisplayMode =
    parsed.displayMode === 'grid' || parsed.displayMode === 'viewer'
      ? parsed.displayMode
      : defaultViewerSettings.displayMode

  const mediaFilter: MediaFilter =
    parsed.mediaFilter === 'photos' ||
    parsed.mediaFilter === 'videos' ||
    parsed.mediaFilter === 'both'
      ? parsed.mediaFilter
      : defaultViewerSettings.mediaFilter

  const orientationFilter: OrientationFilter =
    parsed.orientationFilter === 'portrait' ||
    parsed.orientationFilter === 'landscape' ||
    parsed.orientationFilter === 'both'
      ? parsed.orientationFilter
      : defaultViewerSettings.orientationFilter

  const sortMode: SortMode =
    parsed.sortMode === 'day' ||
    parsed.sortMode === 'week' ||
    parsed.sortMode === 'month' ||
    parsed.sortMode === 'year' ||
    parsed.sortMode === 'all' ||
    parsed.sortMode === 'hot'
      ? parsed.sortMode
      : defaultViewerSettings.sortMode

  const maxDuration =
    typeof parsed.maxDuration === 'number' && Number.isFinite(parsed.maxDuration)
      ? Math.min(Math.max(parsed.maxDuration, 10), 300)
      : defaultViewerSettings.maxDuration

  const imageDelaySeconds =
    typeof parsed.imageDelaySeconds === 'number' &&
    Number.isFinite(parsed.imageDelaySeconds)
      ? Math.min(Math.max(parsed.imageDelaySeconds, 1), 60)
      : defaultViewerSettings.imageDelaySeconds

  const volume =
    typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
      ? Math.min(Math.max(parsed.volume, 0), 1)
      : defaultViewerSettings.volume

  return {
    displayMode,
    mediaFilter,
    orientationFilter,
    sortMode,
    maxDuration,
    hideSeen:
      typeof parsed.hideSeen === 'boolean'
        ? parsed.hideSeen
        : defaultViewerSettings.hideSeen,
    autoAdvance:
      typeof parsed.autoAdvance === 'boolean'
        ? parsed.autoAdvance
        : defaultViewerSettings.autoAdvance,
    muted:
      typeof parsed.muted === 'boolean'
        ? parsed.muted
        : defaultViewerSettings.muted,
    volume,
    imageDelaySeconds,
  }
}

export async function fetchSubredditPage(
  request: ListingRequest,
): Promise<ListingPage> {
  const searchParams = createSubredditSearchParams(request)
  const cacheKey = searchParams.toString()
  const cached = listingCache.get(cacheKey)
  if (cached) return cached

  const promise = fetchListingPage(searchParams)

  listingCache.set(cacheKey, promise)
  return promise.catch((error) => {
    listingCache.delete(cacheKey)
    throw error
  })
}

export async function fetchUserPage(
  request: UserListingRequest,
): Promise<ListingPage> {
  const searchParams = createUserSearchParams(request)
  const cacheKey = searchParams.toString()
  const cached = listingCache.get(cacheKey)
  if (cached) return cached

  const promise = fetchListingPage(searchParams)

  listingCache.set(cacheKey, promise)
  return promise.catch((error) => {
    listingCache.delete(cacheKey)
    throw error
  })
}

export async function fetchPostComments(
  postId: string,
  limit = 8,
): Promise<RedditComment[]> {
  const searchParams = new URLSearchParams({
    postId,
    limit: String(limit),
  })
  const cacheKey = searchParams.toString()
  const cached = commentCache.get(cacheKey)
  if (cached) return cached

  const promise = fetch(`/api/reddit/comments?${searchParams}`).then(async (res) => {
    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(
        `Reddit returned ${res.status}. ${errorBody.slice(0, 120).trim()}`,
      )
    }

    const response = (await res.json()) as RedditCommentListing[]
    return normalizeComments(response)
  })

  commentCache.set(cacheKey, promise)
  return promise.catch((error) => {
    commentCache.delete(cacheKey)
    throw error
  })
}

function createSubredditSearchParams(request: ListingRequest) {
  const searchParams = new URLSearchParams({
    kind: 'subreddit',
    name: request.subreddit,
    limit: String(request.limit ?? 40),
    sort: request.sortMode === 'hot' ? 'hot' : 'top',
  })

  if (request.after) {
    searchParams.set('after', request.after)
  }

  if (request.sortMode !== 'hot') {
    searchParams.set('t', request.sortMode)
  }

  return searchParams
}

function createUserSearchParams(request: UserListingRequest) {
  const searchParams = new URLSearchParams({
    kind: 'user',
    name: request.username,
    limit: String(request.limit ?? 40),
    sort: 'top',
    t: request.sortMode === 'hot' ? 'all' : request.sortMode,
  })

  if (request.after) {
    searchParams.set('after', request.after)
  }

  return searchParams
}

function fetchListingPage(searchParams: URLSearchParams) {
  return fetch(`/api/reddit/listing?${searchParams}`).then(async (res) => {
    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(
        `Reddit returned ${res.status}. ${errorBody.slice(0, 120).trim()}`,
      )
    }

    const listing = (await res.json()) as RedditListing
    return normalizeListing(listing)
  })
}

export function warmMediaAsset(item: ViewerItem | undefined) {
  if (!item || typeof window === 'undefined') return

  if (item.posterUrl) {
    const poster = new window.Image()
    poster.src = item.posterUrl
  }

  if (item.kind === 'image') {
    const image = new window.Image()
    image.src = item.mediaUrl
  }
}

function normalizeListing(listing: RedditListing): ListingPage {
  const children = listing.data?.children ?? []
  const items = children.flatMap((child) => {
    if (child.kind !== 't3' || !child.data) return []
    return normalizePost(child.data)
  })

  return {
    after: listing.data?.after ?? null,
    items,
  }
}

function normalizeComments(response: RedditCommentListing[]) {
  const children = response[1]?.data?.children ?? []

  return children.flatMap((child) => {
    const data = child.data
    const id = data?.id?.trim() ?? ''
    const author = data?.author?.trim() ?? ''
    const body = data?.body?.trim() ?? ''

    if (child.kind !== 't1' || !id || !author || !body) return []
    if (body === '[deleted]' || body === '[removed]') return []

    return [
      {
        id,
        author,
        body,
        permalink: data?.permalink
          ? `https://www.reddit.com${data.permalink}`
          : 'https://www.reddit.com',
        score: data?.score ?? 0,
      },
    ]
  })
}

function normalizePost(post: RedditPost): ViewerItem[] {
  const gallerySource = pickSource(
    post,
    (candidate) =>
      candidate.is_gallery === true &&
      !!candidate.gallery_data?.items?.length &&
      !!candidate.media_metadata,
  )

  if (gallerySource) {
    return normalizeGallery(post, gallerySource)
  }

  const videoSource = pickSource(
    post,
    (candidate) =>
      !!candidate.secure_media?.reddit_video ||
      !!candidate.media?.reddit_video ||
      !!candidate.preview?.reddit_video_preview ||
      !!candidate.preview?.images?.[0]?.variants?.mp4?.source?.url,
  )

  if (videoSource) {
    const redditVideo =
      videoSource.secure_media?.reddit_video ??
      videoSource.media?.reddit_video ??
      videoSource.preview?.reddit_video_preview

    const previewVariant =
      videoSource.preview?.images?.[0]?.variants?.mp4?.source ?? null

    const mediaUrl = decodeHtml(
      redditVideo?.fallback_url ?? redditVideo?.hls_url ?? previewVariant?.url ?? '',
    )

    if (mediaUrl) {
      const width = redditVideo?.width ?? previewVariant?.width ?? null
      const height = redditVideo?.height ?? previewVariant?.height ?? null

      return [
        createItem(post, {
          keySuffix: 'video',
          kind: 'video',
          mediaUrl,
          audioUrl: buildRedditAudioUrl(redditVideo),
          posterUrl: resolvePreviewImage(post),
          mediaType: 'video',
          width,
          height,
          duration: redditVideo?.duration ?? null,
          galleryIndex: null,
          galleryTotal: null,
        }),
      ]
    }
  }

  const embedSource = pickSource(
    post,
    (candidate) =>
      !!candidate.secure_media?.oembed?.html || !!candidate.media?.oembed?.html,
  )

  if (embedSource) {
    const oembed = embedSource.secure_media?.oembed ?? embedSource.media?.oembed
    const iframeSrc = extractOembedSrc(oembed?.html ?? '')

    if (iframeSrc) {
      return [
        createItem(post, {
          keySuffix: 'embed',
          kind: 'embed',
          mediaUrl: iframeSrc,
          audioUrl: null,
          posterUrl:
            decodeHtml(oembed?.thumbnail_url ?? '') || resolvePreviewImage(post),
          mediaType: 'video',
          width: oembed?.width ?? resolvePreviewImageSize(post).width,
          height: oembed?.height ?? resolvePreviewImageSize(post).height,
          duration: null,
          galleryIndex: null,
          galleryTotal: null,
        }),
      ]
    }
  }

  const directSource = pickSource(
    post,
    (candidate) => !!candidate.url_overridden_by_dest || !!candidate.url,
  )

  if (!directSource) return []

  const directUrl = decodeHtml(
    directSource.url_overridden_by_dest ?? directSource.url ?? '',
  )

  const normalizedDirect = normalizeExternalMedia(post, directUrl)
  if (!normalizedDirect) return []

  return [
    createItem(post, {
      keySuffix: normalizedDirect.kind,
          kind: normalizedDirect.kind,
          mediaUrl: normalizedDirect.mediaUrl,
          audioUrl: null,
          posterUrl: normalizedDirect.posterUrl ?? resolvePreviewImage(post),
      mediaType: normalizedDirect.mediaType,
      width: normalizedDirect.width ?? resolvePreviewImageSize(post).width,
      height: normalizedDirect.height ?? resolvePreviewImageSize(post).height,
      duration: normalizedDirect.duration ?? null,
      galleryIndex: null,
      galleryTotal: null,
    }),
  ]
}

function normalizeGallery(post: RedditPost, source: RedditPost): ViewerItem[] {
  const items = source.gallery_data?.items ?? []
  const total = items.length

  return items.flatMap((item, index) => {
    const media = source.media_metadata?.[item.media_id]
    if (!media?.s) return []

    const mimeType = media.m ?? ''
    const imageUrl = decodeHtml(media.s.u ?? '')
    const videoUrl = decodeHtml(media.s.mp4 ?? '')
    const width = media.s.x ?? null
    const height = media.s.y ?? null

    if (videoUrl || mimeType.startsWith('video/')) {
      return [
        createItem(post, {
          keySuffix: `gallery-${index + 1}`,
          kind: 'video',
          mediaUrl: videoUrl,
          audioUrl: null,
          posterUrl: imageUrl || resolvePreviewImage(post),
          mediaType: 'video',
          width,
          height,
          duration: null,
          galleryIndex: index + 1,
          galleryTotal: total,
        }),
      ]
    }

    if (!imageUrl) return []

    return [
      createItem(post, {
        keySuffix: `gallery-${index + 1}`,
        kind: 'image',
        mediaUrl: imageUrl,
        audioUrl: null,
        posterUrl: imageUrl,
        mediaType: 'photo',
        width,
        height,
        duration: null,
        galleryIndex: index + 1,
        galleryTotal: total,
      }),
    ]
  })
}

function createItem(
  post: RedditPost,
  input: {
    keySuffix: string
    kind: ViewerItemKind
    mediaUrl: string
    audioUrl: string | null
    posterUrl: string | null
    mediaType: 'photo' | 'video'
    width: number | null
    height: number | null
    duration: number | null
    galleryIndex: number | null
    galleryTotal: number | null
  },
): ViewerItem {
  const sourceHost = getHost(input.mediaUrl)

  return {
    key: `${post.id}:${input.keySuffix}`,
    postId: post.id,
    title: post.title,
    author: post.author,
    subreddit: post.subreddit,
    permalink: `https://www.reddit.com${post.permalink}`,
    over18: post.over_18,
    kind: input.kind,
    mediaUrl: input.mediaUrl,
    audioUrl: input.audioUrl,
    posterUrl: input.posterUrl,
    mediaType: input.mediaType,
    orientation: getOrientation(input.width, input.height),
    width: input.width,
    height: input.height,
    duration: input.duration,
    sourceHost,
    galleryIndex: input.galleryIndex,
    galleryTotal: input.galleryTotal,
  }
}

function buildRedditAudioUrl(video?: RedditVideoBlock | null) {
  if (!video?.has_audio) return null

  const candidate = video.fallback_url ?? video.dash_url ?? video.hls_url
  if (!candidate) return null

  try {
    const url = new URL(decodeHtml(candidate))
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length < 2) return null

    const fileName = pathParts.at(-1) ?? ''
    const audioFileName = fileName.startsWith('DASH_')
      ? 'DASH_AUDIO_128.mp4'
      : 'CMAF_AUDIO_128.mp4'

    pathParts[pathParts.length - 1] = audioFileName
    url.pathname = `/${pathParts.join('/')}`

    if (!url.search) {
      url.searchParams.set('source', 'fallback')
    }

    return url.toString()
  } catch {
    return null
  }
}

function normalizeExternalMedia(post: RedditPost, mediaUrl: string) {
  if (!mediaUrl) return null

  const preview = resolvePreviewImage(post)
  const previewSize = resolvePreviewImageSize(post)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(mediaUrl)
  } catch {
    return null
  }

  const host = parsedUrl.hostname.replace(/^www\./, '')
  const path = parsedUrl.pathname

  if (host === 'imgur.com' || host === 'i.imgur.com') {
    if (path.includes('/a/') || path.includes('/gallery/')) {
      return null
    }

    if (/\.gifv$/i.test(path)) {
      return {
        kind: 'video' as const,
        mediaType: 'video' as const,
        mediaUrl: mediaUrl.replace(/\.gifv$/i, '.mp4'),
        posterUrl: preview,
        width: previewSize.width,
        height: previewSize.height,
        duration: null,
      }
    }

    if (VIDEO_EXTENSIONS.test(path)) {
      return {
        kind: 'video' as const,
        mediaType: 'video' as const,
        mediaUrl,
        posterUrl: preview,
        width: previewSize.width,
        height: previewSize.height,
        duration: null,
      }
    }

    if (IMAGE_EXTENSIONS.test(path)) {
      return {
        kind: 'image' as const,
        mediaType: 'photo' as const,
        mediaUrl,
        posterUrl: mediaUrl,
        width: previewSize.width,
        height: previewSize.height,
        duration: null,
      }
    }

    const imageId = path.split('/').filter(Boolean).pop()
    if (!imageId) return null

    return {
      kind: 'image' as const,
      mediaType: 'photo' as const,
      mediaUrl: `https://i.imgur.com/${imageId}.jpg`,
      posterUrl: `https://i.imgur.com/${imageId}.jpg`,
      width: previewSize.width,
      height: previewSize.height,
      duration: null,
    }
  }

  if (host === 'redgifs.com') {
    const slug = parseRedgifsSlug(path)
    if (!slug) return null

    return {
      kind: 'embed' as const,
      mediaType: 'video' as const,
      mediaUrl: `https://www.redgifs.com/ifr/${slug}`,
      posterUrl: preview,
      width: previewSize.width,
      height: previewSize.height,
      duration: null,
    }
  }

  if (host === 'gfycat.com') {
    const slug = path.split('/').filter(Boolean).pop()
    if (!slug) return null

    return {
      kind: 'embed' as const,
      mediaType: 'video' as const,
      mediaUrl: `https://www.redgifs.com/ifr/${slug}`,
      posterUrl: preview,
      width: previewSize.width,
      height: previewSize.height,
      duration: null,
    }
  }

  if (VIDEO_EXTENSIONS.test(path)) {
    return {
      kind: 'video' as const,
      mediaType: 'video' as const,
      mediaUrl,
      posterUrl: preview,
      width: previewSize.width,
      height: previewSize.height,
      duration: null,
    }
  }

  if (IMAGE_EXTENSIONS.test(path)) {
    return {
      kind: 'image' as const,
      mediaType: 'photo' as const,
      mediaUrl,
      posterUrl: mediaUrl,
      width: previewSize.width,
      height: previewSize.height,
      duration: null,
    }
  }

  return null
}

function pickSource(
  post: RedditPost,
  matcher: (candidate: RedditPost) => boolean,
): RedditPost | null {
  const candidates = [post, ...(post.crosspost_parent_list ?? [])]
  return candidates.find(matcher) ?? null
}

function resolvePreviewImage(post: RedditPost): string | null {
  const source = pickSource(post, (candidate) => !!candidate.preview?.images?.length)
  const imageUrl = source?.preview?.images?.[0]?.source?.url
  if (imageUrl) return decodeHtml(imageUrl)

  if (typeof post.thumbnail === 'string' && post.thumbnail.startsWith('http')) {
    return decodeHtml(post.thumbnail)
  }

  return null
}

function resolvePreviewImageSize(post: RedditPost) {
  const source = pickSource(post, (candidate) => !!candidate.preview?.images?.length)
  return {
    width: source?.preview?.images?.[0]?.source?.width ?? null,
    height: source?.preview?.images?.[0]?.source?.height ?? null,
  }
}

function parseRedgifsSlug(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null
  if (parts[0] !== 'watch' && parts[0] !== 'ifr') return null
  return parts[1]
}

function getHost(mediaUrl: string) {
  try {
    return new URL(mediaUrl).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown'
  }
}

function getOrientation(
  width: number | null,
  height: number | null,
): ViewerItemOrientation {
  if (!width || !height) return 'unknown'
  if (width === height) return 'square'
  return width > height ? 'landscape' : 'portrait'
}

function decodeHtml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
}

function extractOembedSrc(value: string) {
  if (!value) return ''

  const srcMatch = value.match(/src=(?:"|')([^"']+)(?:"|')/i)
  if (!srcMatch?.[1]) return ''

  return normalizeEmbedUrl(decodeHtml(srcMatch[1]))
}

function normalizeEmbedUrl(value: string) {
  return applyEmbedPlaybackPreferences(value, true)
}

export function applyEmbedPlaybackPreferences(value: string, muted: boolean) {
  if (!value) return ''

  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', muted ? '1' : '0')
      url.searchParams.set('playsinline', '1')
      return url.toString()
    }

    if (host === 'player.vimeo.com') {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('muted', muted ? '1' : '0')
      url.searchParams.set('playsinline', '1')
      return url.toString()
    }

    if (host === 'www.dailymotion.com' || host === 'dailymotion.com') {
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', muted ? '1' : '0')
      return url.toString()
    }

    url.searchParams.set('autoplay', '1')
    return url.toString()
  } catch {
    return value
  }
}
