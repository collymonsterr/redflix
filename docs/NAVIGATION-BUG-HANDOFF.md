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

## Best Next Direction

Recommendation: stop layering more small guards onto `activeIndex`.

The more likely durable fix is one of these:

1. track the active viewer item by stable key, not by numeric index alone
2. derive the current index from `activeItemKey` against the current filtered list
3. maintain a dedicated viewer queue/session list that stays stable while browsing
4. maintain an explicit history stack for back navigation, so “back” means previously visited keys rather than `currentIndex - 1`
5. scope media events with a stronger navigation/session token so old media instances cannot mutate the current viewer state

## Suggested Success Criteria

- one `Right Arrow` press advances exactly one item
- one `Left Arrow` press goes back exactly one previously visited item
- going forward 5 times and back 5 times retraces the same sequence in reverse
- on-screen arrows and keyboard arrows behave the same
- video end auto-advance moves one item only

## Important Constraint

Please keep the fix focused.

Do not combine this with:

- route redesign
- homepage redesign
- viewer visual redesign
- unrelated refactors

The priority is deterministic next/back behavior first.
