import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
} from 'react'
import { flushSync } from 'react-dom'
import './App.css'
import {
  curatedNsfwCinemaSources,
  defaultHomepageCurationConfig,
  type CuratedSection,
  type HomepageCurationConfig,
  type LandscapeVideoShowcase,
  type TextSubredditSection,
} from './data/curated'
import {
  applyEmbedPlaybackPreferences,
  defaultViewerSettings,
  type DisplayMode,
  fetchPostComments,
  fetchSubredditPage,
  fetchUserPage,
  normalizeViewerSettings,
  warmMediaAsset,
  type ListingPage,
  type MediaFilter,
  type OrientationFilter,
  type RedditComment,
  type SortMode,
  type ViewerItem,
} from './lib/reddit'
import {
  loadStoredValue,
  saveStoredValue,
  storageKeys,
} from './lib/storage'
import { LruCache } from './lib/lruCache'

type Route =
  | {
      kind: 'home'
      nsfw: boolean
    }
  | { kind: 'favorites' }
  | { kind: 'cinema' }
  | { kind: 'following-creators' }
  | { kind: 'following-subreddits' }
  | {
      kind: 'subreddit'
      subreddit: string
    }
  | {
      kind: 'author'
      author: string
    }

type ViewerSettings = typeof defaultViewerSettings

type ViewerSession = {
  subreddit: string
  index: number
  title: string
  posterUrl: string | null
  updatedAt: number
  over18?: boolean
}

type ViewerSessions = Record<string, ViewerSession>
type FavoriteEntry = {
  item: ViewerItem
  favoritedAt: number
  tags: string[]
}
type FavoriteEntries = Record<string, FavoriteEntry>
type PrivacyLockConfig = {
  secretHash: string
  hint: string
}
type QuickExitSnapshot = {
  nsfwEnabled: boolean
  path: string
  scrollY: number
}
type PrivacyDialogMode = 'closed' | 'setup' | 'manage'
type OpenSubredditOptions = {
  displayMode?: DisplayMode
  mediaFilter?: MediaFilter
  orientationFilter?: OrientationFilter
  sortMode?: SortMode
  autoAdvance?: boolean
}
type OpenAuthorOptions = {
  displayMode?: DisplayMode
  mediaFilter?: MediaFilter
  orientationFilter?: OrientationFilter
  sortMode?: SortMode
}

const MAX_PREVIEW_REQUESTS = 1
const PREVIEW_ROOT_MARGIN = '240px 0px'
const previewRequestQueue: Array<() => Promise<void>> = []
const subredditPreviewCache = new LruCache<string, Promise<ListingPage>>(120)
const supplementalNsfwSubreddits = new Set(['petite'])
let knownNsfwSubreddits = buildKnownNsfwSet(defaultHomepageCurationConfig)
let activePreviewRequests = 0

