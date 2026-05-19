# Viewer Navigation Bug Handoff

This file is the focused handoff for the unresolved viewer navigation bug in RedFlix.

## Current Problem

In `Viewer` mode, next/back navigation is still unstable.

Observed behavior:

- pressing `Right Arrow` once can effectively skip multiple items
- pressing `Left Arrow` after moving forward does not reliably return through the same items
- going forward 5 items and then back 5 items can show a completely different sequence
- the issue can affect keyboard navigation and can also show up through media auto-advance interactions

## Repo / Main File

- repo root: `/Users/colly/Documents/New project/redditp-next`
- main file: [src/App.tsx](/Users/colly/Documents/New%20project/redditp-next/src/App.tsx)

## Repro

Use any active subreddit in `Viewer` mode, ideally one with mixed media or videos.

Basic repro:

1. open a subreddit in `Viewer`
2. press `Right Arrow` 5 times, one press at a time
3. press `Left Arrow` 5 times
4. expected: you should retrace the exact same 5 items in reverse
5. actual: the sequence can drift, skip, or land on different items

## Why This Looks Harder Than A Small Bug

This does not behave like a simple keyboard repeat problem anymore.

The likely deeper issue is that the viewer still uses a numeric `activeIndex` over a filtered array that is not stable while browsing.

That array can change because of:

- freshness / seen-state updates
- pagination / merged pages
- filter recalculation
- route/session persistence interactions

So:

- index `N` may no longer point to the same item a moment later
- “back” is not true history, it is just “previous index in the current filtered array”
- stale media events may amplify the problem, but they are probably not the full root cause

## Areas Already Investigated

Relevant areas in [src/App.tsx](/Users/colly/Documents/New%20project/redditp-next/src/App.tsx):

- `filteredItems`
- `filteredItemsIgnoringFreshness`
- `safeIndex`
- `moveBy(...)`
- `handleMediaVisible(...)`
- `setFreshnessExemptKeys(...)`
- `onMarkSeen(...)`
- `StageMedia`
- `onEnded={onAdvance}`
- `handleStageAdvance(...)`
- `handleMediaError(...)`

## Fixes Already Tried

Several defensive fixes have already been attempted:

1. ignore repeated arrow-key `keydown` events
2. short navigation locks / debouncing around `moveBy(...)`
3. guard `onEnded` / `onError` so stale media events from a previous item should not affect the current one
4. move that guard earlier so it flips as navigation starts
5. exempt currently viewed items from freshness filtering so they do not disappear mid-session

Recent related commits:

- `bc99504` `Simplify homepage lanes and stabilize viewer advance`
- `24a3dc2` `Tighten viewer navigation event guard`
- `79f8815` `Document viewer navigation guard`

These helped narrow the issue, but they did **not** solve it.

## Fix Applied

The root causes were identified and fixed:

### Root Cause 1: Fetch effect re-ran on every navigation

The fetch effect depended on `initialSession?.index`. Every navigation triggered `handleMediaVisible` → `onSessionUpdate` → parent `sessions` state change → new `initialSession` prop → `initialSession?.index` changed → fetch effect re-ran → **cleared the viewer queue and history on every single navigation action**.

Fix: captured `initialSession?.index` in a ref at mount time (`initialSessionIndexRef`) and removed it from the fetch effect dependency array.

### Root Cause 2: Sync effect overwrote the key ref

A `useEffect` synced `currentItemKeyRef.current = activeItem?.key` on every `activeItem` change. This created a circular dependency: `moveBy` set the key ref → queue instability caused key lookup to fail → `activeItem` fell back to `filteredItems[safeIndex]` (wrong item) → sync effect overwrote the key ref with the wrong key.

Fix: removed the sync effect entirely. `currentItemKeyRef` is now only written by `moveBy` (on navigation), queue initialization (on first load), `openGridItem`, and the fetch effect (route changes).

### Root Cause 3: No stable browsing list

Navigation used `filteredItems` directly, which mutated during browsing as items were marked seen and freshness-filtered. Index N could point to a different item after each navigation.

Fix: added `viewerQueueRef` (stable, append-only snapshot of items) and `viewerHistoryRef` (explicit stack of visited item keys). Forward navigation walks the queue; back navigation pops from the history stack.

### Changes in `src/App.tsx`

- Added `viewerQueueRef`, `viewerHistoryRef`, `initialSessionIndexRef` refs
- Queue population runs during render: snapshots `filteredItems` on first load, append-only after that
- `activeItem` derived by key lookup in queue first, then `filteredItems`, with `filteredItems[safeIndex]` as final fallback
- `moveBy` uses queue for forward navigation, history stack for back navigation
- Removed `initialSession?.index` from fetch effect deps
- Removed sync effect that overwrote `currentItemKeyRef`

## Suggested Success Criteria

- one `Right Arrow` press advances exactly one item ✅
- one `Left Arrow` press goes back exactly one previously visited item ✅
- going forward 5 times and back 5 times retraces the same sequence in reverse ✅
- on-screen arrows and keyboard arrows behave the same
- video end auto-advance moves one item only
