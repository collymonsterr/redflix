# Homepage Curation Editor

RedFlix now includes a lightweight local editor for changing homepage sections without touching the code.

## Where to Find It

- Open `/` for the SFW home or `/nsfw` for the NSFW home.
- Click `Edit home` in the homepage header.

## What You Can Edit

Each mode has its own set of editable content.

### SFW Home

- homepage sections
- landscape video showcase row
- portrait video showcase row

### NSFW Home

- homepage sections
- landscape video showcase row
- portrait video showcase row
- text-only subreddit directory near the bottom

## How the Editor Works

### Section Rows

For each section you can:

- change the section title
- add or remove subreddit names
- reorder sections with `Up` and `Down`
- remove entire sections
- add a brand-new section

Subreddits can be entered as:

- comma-separated values
- one subreddit per line

Duplicates are removed automatically when saved.

### Showcase Rows

For each showcase card you can edit:

- card title
- subreddit
- subtitle

You can also:

- move cards up or down
- remove cards
- add a new card

## Save Behavior

- `Save changes` writes the homepage configuration into localStorage.
- `Cancel` closes the editor without saving new changes.
- `Reset to defaults` restores the shipped built-in homepage layout.

## Storage Notes

The editor is local-only and currently stores its state under:

```text
redditp-next:homepage-curation
```

That means:

- changes stay on the current device and browser
- different browsers can have different curated homes
- deploying a new version does not overwrite a saved custom home unless the user resets it

## Practical Tips

- Keep section names short so the homepage stays clean.
- Use showcase rows for subs that are reliably video-heavy.
- Use regular section rows for broader browsing buckets.
- If a subreddit preview looks stale after major curation changes, a refresh is usually enough.
