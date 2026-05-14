# Current State

This document is the quickest snapshot of what RedFlix does today.

## Main Routes

- `/` - SFW homepage. This is the default landing page.
- `/nsfw` - NSFW homepage. NSFW does not load by default unless the user opens this route or switches into it deliberately.
- `/r/:subreddit` - subreddit viewer and grid.
- `/u/:username` - creator gallery sourced from that user's posts.
- `/favorites` - saved favorites.
- `/following/creators` - feed of followed creators.
- `/following/subreddits` - feed of followed subreddits.
- `/cinema` - curated autoplay route for the wide-video experience.

## Homepage Behavior

- SFW and NSFW home are intentionally separated.
- The SFW homepage keeps NSFW access low-profile: the adult switch lives in the footer instead of the top bar.
- The homepage leads with a small number of card-heavy sections, then pushes the long tail into a compact text-only browse area.
- Visual homepage sections are capped to two clean rows before a `Show more` expansion so the page does not end with awkward leftover cards on a third line.
- Wide-video and tall-video showcase rows are treated separately so portrait and landscape discovery do not fight each other.
- On the NSFW homepage, the regular subreddit links now open straight into viewer mode rather than dropping into grid first.
- The `Edit home` button opens a local curation editor so homepage rows can be changed without code edits.
- Homepage curation is stored in the browser and is specific to that device and browser profile.

## Viewer Modes

- `Viewer` mode shows a single active post with keyboard and on-screen navigation.
- `Grid` mode shows a responsive gallery that expands to fit larger monitors.
- `Cinema` is a preselected autoplay-focused mode for video browsing.
- Fullscreen is media-first and keeps the main chrome hidden until hover or interaction.

## Viewer Features

- Auto-advance with selectable timing.
- Image, GIF, and video support with Reddit and third-party sources where available.
- Freshness filtering is built around local seen timestamps with `All`, `Today`, `3d`, and `7d` windows.
- The viewer defaults to a `3d` freshness cooldown so returning visits stay fresher without abandoning quality-first sorting.
- When the current page is too stale, the viewer can pull deeper Reddit pages automatically to top up fresh results.
- The top dock now exposes `All`, `Wide`, and `Tall` as quick view switches, while deeper sorting and timing controls live under `Controls`.
- Reddit-style ranking controls such as `Hot`, `Top day`, `Top week`, `Top month`, and `Top all` live in the expanded controls row.
- The controls row also includes `Sound` filters so known-audio and known-silent videos can be separated quickly.
- The viewer no longer shows an NSFW toggle in the top dock; it lives inside the `More` menu.
- The right-side info panel can be hidden and reopened with the `Info` control.
- Portrait items use vertical arrows and accept `↑` / `↓` keyboard navigation; landscape items use left/right arrows.
- Known video-heavy subreddits can open with a smarter default orientation so TikTok-style feeds bias tall and wide-video feeds bias landscape.
- Attempted autoplay with sound when moving to the next direct video.
- Failed clips now stop on an inline error card with `Retry` and `Next` instead of silently skipping through the whole feed.
- Reddit-hosted videos and some embed-backed posts can now be marked as known-sound or known-silent; fully opaque third-party embeds still fall back to `All` when audio cannot be classified ahead of time.
- Hover controls in fullscreen for play/pause, mute, and the top viewer dock.
- `Comments` button for lightweight comment preview before leaving the app.
- `Reddit thread` button for opening the original Reddit post.
- `View creator` flow for creator-focused browsing.

## Privacy and Escape Features

- `Esc` opens the safe-cover quick-exit page.
- The quick-exit page includes a `Return` button back to the exact previous route.
- There is also a local privacy lock flow in the app for extra concealment.

## Saved Local State

RedFlix currently stores everything in localStorage:

- favorites
- favorite tags
- followed creators
- followed subreddits
- saved subreddits
- sessions / continue watching state
- seen history with timestamps
- viewer settings
- homepage curation
- NSFW toggle state
- privacy lock state

## Known Caveats

- Some third-party embeds still ignore autoplay or unmuted playback because of browser or provider restrictions.
- Hosted deployments depend on valid Reddit API credentials.
- Reddit rate limits can still affect some homepage previews or busy subreddit loads.
- Local state does not sync between browsers or devices.