function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname))
  const [privacyLock, setPrivacyLock] = usePersistentState<PrivacyLockConfig | null>(
    storageKeys.privacyLock,
    null,
  )
  const [audioDefaultsVersion, setAudioDefaultsVersion] = usePersistentState<number>(
    storageKeys.audioDefaultsVersion,
    0,
  )
  const [isUnlocked, setIsUnlocked] = useState(
    () => !loadStoredValue<PrivacyLockConfig | null>(storageKeys.privacyLock, null),
  )
  const [isCurationEditorOpen, setIsCurationEditorOpen] = useState(false)
  const [isQuickExitActive, setIsQuickExitActive] = useState(false)
  const [quickExitSnapshot, setQuickExitSnapshot] = useState<QuickExitSnapshot | null>(
    null,
  )
  const [privacyDialogMode, setPrivacyDialogMode] =
    useState<PrivacyDialogMode>('closed')
  const [storedNsfwEnabled, setStoredNsfwEnabled] = usePersistentState<boolean>(
    storageKeys.nsfwEnabled,
    false,
  )
  const [followedCreators, setFollowedCreators] = usePersistentState<string[]>(
    storageKeys.followedCreators,
    [],
  )
  const [followedSubreddits, setFollowedSubreddits] = usePersistentState<string[]>(
    storageKeys.followedSubreddits,
    [],
  )
  const [savedSubreddits, setSavedSubreddits] = usePersistentState<string[]>(
    storageKeys.savedSubreddits,
    ['pics', 'gifs', 'aww'],
  )
  const [sessions, setSessions] = usePersistentState<ViewerSessions>(
    storageKeys.sessions,
    {},
  )
  const [favorites, setFavorites] = usePersistentState<FavoriteEntries>(
    storageKeys.favorites,
    {},
  )
  const [seenItems, setSeenItems] = usePersistentState<string[]>(
    storageKeys.seenItems,
    [],
  )
  const [viewerSettings, setViewerSettings] = usePersistentState<ViewerSettings>(
    storageKeys.viewerSettings,
    defaultViewerSettings,
    normalizeViewerSettings,
  )
  const [homepageCuration, setHomepageCuration] = usePersistentState<HomepageCurationConfig>(
    storageKeys.homepageCuration,
    defaultHomepageCurationConfig,
    normalizeHomepageCurationConfig,
  )
  const nsfwEnabled = route.kind === 'home' ? route.nsfw : storedNsfwEnabled

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRoute(window.location.pathname))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (route.kind !== 'home') return
    setStoredNsfwEnabled(route.nsfw)
  }, [route, setStoredNsfwEnabled])

  useEffect(() => {
    syncKnownNsfwSubreddits(homepageCuration)
  }, [homepageCuration])

  useEffect(() => {
    if (audioDefaultsVersion >= 1) return

    setViewerSettings((current) => ({
      ...current,
      muted: false,
      volume:
        typeof current.volume === 'number' && Number.isFinite(current.volume)
          ? Math.min(Math.max(current.volume, 0), 1)
          : 0.5,
    }))
    setAudioDefaultsVersion(1)
  }, [audioDefaultsVersion, setAudioDefaultsVersion, setViewerSettings])

  const continueWatching = useMemo(
    () =>
      Object.values(sessions)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 10),
    [sessions],
  )
  const favoriteCount = Object.keys(favorites).length
  const followedCreatorCount = followedCreators.length
  const followedSubredditCount = followedSubreddits.length

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setRoute(parseRoute(path))
  }

  const navigateHome = useCallback(() => {
    navigateTo(nsfwEnabled ? '/nsfw' : '/')
  }, [nsfwEnabled])

  const setNsfwMode = useCallback(
    (nextValue: boolean) => {
      setStoredNsfwEnabled(nextValue)

      if (route.kind === 'home') {
        navigateTo(nextValue ? '/nsfw' : '/')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [route.kind, setStoredNsfwEnabled],
  )

  const toggleNsfw = useCallback(() => {
    setNsfwMode(!nsfwEnabled)
  }, [nsfwEnabled, setNsfwMode])

  const resetCinemaPresetIfNeeded = (current: ViewerSettings) =>
    route.kind === 'cinema'
      ? {
          ...current,
          mediaFilter: defaultViewerSettings.mediaFilter,
          orientationFilter: defaultViewerSettings.orientationFilter,
          sortMode: defaultViewerSettings.sortMode,
          autoAdvance: defaultViewerSettings.autoAdvance,
        }
      : current

  const openBrowseTarget = (value: string) => {
    const target = parseBrowseTarget(value)
    if (!target) return

    if (target.kind === 'author') {
      openAuthor(target.author)
      return
    }

    openSubreddit(target.subreddit, {
      displayMode: 'grid',
    })
  }

  const openSubreddit = (value: string, options?: OpenSubredditOptions) => {
    const subreddit = normalizeSubredditInput(value)
    if (!subreddit) return

    const nextDisplayMode = options?.displayMode ?? 'grid'
    setViewerSettings((current) => {
      const base = resetCinemaPresetIfNeeded(current)
      const isPresetOpen =
        options?.mediaFilter ||
        options?.orientationFilter ||
        options?.sortMode ||
        typeof options?.autoAdvance === 'boolean'

      return {
        ...base,
        displayMode: nextDisplayMode,
        mediaFilter: options?.mediaFilter ?? defaultViewerSettings.mediaFilter,
        orientationFilter:
          options?.orientationFilter ?? defaultViewerSettings.orientationFilter,
        sortMode: options?.sortMode ?? defaultViewerSettings.sortMode,
        autoAdvance: options?.autoAdvance ?? defaultViewerSettings.autoAdvance,
        hideSeen: isPresetOpen ? base.hideSeen : defaultViewerSettings.hideSeen,
        maxDuration: isPresetOpen ? base.maxDuration : defaultViewerSettings.maxDuration,
      }
    })

    setSavedSubreddits((current) => insertUniqueSubreddit(current, subreddit))
    navigateTo(`/r/${subreddit}`)
  }

  const openAuthor = (value: string, options?: OpenAuthorOptions) => {
    const author = normalizeAuthorInput(value)
    if (!author) return

    if (
      options?.displayMode ||
      options?.mediaFilter ||
      options?.orientationFilter ||
      options?.sortMode ||
      route.kind === 'cinema'
    ) {
      setViewerSettings((current) => ({
        ...resetCinemaPresetIfNeeded(current),
        displayMode: options?.displayMode ?? current.displayMode,
        mediaFilter: options?.mediaFilter ?? current.mediaFilter,
        orientationFilter: options?.orientationFilter ?? current.orientationFilter,
        sortMode: options?.sortMode ?? current.sortMode,
      }))
    }

    navigateTo(`/u/${author}`)
  }

  const openFavorites = () => {
    setViewerSettings((current) => ({
      ...resetCinemaPresetIfNeeded(current),
      displayMode: 'grid',
    }))
    navigateTo('/favorites')
  }

  const openFollowingCreators = () => {
    setViewerSettings((current) => ({
      ...resetCinemaPresetIfNeeded(current),
      displayMode: 'grid',
    }))
    navigateTo('/following/creators')
  }

  const openFollowingSubreddits = () => {
    setViewerSettings((current) => ({
      ...resetCinemaPresetIfNeeded(current),
      displayMode: 'grid',
    }))
    navigateTo('/following/subreddits')
  }

  const openCinema = () => {
    setStoredNsfwEnabled(true)
    setViewerSettings((current) => ({
      ...current,
      displayMode: 'viewer',
      mediaFilter: 'videos',
      orientationFilter: 'landscape',
      sortMode: 'hot',
      autoAdvance: true,
    }))
    navigateTo('/cinema')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openLandscapeSubreddit = (value: string) => {
    openSubreddit(value, {
      displayMode: 'viewer',
      mediaFilter: 'videos',
      orientationFilter: 'landscape',
      sortMode: 'hot',
      autoAdvance: true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openPortraitSubreddit = (value: string) => {
    openSubreddit(value, {
      displayMode: 'viewer',
      mediaFilter: 'videos',
      orientationFilter: 'portrait',
      sortMode: 'hot',
      autoAdvance: true,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openPrivacyDialog = () => {
    setPrivacyDialogMode(privacyLock ? 'manage' : 'setup')
  }

  const handleSaveHomepageCuration = (nextConfig: HomepageCurationConfig) => {
    setHomepageCuration(nextConfig)
    setIsCurationEditorOpen(false)
  }

  const activateQuickExit = useCallback(() => {
    setQuickExitSnapshot({
      path: buildPathForRoute(route),
      nsfwEnabled,
      scrollY: window.scrollY,
    })
    setIsQuickExitActive(true)
    setPrivacyDialogMode('closed')

    window.requestAnimationFrame(() => {
      setStoredNsfwEnabled(false)
      navigateTo('/')
      window.scrollTo({ top: 0 })
      void exitFullscreenIfNeeded()
    })
  }, [nsfwEnabled, route, setStoredNsfwEnabled])

  const openSafeHomeFromQuickExit = useCallback(() => {
    setQuickExitSnapshot(null)
    setIsQuickExitActive(false)
    setStoredNsfwEnabled(false)
    navigateTo('/')
    window.scrollTo({ top: 0 })
  }, [setStoredNsfwEnabled])

  const returnFromQuickExit = useCallback(() => {
    if (!quickExitSnapshot) {
      setIsQuickExitActive(false)
      return
    }

    setStoredNsfwEnabled(quickExitSnapshot.nsfwEnabled)
    setIsQuickExitActive(false)
    navigateTo(quickExitSnapshot.path)

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: quickExitSnapshot.scrollY })
    })
  }, [quickExitSnapshot, setStoredNsfwEnabled])

  const updateSession = (subreddit: string, nextSession: ViewerSession) => {
    setSessions((current) => ({
      ...current,
      [toSessionKey(subreddit)]: nextSession,
    }))
  }

  const markSeen = (itemKey: string) => {
    setSeenItems((current) => {
      if (current.includes(itemKey)) return current
      return [itemKey, ...current].slice(0, 1500)
    })
  }

  const toggleFavorite = (item: ViewerItem) => {
    setFavorites((current) => {
      if (current[item.key]) {
        const next = { ...current }
        delete next[item.key]
        return next
      }

      return {
        ...current,
        [item.key]: {
          item,
          favoritedAt: Date.now(),
          tags: [],
        },
      }
    })
  }

  const updateFavoriteTags = (itemKey: string, tags: string[]) => {
    setFavorites((current) => {
      const entry = current[itemKey]
      if (!entry) return current

      return {
        ...current,
        [itemKey]: {
          ...entry,
          tags,
        },
      }
    })
  }

  const toggleFollowCreator = (value: string) => {
    const author = normalizeAuthorInput(value)
    if (!author) return

    setFollowedCreators((current) => toggleFollowedValue(current, author))
  }

  const toggleFollowSubreddit = (value: string) => {
    const subreddit = normalizeSubredditInput(value)
    if (!subreddit) return

    setFollowedSubreddits((current) => toggleFollowedValue(current, subreddit))
  }

  const handleSetupPrivacyLock = async ({
    hint,
    secret,
  }: {
    hint: string
    secret: string
  }) => {
    const secretHash = await hashSecret(secret)
    setPrivacyLock({
      secretHash,
      hint,
    })
    setIsUnlocked(true)
    setPrivacyDialogMode('closed')
  }

  const handleDisablePrivacyLock = async (secret: string) => {
    if (!privacyLock) return false

    const secretHash = await hashSecret(secret)
    if (secretHash !== privacyLock.secretHash) {
      return false
    }

    setPrivacyLock(null)
    setIsUnlocked(true)
    setPrivacyDialogMode('closed')
    return true
  }

  const handleUnlock = async (secret: string) => {
    if (!privacyLock) {
      setIsUnlocked(true)
      return true
    }

    const secretHash = await hashSecret(secret)
    if (secretHash !== privacyLock.secretHash) {
      return false
    }

    setIsUnlocked(true)
    return true
  }

  const handleLockNow = () => {
    if (!privacyLock) return
    setPrivacyDialogMode('closed')
    setIsUnlocked(false)
  }

  useEffect(() => {
    if (!isUnlocked) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      activateQuickExit()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activateQuickExit, isUnlocked])

  return (
    <div className="app-shell">
      {isQuickExitActive ? (
        <QuickExitScreen
          canReturn={Boolean(quickExitSnapshot)}
          onOpenSafeHome={openSafeHomeFromQuickExit}
          onReturnToPrevious={returnFromQuickExit}
        />
      ) : privacyLock && !isUnlocked ? (
        <LockScreen hint={privacyLock.hint} onUnlock={handleUnlock} />
      ) : (
        <>
          {route.kind === 'home' ? (
            <LandingPage
              continueWatching={continueWatching}
              favoriteCount={favoriteCount}
              followedCreatorCount={followedCreatorCount}
              followedSubredditCount={followedSubredditCount}
              hasPrivacyLock={Boolean(privacyLock)}
              homepageCuration={homepageCuration}
              nsfwEnabled={nsfwEnabled}
              savedSubreddits={savedSubreddits}
              seenCount={seenItems.length}
              sessions={sessions}
              onOpenBrowseTarget={openBrowseTarget}
              onOpenCinema={openCinema}
              onOpenFavorites={openFavorites}
              onOpenFollowingCreators={openFollowingCreators}
              onOpenFollowingSubreddits={openFollowingSubreddits}
              onOpenLandscapeSubreddit={openLandscapeSubreddit}
              onOpenPortraitSubreddit={openPortraitSubreddit}
              onOpenCurationEditor={() => setIsCurationEditorOpen(true)}
              onOpenPrivacyDialog={openPrivacyDialog}
              onOpenSubreddit={openSubreddit}
              onToggleNsfw={toggleNsfw}
            />
          ) : (
            <ViewerPage
              key={`${buildRouteKey(route)}:${viewerSettings.sortMode}`}
              initialSession={
                route.kind === 'subreddit'
                  ? sessions[toSessionKey(route.subreddit)]
                  : undefined
              }
              followedCreators={followedCreators}
              followedSubreddits={followedSubreddits}
              route={route}
              favorites={favorites}
              hasPrivacyLock={Boolean(privacyLock)}
              nsfwEnabled={nsfwEnabled}
              seenItems={seenItems}
              settings={viewerSettings}
              onBack={navigateHome}
              onOpenFavorites={openFavorites}
              onOpenFollowingCreators={openFollowingCreators}
              onOpenFollowingSubreddits={openFollowingSubreddits}
              onOpenAuthor={openAuthor}
              onOpenBrowseTarget={openBrowseTarget}
              onOpenCinema={openCinema}
              onOpenPrivacyDialog={openPrivacyDialog}
              onMarkSeen={markSeen}
              onOpenSubreddit={openSubreddit}
              onSessionUpdate={updateSession}
              onSettingsChange={setViewerSettings}
              onToggleFollowCreator={toggleFollowCreator}
              onToggleFollowSubreddit={toggleFollowSubreddit}
              onToggleFavorite={toggleFavorite}
              onToggleNsfw={toggleNsfw}
              onUpdateFavoriteTags={updateFavoriteTags}
            />
          )}
        </>
      )}

      {privacyDialogMode !== 'closed' ? (
        <PrivacyDialog
          hasLock={Boolean(privacyLock)}
          onClose={() => setPrivacyDialogMode('closed')}
          onDisable={handleDisablePrivacyLock}
          onLockNow={handleLockNow}
          onSetup={handleSetupPrivacyLock}
        />
      ) : null}

      {isCurationEditorOpen ? (
        <HomepageCurationDialog
          config={homepageCuration}
          nsfwEnabled={nsfwEnabled}
          onClose={() => setIsCurationEditorOpen(false)}
          onSave={handleSaveHomepageCuration}
        />
      ) : null}
    </div>
  )
}

function LandingPage({
  continueWatching,
  favoriteCount,
  followedCreatorCount,
  followedSubredditCount,
  hasPrivacyLock,
  homepageCuration,
  nsfwEnabled,
  savedSubreddits,
  seenCount,
  sessions,
  onOpenBrowseTarget,
  onOpenCinema,
  onOpenFavorites,
  onOpenFollowingCreators,
  onOpenFollowingSubreddits,
  onOpenCurationEditor,
  onOpenLandscapeSubreddit,
  onOpenPortraitSubreddit,
  onOpenPrivacyDialog,
  onOpenSubreddit,
  onToggleNsfw,
}: {
  continueWatching: ViewerSession[]
  favoriteCount: number
  followedCreatorCount: number
  followedSubredditCount: number
  hasPrivacyLock: boolean
  homepageCuration: HomepageCurationConfig
  nsfwEnabled: boolean
  savedSubreddits: string[]
  seenCount: number
  sessions: ViewerSessions
  onOpenBrowseTarget: (value: string) => void
  onOpenCinema: () => void
  onOpenFavorites: () => void
  onOpenFollowingCreators: () => void
  onOpenFollowingSubreddits: () => void
  onOpenCurationEditor: () => void
  onOpenLandscapeSubreddit: (value: string) => void
  onOpenPortraitSubreddit: (value: string) => void
  onOpenPrivacyDialog: () => void
  onOpenSubreddit: (value: string) => void
  onToggleNsfw: () => void
}) {
  const [searchValue, setSearchValue] = useState('')
  const discoverySections = nsfwEnabled
    ? homepageCuration.nsfwSections
    : homepageCuration.sfwSections
  const activeLandscapeShowcase = nsfwEnabled
    ? homepageCuration.nsfwLandscapeShowcase
    : homepageCuration.sfwLandscapeShowcase
  const activePortraitShowcase = nsfwEnabled
    ? homepageCuration.nsfwPortraitShowcase
    : homepageCuration.sfwPortraitShowcase
  const placeholder = nsfwEnabled
    ? 'Open /r/gonewild, /r/NSFW_GIF, /r/RealGirls...'
    : 'Open /r/pics, /r/gifs, /u/example...'
  const quickLinks = discoverySections
    .flatMap((section) => section.subreddits)
    .filter((subreddit, index, collection) => {
      if (collection.findIndex((entry) => entry.toLowerCase() === subreddit.toLowerCase()) !== index) {
        return false
      }

      return matchesLandingMode({
        subreddit,
        nsfwEnabled,
        sessions,
      })
    })
    .slice(0, 10)
  const modeSavedSubreddits = savedSubreddits.filter((subreddit) =>
    matchesLandingMode({
      subreddit,
      nsfwEnabled,
      sessions,
    }),
  )
  const modeContinueWatching = continueWatching.filter((session) =>
    matchesLandingMode({
      subreddit: session.subreddit,
      nsfwEnabled,
      sessions,
    }),
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onOpenBrowseTarget(searchValue)
  }

  return (
    <main className="landing-shell">
      <header className="landing-topbar">
        <div className="brand-lockup">
          <img className="brand-logo" src="/redflix-logo.png" alt="RedFlix" />
        </div>

        <div className="nav-actions">
          {nsfwEnabled ? (
            <button className="viewer-link feature-link" type="button" onClick={onOpenCinema}>
              Cinema
            </button>
          ) : null}
          <button className="viewer-link muted" type="button" onClick={onOpenFavorites}>
            Favorites {favoriteCount}
          </button>
          <button
            className="viewer-link muted"
            type="button"
            onClick={onOpenFollowingCreators}
          >
            Followed creators {followedCreatorCount}
          </button>
          <button
            className="viewer-link muted"
            type="button"
            onClick={onOpenFollowingSubreddits}
          >
            Followed subs {followedSubredditCount}
          </button>
          <button className="viewer-link muted" type="button" onClick={onOpenPrivacyDialog}>
            {hasPrivacyLock ? 'Privacy' : 'Set lock'}
          </button>
          <button className="viewer-link muted" type="button" onClick={onOpenCurationEditor}>
            Edit home
          </button>
          <label className="toggle-pill">
            <span>NSFW</span>
            <input checked={nsfwEnabled} type="checkbox" onChange={onToggleNsfw} />
          </label>
        </div>
      </header>

      <section className="landing-launch">
        <form className="search-bar landing-search" onSubmit={handleSubmit}>
          <input
            aria-label="Open subreddit or creator"
            placeholder={placeholder}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          <button type="submit">Open</button>
        </form>

        <div className="quick-links">
          {nsfwEnabled ? (
            <button className="feature-link" type="button" onClick={onOpenCinema}>
              Cinema
            </button>
          ) : null}
          {quickLinks.map((name) => (
            <button key={name} type="button" onClick={() => onOpenSubreddit(name)}>
              /r/{name}
            </button>
          ))}
        </div>
      </section>

      <SectionRow
        hint={
          nsfwEnabled
            ? 'Open straight into a wide-screen adult autoplay feed.'
            : 'Open straight into a wide-screen autoplay feed.'
        }
        title="Landscape Video"
        variant="showcase-landscape"
      >
        {activeLandscapeShowcase.map((entry) => (
          <SubredditTile
            key={entry.subreddit}
            nsfwEnabled={nsfwEnabled}
            previewEnabled
            previewMediaType="video"
            previewOrientation="landscape"
            posterAspect="landscape"
            subreddit={entry.subreddit}
            onOpenSubreddit={onOpenLandscapeSubreddit}
          />
        ))}
      </SectionRow>

      <SectionRow
        hint={
          nsfwEnabled
            ? 'Portrait-first adult clips for one-handed mobile browsing.'
            : 'Portrait-first clips for one-handed mobile browsing.'
        }
        title="Portrait Video"
        variant="showcase-portrait"
      >
        {activePortraitShowcase.map((entry) => (
          <SubredditTile
            key={entry.subreddit}
            nsfwEnabled={nsfwEnabled}
            previewEnabled
            previewMediaType="video"
            previewOrientation="portrait"
            posterAspect="portrait"
            subreddit={entry.subreddit}
            onOpenSubreddit={onOpenPortraitSubreddit}
          />
        ))}
      </SectionRow>

      {modeSavedSubreddits.length > 0 ? (
        <SectionRow title="Saved">
          {modeSavedSubreddits.map((subreddit) => (
            <SubredditTile
              key={subreddit}
              nsfwEnabled={nsfwEnabled}
              previewEnabled
              subreddit={subreddit}
              onOpenSubreddit={onOpenSubreddit}
            />
          ))}
        </SectionRow>
      ) : null}

      {modeContinueWatching.length > 0 ? (
        <SectionRow title="Continue">
          {modeContinueWatching.map((session) => (
            <SubredditTile
              key={`continue-${session.subreddit}`}
              forcedPoster={session.posterUrl}
              nsfwEnabled={nsfwEnabled}
              subreddit={session.subreddit}
              onOpenSubreddit={onOpenSubreddit}
            />
          ))}
        </SectionRow>
      ) : null}

      {discoverySections.map((section) => (
        <SectionRow key={`${nsfwEnabled ? 'nsfw' : 'sfw'}-${section.title}`} title={section.title}>
          {section.subreddits.map((subreddit) => (
            <SubredditTile
              key={`${nsfwEnabled ? 'nsfw' : 'sfw'}-${section.title}-${subreddit}`}
              forcedPoster={sessions[toSessionKey(subreddit)]?.posterUrl ?? null}
              nsfwEnabled={nsfwEnabled}
              subreddit={subreddit}
              onOpenSubreddit={onOpenSubreddit}
            />
          ))}
        </SectionRow>
      ))}

      {nsfwEnabled ? (
        <TextSubredditDirectory
          sections={homepageCuration.nsfwMoreSections}
          onOpenSubreddit={onOpenSubreddit}
        />
      ) : null}

      <footer className="landing-footer">
        <p>
          {savedSubreddits.length} saved · {favoriteCount} favorites · {followedCreatorCount} creators · {followedSubredditCount} subreddits · {seenCount} seen · local only
        </p>
      </footer>
    </main>
  )
}

function LockScreen({
  hint,
  onUnlock,
}: {
  hint: string
  onUnlock: (secret: string) => Promise<boolean>
}) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    const unlocked = await onUnlock(secret)
    setIsSubmitting(false)

    if (!unlocked) {
      setError('That passcode did not match.')
      return
    }

    setSecret('')
  }

  return (
    <main className="lock-shell">
      <section className="lock-card">
        <p className="eyebrow">Private access</p>
        <h1>Unlock RedFlix</h1>
        <p className="lock-copy">
          Everything stays local to this browser. Enter your passcode to open the app.
        </p>

        {hint ? (
          <p className="form-note">
            Hint: <span>{hint}</span>
          </p>
        ) : null}

        <form className="lock-form" onSubmit={handleSubmit}>
          <label className="field-stack">
            <span>Passcode</span>
            <input
              autoComplete="current-password"
              autoFocus
              placeholder="Enter your passcode"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>

          {error ? <p className="error-copy">{error}</p> : null}

          <button disabled={isSubmitting || secret.length === 0} type="submit">
            {isSubmitting ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </section>
    </main>
  )
}

function PrivacyDialog({
  hasLock,
  onClose,
  onDisable,
  onLockNow,
  onSetup,
}: {
  hasLock: boolean
  onClose: () => void
  onDisable: (secret: string) => Promise<boolean>
  onLockNow: () => void
  onSetup: (values: { hint: string; secret: string }) => Promise<void>
}) {
  const [secret, setSecret] = useState('')
  const [confirmSecret, setConfirmSecret] = useState('')
  const [hint, setHint] = useState('')
  const [disableSecret, setDisableSecret] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (secret.trim().length < 4) {
      setError('Use at least 4 characters for the passcode.')
      return
    }

    if (secret !== confirmSecret) {
      setError('The passcode and confirmation need to match.')
      return
    }

    setIsSubmitting(true)
    await onSetup({
      hint: hint.trim().slice(0, 80),
      secret,
    })
    setIsSubmitting(false)
  }

  const handleDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const disabled = await onDisable(disableSecret)
    setIsSubmitting(false)

    if (!disabled) {
      setError('That passcode did not match.')
      return
    }

    setDisableSecret('')
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="dialog-card"
        role="dialog"
        aria-label={hasLock ? 'Privacy lock settings' : 'Set privacy lock'}
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2>{hasLock ? 'Manage privacy lock' : 'Set a local passcode'}</h2>
          </div>
          <button className="ghost-link" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {!hasLock ? (
          <form className="dialog-form" onSubmit={handleSetup}>
            <p className="lock-copy">
              This adds a local lock screen before the app opens. Your data still stays on
              this device.
            </p>

            <label className="field-stack">
              <span>Passcode</span>
              <input
                autoComplete="new-password"
                placeholder="Create a passcode"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </label>

            <label className="field-stack">
              <span>Confirm passcode</span>
              <input
                autoComplete="new-password"
                placeholder="Confirm the passcode"
                type="password"
                value={confirmSecret}
                onChange={(event) => setConfirmSecret(event.target.value)}
              />
            </label>

            <label className="field-stack">
              <span>Hint (optional)</span>
              <input
                placeholder="Something only you would recognize"
                type="text"
                value={hint}
                onChange={(event) => setHint(event.target.value)}
              />
            </label>

            {error ? <p className="error-copy">{error}</p> : null}

            <div className="dialog-actions">
              <button className="subtle-button" type="button" onClick={onClose}>
                Cancel
              </button>
              <button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save lock'}
              </button>
            </div>
          </form>
        ) : (
          <div className="dialog-form">
            <p className="lock-copy">
              Use this when you want the app to open behind a local passcode.
            </p>

            <div className="dialog-actions dialog-actions--start">
              <button type="button" onClick={onLockNow}>
                Lock now
              </button>
            </div>

            <form className="dialog-form dialog-form--nested" onSubmit={handleDisable}>
              <label className="field-stack">
                <span>Turn off lock</span>
                <input
                  autoComplete="current-password"
                  placeholder="Enter current passcode"
                  type="password"
                  value={disableSecret}
                  onChange={(event) => setDisableSecret(event.target.value)}
                />
              </label>

              {error ? <p className="error-copy">{error}</p> : null}

              <div className="dialog-actions">
                <button className="danger-button" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Checking...' : 'Disable lock'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  )
}

function HomepageCurationDialog({
  config,
  nsfwEnabled,
  onClose,
  onSave,
}: {
  config: HomepageCurationConfig
  nsfwEnabled: boolean
  onClose: () => void
  onSave: (config: HomepageCurationConfig) => void
}) {
  const [activeTab, setActiveTab] = useState<'sfw' | 'nsfw'>(nsfwEnabled ? 'nsfw' : 'sfw')
  const [draft, setDraft] = useState<HomepageCurationConfig>(() =>
    cloneHomepageCurationConfig(config),
  )

  const updateDraft = <K extends keyof HomepageCurationConfig>(
    key: K,
    value: HomepageCurationConfig[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="dialog-card curation-dialog"
        role="dialog"
        aria-label="Homepage curation editor"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Edit homepage curation</h2>
          </div>
          <button className="ghost-link" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="lock-copy">
          Change the homepage sections locally on this device. Save when you are happy
          with the layout.
        </p>

        <div className="curation-tab-row" role="tablist" aria-label="Homepage mode">
          <button
            className={activeTab === 'sfw' ? 'is-active' : ''}
            type="button"
            onClick={() => setActiveTab('sfw')}
          >
            SFW home
          </button>
          <button
            className={activeTab === 'nsfw' ? 'is-active' : ''}
            type="button"
            onClick={() => setActiveTab('nsfw')}
          >
            NSFW home
          </button>
        </div>

        <div className="curation-scroll">
          {activeTab === 'sfw' ? (
            <>
              <SectionCollectionEditor
                description="The main homepage rows of subreddit cards."
                sections={draft.sfwSections}
                title="Homepage sections"
                onChange={(sections) => updateDraft('sfwSections', sections)}
              />
              <ShowcaseCollectionEditor
                description="Wide autoplay cards at the top of the homepage."
                items={draft.sfwLandscapeShowcase}
                title="Landscape video"
                onChange={(items) => updateDraft('sfwLandscapeShowcase', items)}
              />
              <ShowcaseCollectionEditor
                description="Portrait-first video cards for mobile-style clips."
                items={draft.sfwPortraitShowcase}
                title="Portrait video"
                onChange={(items) => updateDraft('sfwPortraitShowcase', items)}
              />
            </>
          ) : (
            <>
              <SectionCollectionEditor
                description="The main NSFW homepage rows of subreddit cards."
                sections={draft.nsfwSections}
                title="Homepage sections"
                onChange={(sections) => updateDraft('nsfwSections', sections)}
              />
              <ShowcaseCollectionEditor
                description="Wide adult video cards shown above the gallery rows."
                items={draft.nsfwLandscapeShowcase}
                title="Landscape video"
                onChange={(items) => updateDraft('nsfwLandscapeShowcase', items)}
              />
              <ShowcaseCollectionEditor
                description="Portrait-first adult clips for the mobile-style row."
                items={draft.nsfwPortraitShowcase}
                title="Portrait video"
                onChange={(items) => updateDraft('nsfwPortraitShowcase', items)}
              />
              <SectionCollectionEditor
                description="The text-only directory near the bottom of the NSFW homepage."
                sections={draft.nsfwMoreSections}
                title="Text directory"
                onChange={(sections) => updateDraft('nsfwMoreSections', sections)}
              />
            </>
          )}
        </div>

        <div className="dialog-actions dialog-actions--spread">
          <button
            className="subtle-button"
            type="button"
            onClick={() =>
              setDraft(cloneHomepageCurationConfig(defaultHomepageCurationConfig))
            }
          >
            Reset to defaults
          </button>
          <div className="dialog-actions">
            <button className="subtle-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(normalizeHomepageCurationConfig(draft))}
            >
              Save changes
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionCollectionEditor({
  description,
  sections,
  title,
  onChange,
}: {
  description: string
  sections: Array<{ title: string; subreddits: string[] }>
  title: string
  onChange: (sections: Array<{ title: string; subreddits: string[] }>) => void
}) {
  const updateSection = (
    index: number,
    updater: (section: { title: string; subreddits: string[] }) => {
      title: string
      subreddits: string[]
    },
  ) => {
    onChange(
      sections.map((section, sectionIndex) =>
        sectionIndex === index ? updater(section) : section,
      ),
    )
  }

  return (
    <section className="curation-group">
      <div className="curation-group-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="curation-stack">
        {sections.map((section, index) => (
          <article key={`${section.title}-${index}`} className="curation-card">
            <div className="curation-card-actions">
              <label className="field-stack">
                <span>Section title</span>
                <input
                  type="text"
                  value={section.title}
                  onChange={(event) =>
                    updateSection(index, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="curation-button-row">
                <button
                  className="subtle-button"
                  disabled={index === 0}
                  type="button"
                  onClick={() => onChange(moveArrayItem(sections, index, -1))}
                >
                  Up
                </button>
                <button
                  className="subtle-button"
                  disabled={index === sections.length - 1}
                  type="button"
                  onClick={() => onChange(moveArrayItem(sections, index, 1))}
                >
                  Down
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onChange(sections.filter((_, sectionIndex) => sectionIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="field-stack">
              <span>Subreddits</span>
              <textarea
                rows={3}
                value={section.subreddits.join(', ')}
                onChange={(event) =>
                  updateSection(index, (current) => ({
                    ...current,
                    subreddits: parseSubredditDraft(event.target.value),
                  }))
                }
              />
            </label>
          </article>
        ))}
      </div>

      <button
        className="subtle-button curation-add-button"
        type="button"
        onClick={() =>
          onChange([
            ...sections,
            {
              title: 'New section',
              subreddits: [],
            },
          ])
        }
      >
        Add section
      </button>
    </section>
  )
}

function ShowcaseCollectionEditor({
  description,
  items,
  title,
  onChange,
}: {
  description: string
  items: LandscapeVideoShowcase[]
  title: string
  onChange: (items: LandscapeVideoShowcase[]) => void
}) {
  const updateItem = (
    index: number,
    updater: (item: LandscapeVideoShowcase) => LandscapeVideoShowcase,
  ) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)))
  }

  return (
    <section className="curation-group">
      <div className="curation-group-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <div className="curation-stack">
        {items.map((item, index) => (
          <article key={`${item.subreddit}-${index}`} className="curation-card">
            <div className="curation-card-actions">
              <label className="field-stack">
                <span>Card title</span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(event) =>
                    updateItem(index, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="curation-button-row">
                <button
                  className="subtle-button"
                  disabled={index === 0}
                  type="button"
                  onClick={() => onChange(moveArrayItem(items, index, -1))}
                >
                  Up
                </button>
                <button
                  className="subtle-button"
                  disabled={index === items.length - 1}
                  type="button"
                  onClick={() => onChange(moveArrayItem(items, index, 1))}
                >
                  Down
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="curation-showcase-grid">
              <label className="field-stack">
                <span>Subreddit</span>
                <input
                  type="text"
                  value={item.subreddit}
                  onChange={(event) =>
                    updateItem(index, (current) => ({
                      ...current,
                      subreddit: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field-stack">
                <span>Subtitle</span>
                <input
                  type="text"
                  value={item.subtitle}
                  onChange={(event) =>
                    updateItem(index, (current) => ({
                      ...current,
                      subtitle: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>

      <button
        className="subtle-button curation-add-button"
        type="button"
        onClick={() =>
          onChange([
            ...items,
            {
              title: 'New card',
              subtitle: '',
              subreddit: '',
            },
          ])
        }
      >
        Add card
      </button>
    </section>
  )
}

function QuickExitScreen({
  canReturn,
  onOpenSafeHome,
  onReturnToPrevious,
}: {
  canReturn: boolean
  onOpenSafeHome: () => void
  onReturnToPrevious: () => void
}) {
  const safeLinks = ['Photos', 'Animals', 'Space', 'Architecture', 'Travel', 'Home']

  return (
    <main className="quick-exit-shell" onClick={onOpenSafeHome}>
      <div className="quick-exit-cover" aria-hidden="true" />
      <section className="quick-exit-home" aria-label="Safe home cover">
        <div className="brand-lockup">
          <img className="brand-logo" src="/redflix-logo.png" alt="RedFlix" />
        </div>

        <div className="quick-exit-search" aria-hidden="true">
          <span>Search photos, videos, art, animals...</span>
          <strong>Open</strong>
        </div>

        <div className="quick-exit-grid">
          {safeLinks.map((label, index) => (
            <button
              key={label}
              className={`quick-exit-thumb quick-exit-thumb--${index + 1}`}
              type="button"
              onClick={onOpenSafeHome}
            >
              <span className="quick-exit-thumb-media" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <p className="quick-exit-hint">Click anywhere to open the safe home page.</p>
      </section>
      {canReturn ? (
        <button
          aria-label="Return to previous view"
          className="quick-exit-return"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onReturnToPrevious()
          }}
        >
          <span aria-hidden="true">↩</span>
          <span>Return</span>
        </button>
      ) : null}
    </main>
  )
}

function ViewerPage({
  initialSession,
  followedCreators,
  followedSubreddits,
  route,
  favorites,
  hasPrivacyLock,
  nsfwEnabled,
  seenItems,
  settings,
  onBack,
  onOpenFavorites,
  onOpenFollowingCreators,
  onOpenFollowingSubreddits,
  onOpenAuthor,
  onOpenBrowseTarget,
  onOpenCinema,
  onOpenPrivacyDialog,
  onMarkSeen,
  onOpenSubreddit,
  onSessionUpdate,
  onSettingsChange,
  onToggleFollowCreator,
  onToggleFollowSubreddit,
  onToggleFavorite,
  onToggleNsfw,
  onUpdateFavoriteTags,
}: {
  initialSession?: ViewerSession
  followedCreators: string[]
  followedSubreddits: string[]
  route: Exclude<Route, { kind: 'home' }>
  favorites: FavoriteEntries
  hasPrivacyLock: boolean
  nsfwEnabled: boolean
  seenItems: string[]
  settings: ViewerSettings
  onBack: () => void
  onOpenFavorites: () => void
  onOpenFollowingCreators: () => void
  onOpenFollowingSubreddits: () => void
  onOpenAuthor: (value: string, options?: OpenAuthorOptions) => void
  onOpenBrowseTarget: (value: string) => void
  onOpenCinema: () => void
  onOpenPrivacyDialog: () => void
  onMarkSeen: (itemKey: string) => void
  onOpenSubreddit: (value: string, options?: OpenSubredditOptions) => void
  onSessionUpdate: (subreddit: string, nextSession: ViewerSession) => void
  onSettingsChange: Dispatch<SetStateAction<ViewerSettings>>
  onToggleFollowCreator: (value: string) => void
  onToggleFollowSubreddit: (value: string) => void
  onToggleFavorite: (item: ViewerItem) => void
  onToggleNsfw: () => void
  onUpdateFavoriteTags: (itemKey: string, tags: string[]) => void
}) {
  const [items, setItems] = useState<ViewerItem[]>([])
  const [after, setAfter] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(initialSession?.index ?? 0)
  const [isLoading, setIsLoading] = useState(route.kind !== 'favorites')
  const [error, setError] = useState('')
  const [searchValue, setSearchValue] = useState(
    route.kind === 'subreddit'
      ? route.subreddit
      : route.kind === 'author'
        ? `u/${route.author}`
        : '',
  )
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showChrome, setShowChrome] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedTag, setSelectedTag] = useState('all')
  const [soundBlockedItemKey, setSoundBlockedItemKey] = useState('')
  const [soundUnavailableItemKey, setSoundUnavailableItemKey] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState<RedditComment[]>([])
  const [commentsStatus, setCommentsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [commentIndex, setCommentIndex] = useState(0)

  const viewerShellRef = useRef<HTMLElement | null>(null)
  const stageFrameRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chromeTimerRef = useRef<number | null>(null)
  const isLoadingMoreRef = useRef(false)
  const gridScrollTopRef = useRef(0)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const lastRecordedItemRef = useRef('')
  const commentRequestIdRef = useRef(0)

  const seenSet = useMemo(() => new Set(seenItems), [seenItems])
  const favoriteEntries = useMemo(
    () =>
      Object.values(favorites).sort(
        (left, right) => right.favoritedAt - left.favoritedAt,
      ),
    [favorites],
  )
  const favoriteTags = useMemo(() => {
    const seen = new Set<string>()
    const tags: string[] = []

    favoriteEntries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        const normalized = tag.toLowerCase()
        if (seen.has(normalized)) return
        seen.add(normalized)
        tags.push(tag)
      })
    })

    return tags
  }, [favoriteEntries])
  const isFavoritesRoute = route.kind === 'favorites'
  const isCinemaRoute = route.kind === 'cinema'
  const isFollowingCreatorsRoute = route.kind === 'following-creators'
  const isFollowingSubredditsRoute = route.kind === 'following-subreddits'
  const isFollowingRoute = isFollowingCreatorsRoute || isFollowingSubredditsRoute
  const isSubredditRoute = route.kind === 'subreddit'
  const isAuthorRoute = route.kind === 'author'
  const followedSources = isFollowingCreatorsRoute
    ? followedCreators
    : isFollowingSubredditsRoute
      ? followedSubreddits
      : []
  const hasEmptyFollowingRoute = isFollowingRoute && followedSources.length === 0
  const effectiveSelectedTag =
    selectedTag === 'all' ||
    favoriteTags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
      ? selectedTag
      : 'all'
  const sourceLabel =
    isSubredditRoute
      ? `/r/${route.subreddit}`
      : isAuthorRoute
        ? `u/${route.author}`
        : isCinemaRoute
          ? 'Cinema'
        : route.kind === 'following-creators'
          ? 'Following creators'
          : route.kind === 'following-subreddits'
            ? 'Following subreddits'
            : 'Favorites'
  const isGridMode = settings.displayMode === 'grid'
  const chromeVisible = isGridMode ? true : showChrome
  const dockVisible = !isFullscreen || chromeVisible
  const isNsfwBlockedRoute =
    !nsfwEnabled &&
    ((route.kind === 'subreddit' && isKnownNsfwSubreddit(route.subreddit)) ||
      route.kind === 'cinema')
  const effectiveSortMode =
    (route.kind === 'author' || route.kind === 'following-creators') &&
    settings.sortMode === 'hot'
      ? ('all' as const)
      : settings.sortMode
  const sortOptions: Array<[string, string]> =
    route.kind === 'favorites'
      ? []
      : route.kind === 'author' || route.kind === 'following-creators'
      ? [
          ['day', 'Day'],
          ['week', 'Week'],
          ['month', 'Month'],
          ['year', 'Year'],
          ['all', 'All'],
        ]
      : [
          ['hot', 'Hot'],
          ['day', 'Day'],
          ['week', 'Week'],
          ['month', 'Month'],
          ['year', 'Year'],
          ['all', 'All'],
        ]
  const sourceItems = useMemo(
    () =>
      isFavoritesRoute ? favoriteEntries.map((entry) => entry.item) : items,
    [favoriteEntries, isFavoritesRoute, items],
  )
  const filteredItems = useMemo(
    () =>
      sourceItems.filter((item) =>
        matchesViewerFilters({
          item,
          nsfwEnabled,
          seenSet,
          settings,
        }) &&
        matchesFavoriteTag({
          favorites,
          item,
          route,
          selectedTag: effectiveSelectedTag,
        }),
      ),
    [effectiveSelectedTag, favorites, nsfwEnabled, route, seenSet, settings, sourceItems],
  )
  const filteredItemsIgnoringSeen = useMemo(
    () =>
      sourceItems.filter((item) =>
        matchesViewerFilters({
          item,
          nsfwEnabled,
          seenSet,
          settings: {
            ...settings,
            hideSeen: false,
          },
        }) &&
        matchesFavoriteTag({
          favorites,
          item,
          route,
          selectedTag: effectiveSelectedTag,
        }),
      ),
    [effectiveSelectedTag, favorites, nsfwEnabled, route, seenSet, settings, sourceItems],
  )
  const relaxedFilteredItems = useMemo(
    () =>
      sourceItems.filter((item) =>
        matchesViewerFilters({
          item,
          nsfwEnabled,
          seenSet,
          settings: {
            ...settings,
            mediaFilter: defaultViewerSettings.mediaFilter,
            orientationFilter: defaultViewerSettings.orientationFilter,
            hideSeen: defaultViewerSettings.hideSeen,
            maxDuration: defaultViewerSettings.maxDuration,
          },
        }) &&
        matchesFavoriteTag({
          favorites,
          item,
          route,
          selectedTag: effectiveSelectedTag,
        }),
      ),
    [effectiveSelectedTag, favorites, nsfwEnabled, route, seenSet, settings, sourceItems],
  )
  const isUniformMediaType =
    filteredItems.length > 0 &&
    filteredItems.every((item) => item.mediaType === filteredItems[0]?.mediaType)
  const useFocusedGrid = isSubredditRoute || isAuthorRoute

  const safeIndex =
    filteredItems.length === 0
      ? 0
      : Math.min(activeIndex, filteredItems.length - 1)

  const activeItem = filteredItems[safeIndex]
  const nextItem = filteredItems[safeIndex + 1]
  const isSoundBlocked = Boolean(activeItem && soundBlockedItemKey === activeItem.key)
  const isSoundUnavailable = Boolean(
    activeItem && soundUnavailableItemKey === activeItem.key,
  )
  const isSoundEffectivelyMuted = settings.muted || isSoundBlocked || isSoundUnavailable
  const hasSidePanel = !isGridMode && Boolean(activeItem)
  const activeFavorite = activeItem ? favorites[activeItem.key] : undefined
  const activeTags = activeFavorite?.tags ?? []
  const activeCreatorFollowed = activeItem
    ? followedCreators.some(
        (entry) => entry.toLowerCase() === activeItem.author.toLowerCase(),
      )
    : false
  const activeSubredditFollowed = activeItem
    ? followedSubreddits.some(
        (entry) => entry.toLowerCase() === activeItem.subreddit.toLowerCase(),
      )
    : false
  const routeCreatorFollowed =
    route.kind === 'author' &&
    followedCreators.some(
      (entry) => entry.toLowerCase() === route.author.toLowerCase(),
    )
  const routeSubredditFollowed =
    route.kind === 'subreddit' &&
    followedSubreddits.some(
      (entry) => entry.toLowerCase() === route.subreddit.toLowerCase(),
    )

  const tryStartSeparateAudio = useCallback(
    (
      audioNode: HTMLAudioElement,
      videoNode: HTMLVideoElement,
      itemKey: string,
    ) => {
      const attemptPlayback = (isRetry: boolean) => {
        if (audioRef.current !== audioNode || videoRef.current !== videoNode) {
          return
        }

        audioNode.muted = false
        audioNode.volume = settings.volume

        if (Math.abs(audioNode.currentTime - videoNode.currentTime) > 0.35) {
          audioNode.currentTime = videoNode.currentTime
        }

        const playPromise = audioNode.play()
        if (!playPromise) return

        void playPromise.catch(() => {
          if (!isRetry) {
            window.setTimeout(() => {
              attemptPlayback(true)
            }, 120)
            return
          }

          if (
            audioRef.current === audioNode &&
            videoRef.current === videoNode &&
            activeItem?.key === itemKey
          ) {
            setSoundBlockedItemKey(itemKey)
          }
          audioNode.pause()
        })
      }

      if (audioNode.readyState >= 2) {
        attemptPlayback(false)
        return
      }

      const onCanPlay = () => {
        attemptPlayback(false)
      }

      audioNode.addEventListener('canplay', onCanPlay, { once: true })
    },
    [activeItem?.key, settings.volume],
  )

  const revealChrome = useCallback(() => {
    setShowChrome(true)

    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current)
    }

    chromeTimerRef.current = window.setTimeout(() => {
      if (!isPaused) {
        setShowChrome(false)
      }
    }, 2200)
  }, [isPaused])

  const moveBy = useCallback(
    (direction: 1 | -1, options?: { userInitiated?: boolean }) => {
      if (filteredItems.length === 0) return
      const normalizedIndex = Math.min(safeIndex, filteredItems.length - 1)
      const nextIndex =
        normalizedIndex + direction < 0
          ? filteredItems.length - 1
          : normalizedIndex + direction >= filteredItems.length
            ? 0
            : normalizedIndex + direction
      const nextItemKey = filteredItems[nextIndex]?.key ?? ''

      const advance = () => {
        revealChrome()
        setProgress(0)
        setIsPaused(false)
        setSoundBlockedItemKey('')
        setCommentsOpen(false)
        commentRequestIdRef.current += 1
        onSettingsChange((current) =>
          current.muted
            ? {
                ...current,
                muted: false,
              }
            : current,
        )
        setActiveIndex((current) => {
          const normalized = Math.min(current, filteredItems.length - 1)
          const next = normalized + direction
          if (next < 0) return filteredItems.length - 1
          if (next >= filteredItems.length) return 0
          return next
        })
      }

      if (options?.userInitiated) {
        flushSync(advance)
        window.requestAnimationFrame(() => {
          const node = videoRef.current
          const audioNode = audioRef.current
          if (!node) return

          node.currentTime = 0
          node.volume = settings.volume
          node.muted = audioNode ? true : false

          if (audioNode) {
            audioNode.currentTime = 0
            audioNode.volume = settings.volume
            audioNode.muted = false
          }

          const playPromise = node.play()
          if (playPromise) {
            void playPromise.catch(() => {
              setIsPaused(true)
            })
          }

          if (audioNode && nextItemKey) {
            tryStartSeparateAudio(audioNode, node, nextItemKey)
          }
        })
        return
      }

      advance()
    },
    [
      filteredItems,
      onSettingsChange,
      revealChrome,
      safeIndex,
      settings.volume,
      tryStartSeparateAudio,
    ],
  )

  const updateDisplayMode = useCallback(
    (nextMode: DisplayMode) => {
      if (nextMode === settings.displayMode) return

      if (settings.displayMode === 'grid') {
        gridScrollTopRef.current = window.scrollY
      }

      onSettingsChange((current) => ({
        ...current,
        displayMode: nextMode,
      }))

      if (nextMode === 'viewer') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [onSettingsChange, settings.displayMode],
  )

  const openGridItem = useCallback(
    (index: number) => {
      gridScrollTopRef.current = window.scrollY
      setIsPaused(false)
      setSoundBlockedItemKey('')
      setCommentsOpen(false)
      commentRequestIdRef.current += 1
      onSettingsChange((current) =>
        current.muted
          ? {
              ...current,
              muted: false,
            }
          : current,
      )
      setActiveIndex(index)
      updateDisplayMode('viewer')
    },
    [onSettingsChange, updateDisplayMode],
  )

  const handleToggleFullscreen = useCallback(() => {
    void toggleFullscreen(stageFrameRef.current)
  }, [])

  const togglePause = useCallback(() => {
    if (!activeItem) return
    revealChrome()

    if (activeItem.kind === 'embed') return

    if (activeItem.kind === 'video') {
      const node = videoRef.current
      const audioNode = audioRef.current
      if (node) {
        if (node.paused) {
          if (audioNode) {
            audioNode.currentTime = node.currentTime
            audioNode.muted = isSoundEffectivelyMuted
            audioNode.volume = settings.volume
          }

          const playPromise = node.play()

          setIsPaused(false)
          if (playPromise) {
            void playPromise.catch(() => {
              setIsPaused(true)
            })
          }

          if (audioNode && !isSoundEffectivelyMuted) {
            tryStartSeparateAudio(audioNode, node, activeItem.key)
          }
          return
        }

        node.pause()
        audioNode?.pause()
        setIsPaused(true)
        return
      }
    }

    setIsPaused((current) => !current)
  }, [activeItem, isSoundEffectivelyMuted, revealChrome, settings.volume, tryStartSeparateAudio])

  const fetchRoutePage = useCallback(
    (pageAfter?: string | null): Promise<ListingPage> => {
      if (route.kind === 'author') {
        return fetchUserPage({
          username: route.author,
          sortMode: effectiveSortMode,
          after: pageAfter,
          limit: 40,
        })
      }

      if (route.kind === 'cinema') {
        return fetchFollowedFeed({
          after: pageAfter,
          sortMode: effectiveSortMode,
          subreddits: curatedNsfwCinemaSources,
        })
      }

      if (route.kind === 'following-creators') {
        return followedCreators.length > 0
          ? fetchFollowedFeed({
              after: pageAfter,
              creators: followedCreators,
              sortMode: effectiveSortMode,
            })
          : Promise.resolve<ListingPage>({
              after: null,
              items: [],
            })
      }

      if (route.kind === 'following-subreddits') {
        return followedSubreddits.length > 0
          ? fetchFollowedFeed({
              after: pageAfter,
              sortMode: effectiveSortMode,
              subreddits: followedSubreddits,
            })
          : Promise.resolve<ListingPage>({
              after: null,
              items: [],
            })
      }

      if (route.kind === 'subreddit') {
        return fetchSubredditPage({
          subreddit: route.subreddit,
          sortMode: effectiveSortMode,
          after: pageAfter,
          limit: 40,
        })
      }

      return Promise.resolve<ListingPage>({
        after: null,
        items: [],
      })
    },
    [effectiveSortMode, followedCreators, followedSubreddits, route],
  )

  useEffect(() => {
    let ignore = false

    if (route.kind === 'favorites') {
      const timeoutId = window.setTimeout(() => {
        if (ignore) return
        setItems([])
        setAfter(null)
        setError('')
        setIsLoading(false)
      }, 0)

      return () => {
        ignore = true
        window.clearTimeout(timeoutId)
      }
    }

    isLoadingMoreRef.current = false
    const loadingTimeoutId = window.setTimeout(() => {
      if (ignore) return
      setIsLoading(true)
      setError('')
      setAfter(null)
    }, 0)

    fetchRoutePage(null)
      .then((page) => {
        if (ignore) return
        setActiveIndex(initialSession?.index ?? 0)
        setProgress(0)
        setItems(page.items)
        setAfter(page.after)
        setError('')
      })
      .catch((fetchError) => {
        if (ignore) return
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      })
      .finally(() => {
        window.clearTimeout(loadingTimeoutId)
        if (!ignore) {
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
      window.clearTimeout(loadingTimeoutId)
    }
  }, [fetchRoutePage, initialSession?.index, route.kind])

  useEffect(() => {
    warmMediaAsset(nextItem)
  }, [nextItem])

  useEffect(() => {
    if (
      isLoading ||
      error ||
      sourceItems.length === 0 ||
      filteredItems.length > 0 ||
      relaxedFilteredItems.length === 0 ||
      (settings.hideSeen && filteredItemsIgnoringSeen.length > 0)
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onSettingsChange((current) => {
        if (
          current.mediaFilter === defaultViewerSettings.mediaFilter &&
          current.orientationFilter === defaultViewerSettings.orientationFilter &&
          current.hideSeen === defaultViewerSettings.hideSeen &&
          current.maxDuration === defaultViewerSettings.maxDuration
        ) {
          return current
        }

        return {
          ...current,
          mediaFilter: defaultViewerSettings.mediaFilter,
          orientationFilter: defaultViewerSettings.orientationFilter,
          hideSeen: defaultViewerSettings.hideSeen,
          maxDuration: defaultViewerSettings.maxDuration,
        }
      })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [
    error,
    filteredItems.length,
    filteredItemsIgnoringSeen.length,
    isLoading,
    onSettingsChange,
    relaxedFilteredItems.length,
    settings.hideSeen,
    sourceItems.length,
  ])

  useEffect(() => {
    if (isGridMode || isFavoritesRoute) return

    if (
      !settings.hideSeen ||
      !after ||
      isLoading ||
      isLoadingMoreRef.current ||
      filteredItems.length > 0 ||
      filteredItemsIgnoringSeen.length === 0
    ) {
      return
    }

    let ignore = false
    isLoadingMoreRef.current = true

    fetchRoutePage(after)
      .then((page) => {
        if (ignore) return
        setItems((current) => mergeItems(current, page.items))
        setAfter(page.after)
      })
      .catch((fetchError) => {
        if (ignore) return
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      })
      .finally(() => {
        if (!ignore) {
          isLoadingMoreRef.current = false
        }
      })

    return () => {
      ignore = true
      isLoadingMoreRef.current = false
    }
  }, [
    after,
    fetchRoutePage,
    filteredItems.length,
    filteredItemsIgnoringSeen.length,
    isFavoritesRoute,
    isGridMode,
    isLoading,
    settings.hideSeen,
  ])

  useEffect(() => {
    if (isGridMode || isFavoritesRoute) return

    if (
      !after ||
      isLoading ||
      isLoadingMoreRef.current ||
      filteredItems.length === 0
    ) {
      return
    }

    if (safeIndex < filteredItems.length - 4) {
      return
    }

    let ignore = false
    isLoadingMoreRef.current = true

    fetchRoutePage(after)
      .then((page) => {
        if (ignore) return
        setItems((current) => mergeItems(current, page.items))
        setAfter(page.after)
      })
      .catch((fetchError) => {
        if (ignore) return
        setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
      })
      .finally(() => {
        if (!ignore) {
          isLoadingMoreRef.current = false
        }
      })

    return () => {
      ignore = true
      isLoadingMoreRef.current = false
    }
  }, [
    after,
    fetchRoutePage,
    filteredItems.length,
    isFavoritesRoute,
    isGridMode,
    isLoading,
    safeIndex,
  ])

  useEffect(() => {
    if (!isGridMode || !after || isLoading || isFavoritesRoute) return

    let ignore = false

    const requestMore = () => {
      if (
        ignore ||
        !after ||
        isLoadingMoreRef.current ||
        window.innerHeight + window.scrollY < document.body.offsetHeight - 1200
      ) {
        return
      }

      isLoadingMoreRef.current = true

      void fetchRoutePage(after)
        .then((page) => {
          if (ignore) return
          setItems((current) => mergeItems(current, page.items))
          setAfter(page.after)
        })
        .catch((fetchError) => {
          if (ignore) return
          setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
        })
        .finally(() => {
          if (!ignore) {
            isLoadingMoreRef.current = false
          }
        })
    }

    const onScroll = () => {
      requestMore()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    requestMore()

    return () => {
      ignore = true
      isLoadingMoreRef.current = false
      window.removeEventListener('scroll', onScroll)
    }
  }, [after, fetchRoutePage, isFavoritesRoute, isGridMode, isLoading])

  useEffect(() => {
    if (isGridMode) return

    const timeoutId = window.setTimeout(() => {
      if (!isPaused) {
        setShowChrome(false)
      }
    }, 2600)

    return () => window.clearTimeout(timeoutId)
  }, [activeItem?.key, isGridMode, isPaused])

  useEffect(() => {
    lastRecordedItemRef.current = ''
  }, [activeItem?.key])

  useEffect(() => {
    if (isGridMode) return

    const node = videoRef.current
    if (!node) return
    const audioNode = audioRef.current
    const hasSeparateAudio = Boolean(activeItem?.kind === 'video' && activeItem.audioUrl)

    node.muted = hasSeparateAudio ? true : isSoundEffectivelyMuted
    node.volume = settings.volume

    if (audioNode) {
      audioNode.muted = isSoundEffectivelyMuted
      audioNode.volume = settings.volume
      if (Math.abs(audioNode.currentTime - node.currentTime) > 0.35) {
        audioNode.currentTime = node.currentTime
      }
    }

    if (isPaused) {
      node.pause()
      audioNode?.pause()
      return
    }

    const playPromise = node.play()
    if (playPromise) {
      void playPromise.catch(() => {
        if (!hasSeparateAudio && !settings.muted && activeItem) {
          node.muted = true
          setSoundBlockedItemKey(activeItem.key)

          const mutedPlayPromise = node.play()
          if (mutedPlayPromise) {
            void mutedPlayPromise.catch(() => {
              setIsPaused(true)
            })
          }
          return
        }

        setIsPaused(true)
      })
    }

    if (audioNode && !isSoundEffectivelyMuted) {
      tryStartSeparateAudio(audioNode, node, activeItem.key)
    }
  }, [
    activeItem,
    activeItem?.audioUrl,
    activeItem?.key,
    activeItem?.kind,
    isGridMode,
    isPaused,
    isSoundEffectivelyMuted,
    settings.muted,
    settings.volume,
    tryStartSeparateAudio,
  ])

  useEffect(() => {
    if (isGridMode) return
    if (!activeItem || activeItem.mediaType !== 'photo') return
    if (!settings.autoAdvance || isPaused) return

    const delaySeconds =
      typeof settings.imageDelaySeconds === 'number' &&
      Number.isFinite(settings.imageDelaySeconds)
        ? Math.max(settings.imageDelaySeconds, 1)
        : defaultViewerSettings.imageDelaySeconds

    const timeoutId = window.setTimeout(() => {
      moveBy(1)
    }, delaySeconds * 1000)

    return () => window.clearTimeout(timeoutId)
  }, [
    activeItem,
    isGridMode,
    isPaused,
    moveBy,
    settings.autoAdvance,
    settings.imageDelaySeconds,
  ])

  useEffect(() => {
    if (isGridMode) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveBy(1, { userInitiated: true })
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveBy(-1, { userInitiated: true })
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        togglePause()
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        handleToggleFullscreen()
        return
      }

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault()
        onSettingsChange((current) => ({
          ...current,
          muted: !current.muted,
        }))
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleToggleFullscreen, isGridMode, moveBy, onSettingsChange, togglePause])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageFrameRef.current)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    onFullscreenChange()

    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isGridMode) return

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: gridScrollTopRef.current })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isGridMode])

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (isInteractivePointerTarget(event.target)) {
      pointerStartRef.current = null
      return
    }

    pointerStartRef.current = { x: event.clientX, y: event.clientY }
    revealChrome()
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (isInteractivePointerTarget(event.target)) {
      pointerStartRef.current = null
      return
    }

    if (!pointerStartRef.current) return

    const deltaX = event.clientX - pointerStartRef.current.x
    const deltaY = event.clientY - pointerStartRef.current.y
    pointerStartRef.current = null

    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
      moveBy(deltaX < 0 ? 1 : -1, { userInitiated: true })
      return
    }

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      togglePause()
    }
  }

  const handleMediaVisible = () => {
    if (!activeItem || lastRecordedItemRef.current === activeItem.key) return

    lastRecordedItemRef.current = activeItem.key
    onMarkSeen(activeItem.key)
    if (route.kind === 'subreddit') {
      onSessionUpdate(route.subreddit, {
        subreddit: route.subreddit,
        index: safeIndex,
        title: buildSessionTitle(activeItem),
        posterUrl: activeItem.posterUrl,
        updatedAt: Date.now(),
        over18: activeItem.over18,
      })
    }
  }

  const handleViewerSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onOpenBrowseTarget(searchValue)
  }

  const handleEditFavoriteTags = () => {
    if (!activeItem) return

    if (!favorites[activeItem.key]) {
      onToggleFavorite(activeItem)
    }

    const nextValue = window.prompt(
      'Tags for this favorite (comma separated)',
      activeTags.join(', '),
    )

    if (nextValue === null) return
    onUpdateFavoriteTags(activeItem.key, parseFavoriteTags(nextValue))
  }

  const handleToggleComments = () => {
    if (!activeItem) return

    if (commentsOpen) {
      setCommentsOpen(false)
      return
    }

    const postId = activeItem.postId
    const requestId = commentRequestIdRef.current + 1
    commentRequestIdRef.current = requestId
    setCommentsOpen(true)
    setCommentsStatus('loading')
    setComments([])
    setCommentIndex(0)

    fetchPostComments(postId, 8)
      .then((nextComments) => {
        if (commentRequestIdRef.current !== requestId) return
        setComments(nextComments)
        setCommentsStatus('ready')
      })
      .catch(() => {
        if (commentRequestIdRef.current !== requestId) return
        setComments([])
        setCommentsStatus('error')
      })
  }

  const toggleSound = () => {
    revealChrome()
    if (isSoundUnavailable) return

    const nextMuted = !settings.muted && !isSoundBlocked
    updateSetting('muted', nextMuted)

    const node = videoRef.current
    const audioNode = audioRef.current

    if (!node) return

    if (activeItem) {
      setSoundBlockedItemKey('')
    }

    node.volume = settings.volume
    node.muted = activeItem?.audioUrl ? true : nextMuted

    if (audioNode) {
      audioNode.volume = settings.volume
      audioNode.muted = nextMuted
      audioNode.currentTime = node.currentTime
    }

    if (nextMuted) {
      audioNode?.pause()
      return
    }

    const playPromise = node.play()
    if (playPromise) {
      void playPromise.catch(() => {
        setIsPaused(true)
      })
    }

    if (audioNode) {
      if (activeItem) {
        tryStartSeparateAudio(audioNode, node, activeItem.key)
      }
    }

    setIsPaused(false)
  }

  const updateSetting = <K extends keyof ViewerSettings>(
    key: K,
    value: ViewerSettings[K],
  ) => {
    onSettingsChange((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const resetContentFilters = () => {
    onSettingsChange((current) => ({
      ...current,
      displayMode: current.displayMode,
      mediaFilter: defaultViewerSettings.mediaFilter,
      orientationFilter: defaultViewerSettings.orientationFilter,
      hideSeen: defaultViewerSettings.hideSeen,
      maxDuration: defaultViewerSettings.maxDuration,
    }))
  }

  return (
    <main
      ref={viewerShellRef}
      className={`viewer-shell ${filtersOpen ? 'filters-open' : ''} ${
        hasSidePanel ? 'has-side-panel' : ''
      } ${isFullscreen ? 'is-fullscreen' : ''}`}
    >
      <header className={`viewer-dock ${dockVisible ? 'is-visible' : ''}`}>
        <div className="viewer-dock-main">
          <div className="viewer-identity">
            <button className="ghost-link" type="button" onClick={onBack}>
              Home
            </button>
            <p className="viewer-subreddit">{sourceLabel}</p>
          </div>

          <form className="viewer-search" onSubmit={handleViewerSearch}>
            <input
              aria-label="Open another subreddit or creator"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <button type="submit">Go</button>
          </form>

          <div className="viewer-dock-utility">
            <div className="viewer-mode-switch" role="tablist" aria-label="Display mode">
              <button
                className={settings.displayMode === 'viewer' ? 'is-active' : ''}
                type="button"
                onClick={() => updateDisplayMode('viewer')}
              >
                Viewer
              </button>
              <button
                className={settings.displayMode === 'grid' ? 'is-active' : ''}
                type="button"
                onClick={() => updateDisplayMode('grid')}
              >
                Grid
              </button>
            </div>

            <button
              className={`viewer-link ${filtersOpen ? '' : 'muted'}`}
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              {filtersOpen ? 'Hide filters' : 'Filters'}
            </button>

            <div className="viewer-shape-switch" role="group" aria-label="Video shape">
              {(
                [
                  ['both', 'All'],
                  ['landscape', 'Wide'],
                  ['portrait', 'Tall'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={settings.orientationFilter === value ? 'is-active' : ''}
                  type="button"
                  onClick={() => {
                    updateSetting('mediaFilter', value === 'both' ? 'both' : 'videos')
                    updateSetting('orientationFilter', value)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="viewer-timer-group" role="group" aria-label="Autoplay timing">
              <button
                className={`viewer-link ${settings.autoAdvance ? '' : 'muted'}`}
                type="button"
                onClick={() => updateSetting('autoAdvance', !settings.autoAdvance)}
              >
                {settings.autoAdvance ? 'Auto' : 'Manual'}
              </button>
              {[3, 6, 10, 15].map((seconds) => (
                <button
                  key={seconds}
                  className={`viewer-link ${
                    settings.autoAdvance && settings.imageDelaySeconds === seconds
                      ? 'is-active'
                      : 'muted'
                  }`}
                  type="button"
                  onClick={() => {
                    updateSetting('autoAdvance', true)
                    updateSetting('imageDelaySeconds', seconds)
                  }}
                >
                  {seconds}s
                </button>
              ))}
            </div>

            <details className="viewer-more-menu">
              <summary className="viewer-link muted">More</summary>
              <div className="viewer-more-panel">
                <button
                  className={`viewer-link ${
                    isFavoritesRoute ? '' : 'muted'
                  }`}
                  type="button"
                  onClick={onOpenFavorites}
                >
                  Favorites list {favoriteEntries.length}
                </button>

                <button
                  className={`viewer-link ${
                    isFollowingCreatorsRoute ? '' : 'muted'
                  }`}
                  type="button"
                  onClick={onOpenFollowingCreators}
                >
                  Followed creators {followedCreators.length}
                </button>

                <button
                  className={`viewer-link ${
                    isFollowingSubredditsRoute ? '' : 'muted'
                  }`}
                  type="button"
                  onClick={onOpenFollowingSubreddits}
                >
                  Followed subs {followedSubreddits.length}
                </button>

                <button className="viewer-link muted" type="button" onClick={onOpenPrivacyDialog}>
                  {hasPrivacyLock ? 'Privacy' : 'Set lock'}
                </button>

                {nsfwEnabled ? (
                  <button
                    className={`viewer-link ${isCinemaRoute ? 'is-active' : 'feature-link'}`}
                    type="button"
                    onClick={onOpenCinema}
                  >
                    Cinema
                  </button>
                ) : null}

                {route.kind === 'author' ? (
                  <button
                    className={`viewer-link ${routeCreatorFollowed ? '' : 'muted'}`}
                    type="button"
                    onClick={() => onToggleFollowCreator(route.author)}
                  >
                    {routeCreatorFollowed ? 'Following creator' : 'Follow creator'}
                  </button>
                ) : null}

                {route.kind === 'subreddit' ? (
                  <button
                    className={`viewer-link ${routeSubredditFollowed ? '' : 'muted'}`}
                    type="button"
                    onClick={() => onToggleFollowSubreddit(route.subreddit)}
                  >
                    {routeSubredditFollowed ? 'Following subreddit' : 'Follow subreddit'}
                  </button>
                ) : null}
              </div>
            </details>

            <label className="toggle-pill compact viewer-toggle">
              <span>NSFW</span>
              <input checked={nsfwEnabled} type="checkbox" onChange={onToggleNsfw} />
            </label>
          </div>
        </div>

        {filtersOpen ? (
          <div className="viewer-dock-filters">
            <FilterGroup
              label="Media"
              options={[
                ['both', 'All'],
                ['photos', 'Photos'],
                ['videos', 'Videos'],
              ]}
              value={settings.mediaFilter}
              onChange={(value) => updateSetting('mediaFilter', value as MediaFilter)}
            />

            <FilterGroup
              label="Shape"
              options={[
                ['both', 'All'],
                ['portrait', 'Portrait'],
                ['landscape', 'Landscape'],
              ]}
              value={settings.orientationFilter}
              onChange={(value) =>
                updateSetting('orientationFilter', value as OrientationFilter)
              }
            />

            {sortOptions.length > 0 ? (
              <FilterGroup
                label="Sort"
                options={sortOptions}
                value={effectiveSortMode}
                onChange={(value) => updateSetting('sortMode', value as SortMode)}
              />
            ) : null}

            <label className="slider-group compact-slider">
              <span>{settings.maxDuration}s max</span>
              <input
                max="300"
                min="10"
                step="10"
                type="range"
                value={settings.maxDuration}
                onChange={(event) =>
                  updateSetting('maxDuration', Number(event.target.value))
                }
              />
            </label>

            <label className="slider-group compact-slider">
              <span>
                {settings.autoAdvance
                  ? `${settings.imageDelaySeconds}s delay`
                  : 'manual advance'}
              </span>
              <input
                max="15"
                min="1"
                step="1"
                type="range"
                value={settings.imageDelaySeconds}
                onChange={(event) => {
                  updateSetting('autoAdvance', true)
                  updateSetting('imageDelaySeconds', Number(event.target.value))
                }}
              />
            </label>

            <label className="toggle-pill compact viewer-toggle">
              <span>Seen</span>
              <input
                checked={settings.hideSeen}
                type="checkbox"
                onChange={() => updateSetting('hideSeen', !settings.hideSeen)}
              />
            </label>

            {isFavoritesRoute && favoriteTags.length > 0 ? (
              <FilterGroup
                label="Tags"
                options={[
                  ['all', 'All'],
                  ...favoriteTags.map((tag) => [tag, tag] as [string, string]),
                ]}
                value={effectiveSelectedTag}
                onChange={setSelectedTag}
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {isGridMode ? (
        <section className="gallery-shell">
          <div className="gallery-toolbar">
            <p className="gallery-count">
              {filteredItems.length} items
              {after ? ' · loading more as you scroll' : ''}
            </p>
            {isFollowingRoute && followedSources.length > 0 ? (
              <div className="gallery-tag-row">
                {followedSources.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() =>
                      isFollowingCreatorsRoute
                        ? onOpenAuthor(source, { displayMode: 'grid' })
                        : onOpenSubreddit(source, { displayMode: 'grid' })
                    }
                  >
                    {isFollowingCreatorsRoute ? `u/${source}` : `/r/${source}`}
                  </button>
                ))}
              </div>
            ) : null}
            {isFavoritesRoute && favoriteTags.length > 0 ? (
              <div className="gallery-tag-row">
                <button
                  className={effectiveSelectedTag === 'all' ? 'is-active' : ''}
                  type="button"
                  onClick={() => setSelectedTag('all')}
                >
                  All tags
                </button>
                {favoriteTags.map((tag) => (
                  <button
                    key={tag}
                    className={effectiveSelectedTag === tag ? 'is-active' : ''}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="empty-state gallery-empty-state">
              <h3>Loading {sourceLabel}</h3>
              <p>Pulling the first batch of media now.</p>
            </div>
          ) : error ? (
            <div className="empty-state gallery-empty-state">
              <h3>Couldn’t load {sourceLabel}</h3>
              <p>{error}</p>
            </div>
          ) : isNsfwBlockedRoute ? (
            <div className="empty-state gallery-empty-state">
              <h3>NSFW is off.</h3>
              <p>Turn on the NSFW switch to view media from {sourceLabel}.</p>
            </div>
          ) : hasEmptyFollowingRoute ? (
            <div className="empty-state gallery-empty-state">
              <h3>
                {isFollowingCreatorsRoute
                  ? 'No followed creators yet.'
                  : 'No followed subreddits yet.'}
              </h3>
              <p>
                {isFollowingCreatorsRoute
                  ? 'Use Follow creator on any post or creator page to build this feed.'
                  : 'Use Follow subreddit on any subreddit or post to build this feed.'}
              </p>
            </div>
          ) : isFavoritesRoute && favoriteEntries.length === 0 ? (
            <div className="empty-state gallery-empty-state">
              <h3>No favorites yet.</h3>
              <p>Save anything you like from the viewer and it will show up here.</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state gallery-empty-state">
              <h3>
                {isFavoritesRoute && effectiveSelectedTag !== 'all'
                  ? `No favorites tagged "${effectiveSelectedTag}".`
                  : 'No media matched these filters.'}
              </h3>
              <p>
                {isFavoritesRoute
                  ? 'Try another tag or widen the media filters.'
                  : 'Try showing seen items again or widening the media filters.'}
              </p>
              <button type="button" onClick={resetContentFilters}>
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className={`gallery-grid ${useFocusedGrid ? 'gallery-grid--focused' : ''}`}>
                {filteredItems.map((item, index) => (
                  <GalleryCard
                    key={item.key}
                    isActive={index === safeIndex}
                    isFavorited={Boolean(favorites[item.key])}
                    item={item}
                    showAuthor={!isSubredditRoute && !isAuthorRoute}
                    showMediaTypeBadge={!isUniformMediaType}
                    showSubreddit={!isSubredditRoute}
                    tags={favorites[item.key]?.tags ?? []}
                    onOpen={() => openGridItem(index)}
                  />
                ))}
              </div>

              {after ? (
                <div className="gallery-sentinel" aria-live="polite">
                  Loading more...
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section
          className="viewer-stage-shell"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={revealChrome}
        >
          <button
            aria-label="Previous item"
            className={`stage-nav stage-nav--prev ${chromeVisible ? 'is-visible' : ''}`}
            type="button"
            onClick={() => moveBy(-1, { userInitiated: true })}
          >
            ‹
          </button>

          <button
            aria-label="Next item"
            className={`stage-nav stage-nav--next ${chromeVisible ? 'is-visible' : ''}`}
            type="button"
            onClick={() => moveBy(1, { userInitiated: true })}
          >
            ›
          </button>

          <div className="progress-track" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>

          <div
            ref={stageFrameRef}
            className={`stage-frame ${
              activeItem?.mediaType === 'video' ? 'stage-frame--top-aligned' : ''
            }`}
          >
            {isLoading ? (
              <div className="empty-state">
                <h3>Loading {sourceLabel}</h3>
                <p>Pulling the first batch of media now.</p>
              </div>
            ) : error ? (
              <div className="empty-state">
                <h3>Couldn’t load {sourceLabel}</h3>
                <p>{error}</p>
              </div>
            ) : isNsfwBlockedRoute ? (
              <div className="empty-state">
                <h3>NSFW is off.</h3>
                <p>Turn on the NSFW switch to view media from {sourceLabel}.</p>
              </div>
            ) : !activeItem ? (
              <div className="empty-state">
                <h3>
                  {hasEmptyFollowingRoute
                    ? isFollowingCreatorsRoute
                      ? 'No followed creators yet.'
                      : 'No followed subreddits yet.'
                    : isFavoritesRoute && favoriteEntries.length === 0
                    ? 'No favorites yet.'
                    : 'No media matched these filters.'}
                </h3>
                <p>
                  {hasEmptyFollowingRoute
                    ? isFollowingCreatorsRoute
                      ? 'Use Follow creator on any post or creator page to build this feed.'
                      : 'Use Follow subreddit on any subreddit or post to build this feed.'
                    : isFavoritesRoute && favoriteEntries.length === 0
                    ? 'Save anything you like from the viewer and it will show up here.'
                    : 'Try showing seen items again or widening the media filters.'}
                </p>
                <button type="button" onClick={resetContentFilters}>
                  Reset filters
                </button>
              </div>
            ) : (
              <StageMedia
                activeItem={activeItem}
                audioRef={audioRef}
                isFullscreen={isFullscreen}
                isMuted={isSoundEffectivelyMuted}
                videoRef={videoRef}
                onAdvance={() => moveBy(1, { userInitiated: true })}
                onAudioAvailability={(availability) => {
                  if (!activeItem) return

                  if (availability === 'available') {
                    setSoundUnavailableItemKey((current) =>
                      current === activeItem.key ? '' : current,
                    )
                    return
                  }

                  if (availability === 'unavailable') {
                    setSoundUnavailableItemKey(activeItem.key)
                  }
                }}
                onMediaVisible={handleMediaVisible}
                onTimeUpdate={(event) => {
                  const node = event.currentTarget
                  if (!Number.isFinite(node.duration) || node.duration === 0) {
                    setProgress(0)
                    return
                  }

                  const audioNode = audioRef.current
                  if (
                    audioNode &&
                    Math.abs(audioNode.currentTime - node.currentTime) > 0.75
                  ) {
                    audioNode.currentTime = node.currentTime
                  }

                  setProgress(node.currentTime / node.duration)
                }}
              />
            )}
            {activeItem ? (
              <div
                className={`stage-quick-controls ${chromeVisible ? 'is-visible' : ''}`}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
              >
                {activeItem.mediaType === 'video' ? (
                  <>
                    <button
                      aria-label={isPaused ? 'Play' : 'Pause'}
                      title={isPaused ? 'Play' : 'Pause'}
                      type="button"
                      onClick={togglePause}
                    >
                      {isPaused ? <PlayIcon /> : <PauseIcon />}
                    </button>
                    <button
                      aria-label={
                        isSoundUnavailable
                          ? 'No sound available'
                          : isSoundEffectivelyMuted
                            ? 'Turn sound on'
                            : 'Mute'
                      }
                      className={!isSoundEffectivelyMuted ? 'is-active' : ''}
                      disabled={isSoundUnavailable}
                      title={
                        isSoundUnavailable
                          ? 'No sound available'
                          : isSoundEffectivelyMuted
                            ? 'Turn sound on'
                            : 'Mute'
                      }
                      type="button"
                      onClick={toggleSound}
                    >
                      {isSoundUnavailable ? (
                        <NoSoundIcon />
                      ) : isSoundEffectivelyMuted ? (
                        <MutedIcon />
                      ) : (
                        <SpeakerIcon />
                      )}
                    </button>
                  </>
                ) : null}
                <button
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  type="button"
                  onClick={handleToggleFullscreen}
                >
                  {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                </button>
              </div>
            ) : null}
          </div>

          {activeItem ? (
            <footer className="stage-footer is-visible">
              <div className="stage-footer-copy">
                <h3>{activeItem.title}</h3>
                <p className="meta-copy">
                  {safeIndex + 1}/{filteredItems.length} ·
                  u/{activeItem.author} · /r/{activeItem.subreddit}
                  {activeItem.duration ? ` · ${formatDuration(activeItem.duration)}` : ''}
                  {activeItem.galleryIndex && activeItem.galleryTotal
                    ? ` · ${activeItem.galleryIndex}/${activeItem.galleryTotal}`
                    : ''}
                </p>
                {activeTags.length > 0 ? (
                  <div className="favorite-tag-list">
                    {activeTags.map((tag) => (
                      <span key={tag} className="gallery-chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="stage-footer-actions">
                <button
                  className={activeFavorite ? 'is-active' : ''}
                  type="button"
                  onClick={() => onToggleFavorite(activeItem)}
                >
                  {activeFavorite ? 'Saved' : 'Favorite'}
                </button>
                <button
                  className={activeCreatorFollowed ? 'is-active' : ''}
                  type="button"
                  onClick={() => onToggleFollowCreator(activeItem.author)}
                >
                  {activeCreatorFollowed ? 'Following creator' : 'Follow creator'}
                </button>
                <button
                  className={activeSubredditFollowed ? 'is-active' : ''}
                  type="button"
                  onClick={() => onToggleFollowSubreddit(activeItem.subreddit)}
                >
                  {activeSubredditFollowed ? 'Following subreddit' : 'Follow subreddit'}
                </button>
                {activeFavorite ? (
                  <button type="button" onClick={handleEditFavoriteTags}>
                    Tags
                  </button>
                ) : null}
                {activeItem.mediaType === 'photo' ? (
                  <button type="button" onClick={togglePause}>
                    {isPaused ? 'Play' : 'Pause'}
                  </button>
                ) : null}
                <button type="button" onClick={handleToggleFullscreen}>
                  {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                </button>
                <button
                  className="viewer-link muted"
                  type="button"
                  onClick={() =>
                    onOpenAuthor(activeItem.author, {
                      displayMode: 'grid',
                      mediaFilter: defaultViewerSettings.mediaFilter,
                      orientationFilter: defaultViewerSettings.orientationFilter,
                      sortMode: 'all',
                    })
                  }
                >
                  View creator
                </button>
                <button
                  className="viewer-link muted"
                  type="button"
                  onClick={() => onOpenSubreddit(activeItem.subreddit)}
                >
                  /r/{activeItem.subreddit}
                </button>
                <button
                  className={commentsOpen ? 'is-active' : ''}
                  type="button"
                  onClick={handleToggleComments}
                >
                  Comments
                </button>
                <a
                  className="viewer-link muted"
                  href={activeItem.permalink}
                  rel="noreferrer"
                  target="_blank"
                >
                  Reddit thread
                </a>
              </div>
              {commentsOpen ? (
                <CommentPreviewCard
                  comments={comments}
                  index={commentIndex}
                  status={commentsStatus}
                  onMove={(direction) =>
                    setCommentIndex((current) => {
                      if (comments.length === 0) return 0
                      return (current + direction + comments.length) % comments.length
                    })
                  }
                />
              ) : null}
            </footer>
          ) : null}
        </section>
      )}
    </main>
  )
}

function CommentPreviewCard({
  comments,
  index,
  status,
  onMove,
}: {
  comments: RedditComment[]
  index: number
  status: 'idle' | 'loading' | 'ready' | 'error'
  onMove: (direction: 1 | -1) => void
}) {
  const safeIndex = comments.length > 0 ? Math.min(index, comments.length - 1) : 0
  const primaryComment = comments[safeIndex]
  const extraComments =
    primaryComment && primaryComment.body.length < 180
      ? comments.filter((_, commentIndex) => commentIndex !== safeIndex).slice(0, 2)
      : []

  return (
    <aside className="comment-preview-card">
      <div className="comment-preview-header">
        <span>Comment peek</span>
        {comments.length > 1 ? (
          <div className="comment-preview-controls">
            <button type="button" onClick={() => onMove(-1)}>
              ‹
            </button>
            <span>
              {safeIndex + 1}/{comments.length}
            </span>
            <button type="button" onClick={() => onMove(1)}>
              ›
            </button>
          </div>
        ) : null}
      </div>

      {status === 'loading' ? (
        <p className="comment-preview-note">Loading top comments...</p>
      ) : status === 'error' ? (
        <p className="comment-preview-note">Couldn’t load comments right now.</p>
      ) : primaryComment ? (
        <div className="comment-preview-scroll">
          <CommentPreviewItem comment={primaryComment} />
          {extraComments.map((comment) => (
            <CommentPreviewItem key={comment.id} comment={comment} compact />
          ))}
        </div>
      ) : (
        <p className="comment-preview-note">No top-level comments to preview.</p>
      )}
    </aside>
  )
}

function CommentPreviewItem({
  comment,
  compact = false,
}: {
  comment: RedditComment
  compact?: boolean
}) {
  return (
    <article className={`comment-preview-item ${compact ? 'is-compact' : ''}`}>
      <p>{comment.body}</p>
      <span>
        u/{comment.author}
        {comment.score ? ` · ${comment.score} pts` : ''}
      </span>
    </article>
  )
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  )
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.2 8.2a5.5 5.5 0 0 1 0 7.6M18.7 5.7a9 9 0 0 1 0 12.6" />
    </svg>
  )
}

function MutedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m17 9 4 6m0-6-4 6" />
    </svg>
  )
}

function NoSoundIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 8h4M17 12h4M17 16h4" />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" className="stroke-icon" viewBox="0 0 24 24">
      <path d="M5 10V5h5M14 5h5v5M19 14v5h-5M10 19H5v-5" />
    </svg>
  )
}

function ExitFullscreenIcon() {
  return (
    <svg aria-hidden="true" className="stroke-icon" viewBox="0 0 24 24">
      <path d="M10 5v5H5M14 5v5h5M19 14h-5v5M10 19v-5H5" />
    </svg>
  )
}

type VideoAudioAvailability = 'available' | 'unavailable' | 'unknown'

type VideoWithAudioHints = HTMLVideoElement & {
  audioTracks?: { length: number }
  mozHasAudio?: boolean
  webkitAudioDecodedByteCount?: number
}

function detectVideoAudioAvailability(node: HTMLVideoElement): VideoAudioAvailability {
  const hintedNode = node as VideoWithAudioHints

  if (typeof hintedNode.mozHasAudio === 'boolean') {
    return hintedNode.mozHasAudio ? 'available' : 'unavailable'
  }

  if (hintedNode.audioTracks && typeof hintedNode.audioTracks.length === 'number') {
    return hintedNode.audioTracks.length > 0 ? 'available' : 'unavailable'
  }

  if (
    typeof hintedNode.webkitAudioDecodedByteCount === 'number' &&
    node.currentTime > 0.75
  ) {
    return hintedNode.webkitAudioDecodedByteCount > 0 ? 'available' : 'unavailable'
  }

  return 'unknown'
}

function StageMedia({
  activeItem,
  audioRef,
  isFullscreen,
  isMuted,
  videoRef,
  onAdvance,
  onAudioAvailability,
  onMediaVisible,
  onTimeUpdate,
}: {
  activeItem: ViewerItem
  audioRef: RefObject<HTMLAudioElement | null>
  isFullscreen: boolean
  isMuted: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  onAdvance: () => void
  onAudioAvailability: (availability: VideoAudioAvailability) => void
  onMediaVisible: () => void
  onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void
}) {
  const mediaClassName = `stage-media stage-media--${activeItem.orientation} ${
    isFullscreen ? 'stage-media--fullscreen' : ''
  }`
  const embedUrl =
    activeItem.kind === 'embed'
      ? applyEmbedPlaybackPreferences(activeItem.mediaUrl, isMuted)
      : ''

  if (activeItem.kind === 'image') {
    return (
      <img
        alt={activeItem.title}
        className={mediaClassName}
        src={activeItem.mediaUrl}
        onLoad={onMediaVisible}
      />
    )
  }

  if (activeItem.kind === 'embed') {
    return (
      <iframe
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        className={mediaClassName}
        key={`${activeItem.key}:${isMuted ? 'muted' : 'unmuted'}`}
        src={embedUrl}
        title={activeItem.title}
        onLoad={onMediaVisible}
      />
    )
  }

  const hasSeparateAudio = Boolean(activeItem.audioUrl)

  const reportAudioAvailability = (node: HTMLVideoElement) => {
    if (hasSeparateAudio) {
      onAudioAvailability('available')
      return
    }

    const availability = detectVideoAudioAvailability(node)
    if (availability !== 'unknown') {
      onAudioAvailability(availability)
    }
  }

  return (
    <>
      <video
        key={activeItem.key}
        ref={videoRef}
        autoPlay
        className={mediaClassName}
        loop={false}
        muted={hasSeparateAudio ? true : isMuted}
        playsInline
        poster={activeItem.posterUrl ?? undefined}
        src={activeItem.mediaUrl}
        onEnded={onAdvance}
        onError={onAdvance}
        onLoadedData={(event) => {
          onMediaVisible()
          reportAudioAvailability(event.currentTarget)
        }}
        onLoadedMetadata={(event) => reportAudioAvailability(event.currentTarget)}
        onPause={() => {
          audioRef.current?.pause()
        }}
        onTimeUpdate={(event) => {
          reportAudioAvailability(event.currentTarget)
          onTimeUpdate(event)
        }}
      >
        Your browser can’t play this video.
      </video>
      {activeItem.audioUrl ? (
        <audio
          key={`${activeItem.key}:audio`}
          ref={audioRef}
          muted={isMuted}
          preload="auto"
          src={activeItem.audioUrl}
        />
      ) : null}
    </>
  )
}

function GalleryCard({
  isActive,
  isFavorited,
  item,
  showAuthor,
  showMediaTypeBadge,
  showSubreddit,
  tags,
  onOpen,
}: {
  isActive: boolean
  isFavorited: boolean
  item: ViewerItem
  showAuthor: boolean
  showMediaTypeBadge: boolean
  showSubreddit: boolean
  tags: string[]
  onOpen: () => void
}) {
  const poster =
    item.posterUrl ??
    (item.kind === 'image'
      ? item.mediaUrl
      : 'linear-gradient(140deg, rgba(36,121,136,0.7), rgba(231,139,97,0.62))')
  const meta = [
    showAuthor ? `u/${item.author}` : null,
    showSubreddit ? `/r/${item.subreddit}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button
      className={`gallery-card ${isActive ? 'is-active' : ''}`}
      type="button"
      onClick={onOpen}
    >
      <div className="gallery-card-poster" style={{ backgroundImage: formatPoster(poster) }}>
        <div className="gallery-card-badges">
          {isFavorited ? <span className="gallery-chip">Saved</span> : null}
          {showMediaTypeBadge ? (
            <span className="gallery-chip">{item.mediaType === 'video' ? 'Video' : 'Photo'}</span>
          ) : null}
          {item.duration ? (
            <span className="gallery-chip">{formatDuration(item.duration)}</span>
          ) : null}
        </div>
      </div>

      <div className="gallery-card-copy">
        <p>{item.title}</p>
        {meta ? <span className="gallery-card-meta">{meta}</span> : null}
        {tags.length > 0 ? (
          <div className="gallery-card-tags">
            {tags.map((tag) => (
              <span key={tag} className="gallery-chip">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  )
}

function SubredditTile({
  forcedPoster,
  nsfwEnabled,
  posterAspect = 'portrait',
  previewEnabled = false,
  previewMediaType = 'any',
  previewOrientation = 'any',
  subtitle,
  subreddit,
  title,
  onOpenSubreddit,
}: {
  forcedPoster?: string | null
  nsfwEnabled: boolean
  posterAspect?: 'portrait' | 'landscape'
  previewEnabled?: boolean
  previewMediaType?: 'any' | 'photo' | 'video'
  previewOrientation?: 'any' | 'portrait' | 'landscape'
  subtitle?: string
  subreddit: string
  title?: string
  onOpenSubreddit: (value: string) => void
}) {
  const tileRef = useRef<HTMLButtonElement | null>(null)
  const isPreviewNearViewport = useNearViewport(tileRef, previewEnabled)
  const preview = useSubredditPreview(
    subreddit,
    nsfwEnabled,
    forcedPoster ?? null,
    previewEnabled && isPreviewNearViewport,
    previewMediaType,
    previewOrientation,
  )

  const poster =
    forcedPoster ??
    preview?.posterUrl ??
    buildTileGradient(subreddit)

  return (
    <button
      ref={tileRef}
      className={`subreddit-tile subreddit-tile--${posterAspect}`}
      type="button"
      onClick={() => onOpenSubreddit(subreddit)}
    >
      <div
        className={`tile-poster tile-poster--${posterAspect}`}
        style={{ backgroundImage: formatPoster(poster) }}
      />
      <div className="tile-copy">
        <p>{title ?? `/r/${subreddit}`}</p>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
    </button>
  )
}

function useNearViewport<T extends Element>(
  ref: RefObject<T | null>,
  enabled: boolean,
) {
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (isNearViewport) return

    const node = ref.current
    if (!node || !('IntersectionObserver' in window)) {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsNearViewport(true)
        observer.disconnect()
      },
      {
        rootMargin: PREVIEW_ROOT_MARGIN,
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, isNearViewport, ref])

  return isNearViewport
}

function SectionRow({
  children,
  hint,
  title,
  variant = 'default',
}: {
  children: ReactNode
  hint?: string
  title: string
  variant?: 'default' | 'showcase-landscape' | 'showcase-portrait'
}) {
  return (
    <section className="row-section">
      <header className="row-header">
        <div className="row-header-copy">
          <p className="eyebrow">{title}</p>
          {hint ? <p className="row-hint">{hint}</p> : null}
        </div>
      </header>
      <div className={`tile-row ${variant ? `tile-row--${variant}` : ''}`}>{children}</div>
    </section>
  )
}

function TextSubredditDirectory({
  onOpenSubreddit,
  sections,
}: {
  onOpenSubreddit: (value: string) => void
  sections: Array<{ title: string; subreddits: string[] }>
}) {
  const [expandedSections, setExpandedSections] = useState<string[]>([])

  return (
    <section className="text-directory">
      <header className="row-header">
        <div className="row-header-copy">
          <p className="eyebrow">More Subreddits</p>
          <p className="row-hint">
            Text-only list for the basics, kept light so the homepage does not become a wall of cards.
          </p>
        </div>
      </header>

      <div className="text-directory-grid">
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.title)
          const visibleSubreddits = isExpanded
            ? section.subreddits
            : section.subreddits.slice(0, 8)
          const hasMore = section.subreddits.length > visibleSubreddits.length

          return (
            <div key={section.title} className="text-directory-card">
              <div className="text-directory-card-header">
                <h3>{section.title}</h3>
                {section.subreddits.length > 8 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((current) =>
                        isExpanded
                          ? current.filter((title) => title !== section.title)
                          : [...current, section.title],
                      )
                    }
                  >
                    {isExpanded ? 'Show less' : `Show ${section.subreddits.length - 8} more`}
                  </button>
                ) : null}
              </div>

              <div className="text-link-list">
                {visibleSubreddits.map((subreddit) => (
                  <button
                    key={subreddit}
                    type="button"
                    onClick={() => onOpenSubreddit(subreddit)}
                  >
                    /r/{subreddit}
                  </button>
                ))}
              </div>

              {hasMore ? <p className="text-directory-fade">More hidden</p> : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function FilterGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (nextValue: string) => void
  options: Array<[string, string]>
  value: string
}) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div className="chip-row">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            className={optionValue === value ? 'is-active' : ''}
            type="button"
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

function useSubredditPreview(
  subreddit: string,
  nsfwEnabled: boolean,
  forcedPoster: string | null,
  enabled: boolean,
  preferredMediaType: 'any' | 'photo' | 'video' = 'any',
  preferredOrientation: 'any' | 'portrait' | 'landscape' = 'any',
) {
  const [preview, setPreview] = useState<ViewerItem | null>(null)

  useEffect(() => {
    if (forcedPoster || !enabled) {
      return
    }

    let ignore = false

    fetchSubredditPreview({
      limit:
        preferredMediaType !== 'any' || preferredOrientation !== 'any' ? 50 : 18,
      nsfwEnabled,
      subreddit,
    })
      .then((page: ListingPage) => {
        if (ignore) return
        setPreview(
          pickPreviewItem(page.items, {
            preferredMediaType,
            preferredOrientation,
          }),
        )
      })
      .catch(() => {
        if (!ignore) {
          setPreview(null)
        }
      })

    return () => {
      ignore = true
    }
  }, [
    enabled,
    forcedPoster,
    nsfwEnabled,
    preferredMediaType,
    preferredOrientation,
    subreddit,
  ])

  return preview
}

function pickPreviewItem(
  items: ViewerItem[],
  {
    preferredMediaType,
    preferredOrientation,
  }: {
    preferredMediaType: 'any' | 'photo' | 'video'
    preferredOrientation: 'any' | 'portrait' | 'landscape'
  },
) {
  const matchesPreferred = (item: ViewerItem) =>
    (preferredMediaType === 'any' || item.mediaType === preferredMediaType) &&
    (preferredOrientation === 'any' || item.orientation === preferredOrientation)

  const matchesMediaType = (item: ViewerItem) =>
    preferredMediaType === 'any' || item.mediaType === preferredMediaType

  const matchesOrientation = (item: ViewerItem) =>
    preferredOrientation === 'any' || item.orientation === preferredOrientation

  return (
    items.find(matchesPreferred) ??
    (preferredOrientation !== 'any'
      ? items.find(matchesOrientation)
      : items.find(matchesMediaType)) ??
    (preferredOrientation !== 'any'
      ? items.find(matchesMediaType)
      : items.find(matchesOrientation)) ??
    items[0] ??
    null
  )
}

function usePersistentState<T>(
  key: string,
  fallback: T,
  hydrate?: (value: T) => T,
) {
  const [state, setState] = useState<T>(() => {
    const loaded = loadStoredValue(key, fallback)
    return hydrate ? hydrate(loaded) : loaded
  })

  useEffect(() => {
    saveStoredValue(key, hydrate ? hydrate(state) : state)
  }, [hydrate, key, state])

  return [state, setState] as const
}

function parseRoute(pathname: string): Route {
  if (/^\/nsfw\/?$/i.test(pathname)) {
    return {
      kind: 'home',
      nsfw: true,
    }
  }

  if (/^\/favorites\/?$/i.test(pathname)) {
    return { kind: 'favorites' }
  }

  if (/^\/cinema\/?$/i.test(pathname)) {
    return { kind: 'cinema' }
  }

  if (/^\/following\/creators\/?$/i.test(pathname)) {
    return { kind: 'following-creators' }
  }

  if (/^\/following\/subreddits\/?$/i.test(pathname)) {
    return { kind: 'following-subreddits' }
  }

  const subredditMatch = pathname.match(/^\/r\/([^/]+)\/?$/i)
  if (subredditMatch?.[1]) {
    return {
      kind: 'subreddit',
      subreddit: decodeURIComponent(subredditMatch[1]),
    }
  }

  const authorMatch = pathname.match(/^\/u\/([^/]+)\/?$/i)
  if (authorMatch?.[1]) {
    return {
      kind: 'author',
      author: decodeURIComponent(authorMatch[1]),
    }
  }

  console.warn(`RedFlix: unrecognized path "${pathname}", defaulting to home.`)

  return {
    kind: 'home',
    nsfw: false,
  }
}

function normalizeSubredditInput(value: string) {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?reddit\.com\//i, '')
    .replace(/^\/?r\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

  if (!/^[A-Za-z0-9_]{2,32}$/.test(cleaned)) return ''

  const aliases: Record<string, string> = {
    pornin15seconds: 'porninfifteenseconds',
    pornin15secs: 'porninfifteenseconds',
  }

  return aliases[cleaned.toLowerCase()] ?? cleaned
}

function normalizeAuthorInput(value: string) {
  const cleaned = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?reddit\.com\//i, '')
    .replace(/^\/?user\//i, '')
    .replace(/^\/?u\//i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')

  if (!/^[A-Za-z0-9_-]{2,32}$/.test(cleaned)) return ''
  return cleaned
}

function parseBrowseTarget(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (
    /^https?:\/\/(?:www\.)?reddit\.com\/(?:u|user)\//i.test(trimmed) ||
    /^\/?(?:u|user)\//i.test(trimmed)
  ) {
    const author = normalizeAuthorInput(trimmed)
    return author ? { kind: 'author' as const, author } : null
  }

  const subreddit = normalizeSubredditInput(trimmed)
  return subreddit ? { kind: 'subreddit' as const, subreddit } : null
}

function parseFavoriteTags(value: string) {
  const seen = new Set<string>()

  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/\s+/g, ' '))
    .filter((tag) => {
      if (!tag) return false
      const key = tag.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 12)
}

function insertUniqueSubreddit(current: string[], nextSubreddit: string) {
  const seen = new Set<string>()
  const merged = [nextSubreddit, ...current].filter((entry) => {
    const key = entry.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return merged.slice(0, 18)
}

function toggleFollowedValue(current: string[], nextValue: string) {
  const normalizedNext = nextValue.toLowerCase()
  const exists = current.some((entry) => entry.toLowerCase() === normalizedNext)

  if (exists) {
    return current.filter((entry) => entry.toLowerCase() !== normalizedNext)
  }

  return [nextValue, ...current].slice(0, 60)
}

function matchesLandingMode({
  subreddit,
  nsfwEnabled,
  sessions,
}: {
  subreddit: string
  nsfwEnabled: boolean
  sessions: ViewerSessions
}) {
  const normalized = normalizeSubredditInput(subreddit).toLowerCase()
  if (!normalized) return !nsfwEnabled

  const knownNsfw = isKnownNsfwSubreddit(normalized)
  if (knownNsfw) {
    return nsfwEnabled
  }

  const session = sessions[toSessionKey(subreddit)]
  if (typeof session?.over18 === 'boolean') {
    return session.over18 === nsfwEnabled
  }

  return nsfwEnabled ? knownNsfw : !knownNsfw
}

function matchesViewerFilters({
  item,
  nsfwEnabled,
  seenSet,
  settings,
}: {
  item: ViewerItem
  nsfwEnabled: boolean
  seenSet: Set<string>
  settings: ViewerSettings
}) {
  if (!nsfwEnabled && item.over18) return false
  if (!nsfwEnabled && isKnownNsfwSubreddit(item.subreddit)) return false

  if (settings.mediaFilter === 'photos' && item.mediaType !== 'photo') {
    return false
  }

  if (settings.mediaFilter === 'videos' && item.mediaType !== 'video') {
    return false
  }

  if (
    settings.orientationFilter !== 'both' &&
    item.orientation !== settings.orientationFilter
  ) {
    return false
  }

  if (item.duration && item.duration > settings.maxDuration) {
    return false
  }

  if (settings.hideSeen && seenSet.has(item.key)) {
    return false
  }

  return true
}

function matchesFavoriteTag({
  favorites,
  item,
  route,
  selectedTag,
}: {
  favorites: FavoriteEntries
  item: ViewerItem
  route: Exclude<Route, { kind: 'home' }>
  selectedTag: string
}) {
  if (route.kind !== 'favorites' || selectedTag === 'all') {
    return true
  }

  const tags = favorites[item.key]?.tags ?? []
  return tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase())
}

function isInteractivePointerTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false

  return Boolean(
    target.closest(
      'a, button, input, textarea, select, summary, label, [role="button"]',
    ),
  )
}

function mergeItems(current: ViewerItem[], incoming: ViewerItem[]) {
  const seen = new Set(current.map((item) => item.key))
  const merged = [...current]

  incoming.forEach((item) => {
    if (seen.has(item.key)) return
    seen.add(item.key)
    merged.push(item)
  })

  return merged
}

function cloneSectionCollection(
  sections: CuratedSection[] | TextSubredditSection[],
): CuratedSection[] {
  return sections.map((section) => ({
    ...section,
    subreddits: [...section.subreddits],
  }))
}

function cloneHomepageCurationConfig(
  config: HomepageCurationConfig,
): HomepageCurationConfig {
  return {
    nsfwLandscapeShowcase: config.nsfwLandscapeShowcase.map((item) => ({ ...item })),
    nsfwMoreSections: config.nsfwMoreSections.map((section) => ({
      ...section,
      subreddits: [...section.subreddits],
    })),
    nsfwPortraitShowcase: config.nsfwPortraitShowcase.map((item) => ({ ...item })),
    nsfwSections: config.nsfwSections.map((section) => ({
      ...section,
      subreddits: [...section.subreddits],
    })),
    sfwLandscapeShowcase: config.sfwLandscapeShowcase.map((item) => ({ ...item })),
    sfwPortraitShowcase: config.sfwPortraitShowcase.map((item) => ({ ...item })),
    sfwSections: config.sfwSections.map((section) => ({
      ...section,
      subreddits: [...section.subreddits],
    })),
  }
}

function normalizeSectionDraft(
  value: unknown,
  fallback: CuratedSection[] | TextSubredditSection[],
) {
  if (!Array.isArray(value)) {
    return cloneSectionCollection(fallback)
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null

      const title =
        typeof (entry as { title?: unknown }).title === 'string'
          ? (entry as { title: string }).title.trim()
          : ''
      const rawSubreddits = Array.isArray((entry as { subreddits?: unknown }).subreddits)
        ? (entry as { subreddits: unknown[] }).subreddits
        : []
      const subreddits = rawSubreddits
        .map((item) => (typeof item === 'string' ? normalizeSubredditInput(item) : ''))
        .filter(Boolean)

      return title || subreddits.length > 0
        ? {
            title: title || 'Untitled section',
            subreddits,
          }
        : null
    })
    .filter((entry): entry is CuratedSection => Boolean(entry))

  return normalized.length > 0 ? normalized : cloneSectionCollection(fallback)
}

function normalizeShowcaseDraft(
  value: unknown,
  fallback: LandscapeVideoShowcase[],
) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }))
  }

  const normalized = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null

      const subreddit =
        typeof (entry as { subreddit?: unknown }).subreddit === 'string'
          ? normalizeSubredditInput((entry as { subreddit: string }).subreddit)
          : ''

      if (!subreddit) return null

      const title =
        typeof (entry as { title?: unknown }).title === 'string'
          ? (entry as { title: string }).title.trim()
          : ''
      const subtitle =
        typeof (entry as { subtitle?: unknown }).subtitle === 'string'
          ? (entry as { subtitle: string }).subtitle.trim()
          : ''

      return {
        title: title || `/r/${subreddit}`,
        subtitle,
        subreddit,
      }
    })
    .filter((entry): entry is LandscapeVideoShowcase => Boolean(entry))

  return normalized.length > 0 ? normalized : fallback.map((item) => ({ ...item }))
}

function normalizeHomepageCurationConfig(
  value: HomepageCurationConfig | unknown,
): HomepageCurationConfig {
  const parsed = value && typeof value === 'object' ? value : {}

  return {
    nsfwLandscapeShowcase: normalizeShowcaseDraft(
      (parsed as { nsfwLandscapeShowcase?: unknown }).nsfwLandscapeShowcase,
      defaultHomepageCurationConfig.nsfwLandscapeShowcase,
    ),
    nsfwMoreSections: normalizeSectionDraft(
      (parsed as { nsfwMoreSections?: unknown }).nsfwMoreSections,
      defaultHomepageCurationConfig.nsfwMoreSections,
    ),
    nsfwPortraitShowcase: normalizeShowcaseDraft(
      (parsed as { nsfwPortraitShowcase?: unknown }).nsfwPortraitShowcase,
      defaultHomepageCurationConfig.nsfwPortraitShowcase,
    ),
    nsfwSections: normalizeSectionDraft(
      (parsed as { nsfwSections?: unknown }).nsfwSections,
      defaultHomepageCurationConfig.nsfwSections,
    ),
    sfwLandscapeShowcase: normalizeShowcaseDraft(
      (parsed as { sfwLandscapeShowcase?: unknown }).sfwLandscapeShowcase,
      defaultHomepageCurationConfig.sfwLandscapeShowcase,
    ),
    sfwPortraitShowcase: normalizeShowcaseDraft(
      (parsed as { sfwPortraitShowcase?: unknown }).sfwPortraitShowcase,
      defaultHomepageCurationConfig.sfwPortraitShowcase,
    ),
    sfwSections: normalizeSectionDraft(
      (parsed as { sfwSections?: unknown }).sfwSections,
      defaultHomepageCurationConfig.sfwSections,
    ),
  }
}

function parseSubredditDraft(value: string) {
  const entries = value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  const seen = new Set<string>()

  return entries.filter((entry) => {
    const key = entry.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items

  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function buildKnownNsfwSet(config: HomepageCurationConfig) {
  const entries = [
    ...config.nsfwSections.flatMap((section) => section.subreddits),
    ...config.nsfwMoreSections.flatMap((section) => section.subreddits),
    ...config.nsfwLandscapeShowcase.map((item) => item.subreddit),
    ...config.nsfwPortraitShowcase.map((item) => item.subreddit),
    ...curatedNsfwCinemaSources,
  ]

  return new Set(
    entries
      .map((entry) => normalizeSubredditInput(entry).toLowerCase())
      .filter(Boolean),
  )
}

function syncKnownNsfwSubreddits(config: HomepageCurationConfig) {
  knownNsfwSubreddits = buildKnownNsfwSet(config)
  subredditPreviewCache.clear()
}

function isKnownNsfwSubreddit(value: string) {
  const normalized = normalizeSubredditInput(value).toLowerCase()
  if (!normalized) return false

  return knownNsfwSubreddits.has(normalized) || supplementalNsfwSubreddits.has(normalized)
}

function formatDuration(valueInSeconds: number) {
  const minutes = Math.floor(valueInSeconds / 60)
  const seconds = Math.floor(valueInSeconds % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function buildTileGradient(seed: string) {
  let hash = 0

  for (const char of seed.toLowerCase()) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash |= 0
  }

  const hueA = Math.abs(hash) % 360
  const hueB = (hueA + 54 + (Math.abs(hash) % 36)) % 360

  return `linear-gradient(145deg, hsla(${hueA}, 52%, 30%, 0.94), hsla(${hueB}, 74%, 58%, 0.84))`
}

function formatPoster(value: string) {
  if (value.startsWith('linear-gradient')) {
    return value
  }

  return `url("${value}")`
}

function buildSessionTitle(item: ViewerItem) {
  if (!item.galleryIndex || !item.galleryTotal) return item.title
  return `${item.title} (${item.galleryIndex}/${item.galleryTotal})`
}

function buildPathForRoute(route: Route) {
  if (route.kind === 'home') {
    return route.nsfw ? '/nsfw' : '/'
  }

  if (route.kind === 'favorites') {
    return '/favorites'
  }

  if (route.kind === 'cinema') {
    return '/cinema'
  }

  if (route.kind === 'following-creators') {
    return '/following/creators'
  }

  if (route.kind === 'following-subreddits') {
    return '/following/subreddits'
  }

  if (route.kind === 'author') {
    return `/u/${encodeURIComponent(route.author)}`
  }

  return `/r/${encodeURIComponent(route.subreddit)}`
}

function toSessionKey(subreddit: string) {
  return subreddit.toLowerCase()
}

function buildRouteKey(route: Exclude<Route, { kind: 'home' }>) {
  if (route.kind === 'favorites') {
    return 'favorites'
  }

  if (route.kind === 'cinema') {
    return 'cinema'
  }

  if (route.kind === 'following-creators') {
    return 'following-creators'
  }

  if (route.kind === 'following-subreddits') {
    return 'following-subreddits'
  }

  if (route.kind === 'author') {
    return `author:${route.author}`
  }

  return `subreddit:${route.subreddit}`
}

async function toggleFullscreen(target?: HTMLElement | null) {
  if (!document.fullscreenElement) {
    const nextTarget = target ?? document.documentElement
    await nextTarget.requestFullscreen()
    return
  }

  await document.exitFullscreen()
}

async function exitFullscreenIfNeeded() {
  if (!document.fullscreenElement) return

  await document.exitFullscreen()
}

async function hashSecret(value: string) {
  if (globalThis.crypto?.subtle) {
    const payload = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', payload)

    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  }

  let hash = 2166136261

  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash).toString(16)
}

async function fetchSubredditPreview({
  limit,
  nsfwEnabled,
  subreddit,
}: {
  limit: number
  nsfwEnabled: boolean
  subreddit: string
}) {
  const cacheKey = `${nsfwEnabled ? 'nsfw' : 'sfw'}:${subreddit.toLowerCase()}:${limit}`
  const cached = subredditPreviewCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const promise = enqueuePreviewRequest(async () => {
    const page = await fetchSubredditPage({
      subreddit,
      sortMode: 'hot',
      limit,
    })

    const previewItems = page.items.filter(
      (item) =>
        nsfwEnabled || (!item.over18 && !isKnownNsfwSubreddit(item.subreddit)),
    )

    return {
      after: null,
      items: previewItems,
    }
  })

  subredditPreviewCache.set(cacheKey, promise)

  return promise.catch((error) => {
    subredditPreviewCache.delete(cacheKey)
    throw error
  })
}

function enqueuePreviewRequest<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    previewRequestQueue.push(async () => {
      activePreviewRequests += 1

      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      } finally {
        activePreviewRequests -= 1
        runNextPreviewRequest()
      }
    })

    runNextPreviewRequest()
  })
}

function runNextPreviewRequest() {
  if (activePreviewRequests >= MAX_PREVIEW_REQUESTS) return

  const nextTask = previewRequestQueue.shift()
  if (!nextTask) return

  void nextTask()
}

async function fetchFollowedFeed({
  after,
  creators,
  sortMode,
  subreddits,
}: {
  after?: string | null
  creators?: string[]
  sortMode: SortMode
  subreddits?: string[]
}) {
  const sources = creators
    ? creators.map((creator) => ({
        key: `u:${creator.toLowerCase()}`,
        kind: 'creator' as const,
        name: creator,
      }))
    : (subreddits ?? []).map((subreddit) => ({
        key: `r:${subreddit.toLowerCase()}`,
        kind: 'subreddit' as const,
        name: subreddit,
      }))
  const sourceCursors = parseMixedFeedCursor(after)
  const activeSources = after
    ? sources.filter((source) => sourceCursors[source.key])
    : sources

  if (activeSources.length === 0) {
    return {
      after: null,
      items: [],
    }
  }

  const settled = await Promise.allSettled(
    activeSources.map((source) =>
      source.kind === 'creator'
        ? fetchUserPage({
            username: source.name,
            sortMode,
            after: sourceCursors[source.key] ?? null,
            limit: 24,
          })
        : fetchSubredditPage({
            subreddit: source.name,
            sortMode,
            after: sourceCursors[source.key] ?? null,
            limit: 24,
          }),
    ),
  )

  const pages: ListingPage[] = []
  const rejected: PromiseRejectedResult[] = []
  const nextCursors: Record<string, string> = {}

  settled.forEach((result, index) => {
    const source = activeSources[index]
    if (!source) return

    if (result.status === 'fulfilled') {
      pages.push(result.value)
      if (result.value.after) {
        nextCursors[source.key] = result.value.after
      }
      return
    }

    rejected.push(result)
    if (sourceCursors[source.key]) {
      nextCursors[source.key] = sourceCursors[source.key]
    }
  })

  if (pages.length === 0 && rejected.length > 0) {
    throw rejected[0].reason
  }

  return {
    after: buildMixedFeedCursor(nextCursors),
    items: mergeRoundRobinPages(pages),
  }
}

function parseMixedFeedCursor(value?: string | null) {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  } catch {
    return {}
  }
}

function buildMixedFeedCursor(cursors: Record<string, string>) {
  return Object.keys(cursors).length > 0 ? JSON.stringify(cursors) : null
}

function mergeRoundRobinPages(pages: ListingPage[]) {
  const buckets = pages.map((page) => page.items)
  const merged: ViewerItem[] = []
  const seen = new Set<string>()
  let index = 0

  while (buckets.some((bucket) => bucket[index])) {
    buckets.forEach((bucket) => {
      const item = bucket[index]
      if (!item || seen.has(item.key)) return
      seen.add(item.key)
      merged.push(item)
    })

    index += 1
  }

  return merged
}

export default App
