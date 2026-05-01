# Current State

This document is the quickest snapshot of what RedFlix does today.

## Main Routes

- `/` - SFW homepage. This is the default landing page.
- `/nsfw` - NSFW homepage. NSFW does not load by default unless the user opens this route or toggles into it.
- `/r/:subreddit` - subreddit viewer and grid.
- `/u/:username` - creator gallery sourced from that user's posts.
- `/favorites` - saved favorites.
- `/following/creators` - feed of followed creators.
- `/following/subreddits` - feed of followed subreddits.
- `/cinema` - curated autoplay route for the wide-video experience.

## Homepage Behavior

- SFW and NSFW home are intentionally separated.
- The homepage includes curated rows of subreddit cards plus showcase rows for video-heavy browsing.
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
- `Hide seen` is persisted locally and can pull deeper pages to avoid getting stuck on already-viewed posts.
- Attempted autoplay with sound when moving to the next direct video.
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
- seen items
- viewer settings
- homepage curation
- NSFW toggle state
- privacy lock state

## Known Caveats

- Some third-party embeds still ignore autoplay or unmuted playback because of browser or provider restrictions.
- Hosted deployments depend on valid Reddit API credentials.
- Reddit rate limits can still affect some homepage previews or busy subreddit loads.
- Local state does not sync between browsers or devices.
