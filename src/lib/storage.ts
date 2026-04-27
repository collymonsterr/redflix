export const storageKeys = {
  audioDefaultsVersion: 'redditp-next:audio-defaults-version',
  followedCreators: 'redditp-next:followed-creators',
  followedSubreddits: 'redditp-next:followed-subreddits',
  homepageCuration: 'redditp-next:homepage-curation',
  privacyLock: 'redditp-next:privacy-lock',
  nsfwEnabled: 'redditp-next:nsfw-enabled',
  savedSubreddits: 'redditp-next:saved-subreddits',
  sessions: 'redditp-next:sessions',
  seenItems: 'redditp-next:seen-items',
  favorites: 'redditp-next:favorites',
  viewerSettings: 'redditp-next:viewer-settings',
} as const

export function loadStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}
