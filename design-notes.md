# SplitStream Extension Design Log

## System concept

This project provides a Chromium extension that reflows the current page into vertical text streams using CSS multi-column layout.  
The target behavior is:

- The page stays on one synchronized stream.
- The stream is sliced into 2 or 3 vertical columns visible side by side.
- The whole page scrolls with one scroll bar, while columns advance like connected sections of a river.

## Requirements (current)

- Split count selectable per page (2 or 3 only).
- No explicit width input; split count is based on window width usage request.
- The visual margin should be minimal:
  - Left and right screen edge padding around content: about 30 px.
  - Column separator width: 3~5 px, subtle and not too dominant.
- Keep synchronized scroll behavior as a single stream.
- Keep extension architecture lightweight and browser-integrated (not a full custom browser).

## Implemented details (as of 2026-06-24)

### 1) Multi-column flow
- `content.js` injects a `splitstream-root` marker class and a style block (`splitstream-column-style`) on each page.
- Multi-column styles now apply to both `html` and `body` with the same marker class, including:
  - `column-count` set to 2 or 3
  - `column-gap: 4px`
  - `column-rule: 4px solid rgba(148, 163, 184, 0.35)`
  - side padding on body: `30px` left/right
  - overflow settings (`html`: `overflow-x: hidden`, `overflow-y: auto`)
- The `background.js` generates the same column style and sends it to the content script on page updates and when settings change.
- Side effects are currently reset by removing the marker classes and clearing the injected style content.

### 2) Settings and tab behavior
- `background.js` stores split count in `chrome.storage.local` by tab ID.
- Pop-up sends `set-columns` / `get-columns` messages.
- Saved per-tab setting is re-applied on page completion (`chrome.tabs.onUpdated`).

## Notes and current risks

- Some websites control layout heavily with wrappers, fixed widths, or `overflow` rules; these pages may still feel less uniform.
- If a page uses `position: fixed` overlays, sticky UI, or custom scroll traps, the global scroll feeling can differ from ideal.
- `column-count` can conflict with complex scripts that constantly rewrite DOM; page reload or content mutation may require re-application.

## Next iteration ideas

- Add a third split mode (e.g. 4) as optional if user feedback supports it.
- Add explicit page-level disable and global toggle.
- Add diagnostics for when a page cannot be safely reflowed.
- Optional per-site memory: remember user preference per host.
## Session update (2026-06-24) - note.com verification
- URL: https://note.com/samuraijuku_biz/n/na1d0a22e3cc3
- What was validated:
  - `splitstream-target` now attaches reliably after page init (initial delay tolerated ~2-3s on this page).
  - `column` styles are applied on `main.p-article` and descendants are forced wide/visible to avoid fixed-width clipping (`width: 100% !important`, `overflow: visible !important`).
  - Content now becomes multi-column and right-side flow is present in coordinate checks (`p.getClientRects()` length > 1, left positions continue beyond first pane).
  - Scroll is synchronized to the page (no per-pane scrolling); however this note page still behaves as a horizontally distributed column flow with limited vertical travel.
  - Current behavior does not yet produce a strict 2x2 snake where "top of right pane follows bottom of left pane" in all cases; this still needs a layout model change if strict snake continuity is required.
- Open issues to resolve next:
  - Decide whether to keep CSS multi-column behavior (highlighter-friendly, fast) or switch to a custom snake layout for strict top-to-bottom, pane-to-pane continuity.
