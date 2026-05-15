# Current State

This document is the quickest snapshot of what RedFlix does today.

## Main Routes

- `/` - SFW homepage. This is the default landing page.
- `/nsfw` - NSFW homepage. NSFW does not load by default unless the user opens this route or switches into it deliberately.
- `/r/:subreddit` - subreddit viewer and grid.
- `/u/:username` or `/user/:username` - creator gallery sourced from that user's posts.
- `/favorites` - saved favorites.
- `/following/creators` - feed of followed creators.
- `/following/subreddits` - feed of followed subreddits.
- `/cinema` - curated autoplay route for the wide-video experience.

## Homepage Behavior

- SFW and NSFW home are intentionally separated.
- The SFW homepage keeps NSFW access low-profile: the adult switch lives in the footer instead of the top bar.
- The NSFW homepage now leads with an amateur-first photo row, then separates sound-on wide video from higher-quality GIF and quick-clip discovery.
- The homepage now opens with a quieter two-column hero: search and quick launch on one side, library/manage shortcuts on the other.
- Full-size homepage rows are deliberately limited: `Continue` if present, one featured row, then paired `Wide video` and `Tall video` lanes.
- Saved subreddits are surfaced as compact chips in the hero instead of taking up a whole visual row.
- The homepage leads with a small number of card-heavy sections, then pushes the long tail into a compact category browse area.
- Visual homepage sections are capped to two clean rows before a `Show more` expansion so the page does not end with awkward leftover cards on a third line.
- Wide-video and tall-video showcase rows are treated separately and can sit side by side on larger screens so portrait and landscape discovery do not fight each other.
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
- Freshness filtering no longer ejects items you already stepped through in the current viewer session, so next/back navigation stays stable while you browse.
- The top dock is now intentionally lean: `Home`, source, search, `Viewer / Grid`, `Filters`, and `Info`.
- Quick `All / Wide / Tall` switching now lives inside the expanded filters panel instead of the main dock.
- Reddit-style ranking controls such as `Hot`, `Top day`, `Top week`, `Top month`, and `Top all` live in the expanded filters panel.
- The filters panel also includes `Sound` filters so known-audio and known-silent videos can be separated quickly.
- Favorites, followed feeds, privacy, NSFW, cinema, and reset actions are now consolidated into the same filters/settings surface instead of living in a separate `More` menu.
- The right-side info panel can be hidden and reopened with the `Info` control, and its actions are grouped into primary follow/autoplay actions and smaller secondary link-outs.
- Portrait items use vertical arrows and accept `↑` / `↓` keyboard navigation; landscape items use left/right arrows.
- Known video-heavy subreddits can open with a smarter default orientation so TikTok-style feeds bias tall and wide-video feeds bias landscape.
- Attempted autoplay with sound when moving to the next direct video.
- Automatic next-item advance now behaves like autoplay rather than a manual skip, which makes end-of-video handoff more reliable.
- Failed clips now stop on an inline error card with `Retry` and `Next` instead of silently skipping through the whole feed.
- Reddit-hosted videos and some embed-backed posts can now be marked as known-sound or known-silent; fully opaque third-party embeds still fall back to `All` when audio cannot be classified ahead of time.
- Hover controls in fullscreen for play/pause, mute, and the top viewer dock.
- The persistent keyboard shortcut hint line is gone; shortcuts stay the same, but the viewer chrome is less noisy.
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
