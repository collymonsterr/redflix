# Viewer Navigation Fix Notes

This file used to be the handoff for RedFlix's unstable viewer navigation bug. The bug is now fixed on `main`, and this document exists to explain the final approach so future agents do not accidentally reintroduce it.

## Bug Summary

The old viewer used a numeric `activeIndex` over `filteredItems`.

That broke down because `filteredItems` is not stable while browsing. It can change because of:

- seen/freshness updates
- pagination appending more results
- filter changes
- route/session restoration

The result was:

- one `Right Arrow` press could jump multiple items
- `Left Arrow` did not reliably retrace the path the user just took
- going forward 5 items and back 5 items could show a different sequence
- stale `ended` / media-error events could amplify the drift

## Final Fix

The viewer now has three layers of navigation state in [src/App.tsx](/Users/colly/Documents/New%20project/redditp-next/src/App.tsx):

1. `activeItemKey`
   The active viewer item is tracked by stable item key, not only by index.

2. `viewerQueue`
   The viewer keeps an append-only queue snapshot of the items available for the current browsing scope.

3. `viewerHistory`
   Back navigation uses an explicit history stack of previously visited item keys instead of just `currentIndex - 1`.

## Key Behavior

- Forward navigation walks `viewerQueue`.
- Back navigation pops from `viewerHistory`.
- `activeIndex` still exists, but it is now secondary and mainly used for grid/highlight/session compatibility.
- Viewer queue state is reset when the browsing scope materially changes, such as route/filter/freshness changes.
- Freshness/seen updates no longer change the meaning of “previous item” mid-session.

## Supporting Fixes

Two related bugs were also part of the original instability:

- the route fetch flow could effectively rebuild viewer state too aggressively
- stale media events from old video instances could still try to advance the current viewer item

Those were already partly guarded before this fix, and the stable queue/history model now gives those guards a deterministic item target.

## Regression Checklist

If you touch viewer navigation, verify all of these:

1. One `Right Arrow` press advances exactly one item.
2. One `Left Arrow` press goes back exactly one item.
3. Going forward 5 items and back 5 items retraces the same 5 items in reverse.
4. On-screen arrows and keyboard arrows behave the same.
5. Video auto-advance only moves one item.
6. Freshness/seen changes do not reshuffle the active session path while browsing.

## Important Constraint

Do not revert the viewer back to “index-only” navigation unless the whole browsing state model is redesigned.

If this area needs more work, preserve the core rule:

- active viewer identity must be stable by item key
- back navigation must be explicit history, not just previous filtered index
