# @-Mention File Attachments — Implementation Plan

**Status:** Planning
**Branch:** feat/at-mention
**Parent idea:** ~/garden/idea/openclaw-obsidian-at-mention-files.md

---

## Overview

Add inline `@`-mention file attachment to the ObsidianClaw chat input. Typing `@` opens a fuzzy-search dropdown of vault files. Selecting one adds it as context to the message, displayed as a chip in the preview strip. Multiple files per message supported.

---

## Current State

The plugin has two attachment paths, both single-file only:

1. **Attach button** (paperclip icon in input row) → opens OS file picker via `<input type="file">` → `handleFileSelect()` processes the file
2. **`AttachmentModal`** (line 1219) — `FuzzySuggestModal<TFile>` that searches vault files, but not wired to any button or command

Both set `pendingAttachment: { name, content, vaultPath? } | null` (single attachment) and show a preview strip with `attachPreviewEl`.

---

## Phase 1: Multiple Attachments

Refactor from single to array. No UX changes — just plumbing so multiple files can be queued.

### 1.1 Change data structure

- [ ] Replace `pendingAttachment: { ... } | null` with `pendingAttachments: { ... }[] = []`
- [ ] Update `handleFileSelect()` to push to array instead of replacing
- [ ] Update `sendMessage()` to concatenate all attachment contents (not just one)
- [ ] Update preview strip rendering to show all chips, each with `×` remove button
- [ ] Update remove handler to splice from array instead of nulling
- [ ] On send, clear the array instead of nulling

### 1.2 Test

- [ ] Attach two text files via the file chooser, verify both contents appear in the sent message
- [ ] Remove one chip, verify only the remaining file is sent
- [ ] Send with no attachments — verify it works as before
- [ ] Send with an image attachment — verify vault path handling still works

---

## Phase 2: Inline @-Suggest

The core feature. A custom dropdown positioned below the textarea that fuzzy-searches vault files on keystroke.

### 2.1 InlineSuggest class

Create a new class (in `main.ts` or a separate file imported) that:

- [ ] Renders a positioned `<div>` below the textarea with a scrollable list of vault files
- [ ] Uses Obsidian's `prepareQuery()` + `fuzzySearch()` for ranking and highlighting
- [ ] Caches `app.vault.getFiles()` and refreshes on vault events (`create`, `rename`, `delete`)
- [ ] Ranks results: recently-modified first (via `file.stat.mtime`), then by fuzzy score
- [ ] Shows file path (not just basename) for disambiguation — `folder/note.md` not just `note.md`
- [ ] Limits display to ~50 results max for performance

### 2.2 Trigger logic

Hook into the textarea's `input` and `keydown` events:

- [ ] On `input`: detect `@` typed after whitespace or at start of line → open suggest
- [ ] Do NOT trigger `@` when it's mid-word (e.g. `email@domain`) — only after whitespace/start
- [ ] On further input after trigger: update the search query (everything after `@` until cursor)
- [ ] On `@@`: insert literal `@`, skip picker
- [ ] On Escape: close picker, remove the `@` + query text from textarea
- [ ] On Backspace: if query is empty, close picker and remove the `@`

### 2.3 Keyboard navigation

- [ ] ArrowDown / ArrowUp: move highlight in the dropdown
- [ ] Enter: select the highlighted file
- [ ] Escape: close picker without selecting

### 2.4 Selection behavior

When a file is selected:

- [ ] Remove the `@` + query text from the textarea
- [ ] Add the file to `pendingAttachments` array
- [ ] Add a chip to the preview strip (file name, `×` to remove)
- [ ] Close the dropdown
- [ ] Don't move cursor — leave it where the `@` was, so user can keep typing the message

### 2.5 File content handling

Reuse the existing logic from `handleFileSelect()`:

- [ ] Text files (`.md`, `.txt`, `.json`, etc.): read with `app.vault.read(file)`, wrap in `\n\nFile: filename.md\n\`\`\`\n{content}\n\`\`\``
- [ ] Image files: save to `openclaw-attachments/` via `app.vault.createBinary()`, reference absolute path
- [ ] Other binary: descriptive attachment line
- [ ] Truncate text files at 10K chars (same limit as current)

### 2.6 CSS

- [ ] Style the dropdown to match Obsidian's native suggest overlay (`.suggestion` classes)
- [ ] Position below textarea using caret coordinates (a lightweight caret-position helper or character-width estimation)
- [ ] Dark/light theme support (the plugin already follows Obsidian theme)
- [ ] Chips in the preview strip: horizontal scroll, subtle background, `×` close button

### 2.7 Test

- [ ] Type `@` — dropdown appears with vault files
- [ ] Type `@proj` — dropdown filters to files matching "proj"
- [ ] Arrow keys navigate, Enter selects
- [ ] Escape closes without attaching
- [ ] `@@` inserts literal `@`
- [ ] Select a `.md` file — content included in message
- [ ] Select an image — saved to vault, referenced
- [ ] Multiple `@` mentions in one message — all attached
- [ ] Remove a chip via `×` — removed from attachments
- [ ] Backspace at `@` with no query — closes picker and removes `@`

---

## Phase 3: Polish

- [ ] Debounce search input (150ms) for large vaults (10k+ files)
- [ ] Animate dropdown open/close (subtle, <200ms)
- [ ] Show file type icon in dropdown (📝 for md, 🖼 for image, etc.)
- [ ] Mobile: handle virtual keyboard, touch selection
- [ ] Edge case: vault with 10k+ files — benchmark filter performance
- [ ] Edge case: file with no extension
- [ ] Edge case: `@` at end of message after punctuation
- [ ] Consider: wire up the unused `AttachmentModal` as a "browse files" button alternative (low priority)

---

## Implementation Notes

### Where to add code

- `InlineSuggest` class: add directly in `main.ts` (keeping with the single-file convention) or as `suggest.ts` imported at the top — single-file is the current convention
- All changes to `OpenClawChatView`: inline in the existing class methods
- CSS: add to `styles.css`

### Key Obsidian APIs

- `app.vault.getFiles()` — returns `TFile[]` for all files in vault
- `app.vault.read(file: TFile)` — read file content (text)
- `app.vault.readBinary(file: TFile)` — read binary content
- `app.vault.createBinary(path, data)` — create binary file
- `prepareQuery(query: string)` — from `obsidian` module, creates a query object for fuzzy search
- `fuzzySearch(query, text)` — from `obsidian` module, returns `FuzzySearchResult | null`
- `app.vault.on('create' | 'modify' | 'rename' | 'delete', callback)` — vault file events

### Caret position

Textarea doesn't expose caret pixel coordinates natively. Options:

1. **Canvas measurement trick** — create an offscreen canvas, measure text width up to `selectionStart`, add to textarea's left padding. Works but fiddly with line wrapping.
2. **Mirror div** — create a hidden div with matching font metrics, measure position. More accurate but heavier.
3. **Fixed position below textarea** — skip per-caret positioning, always show dropdown anchored to the bottom-left of the input area. Simpler, less brittle, and what most chat UIs actually do (Slack, Discord, etc.).

**Recommendation:** Start with option 3. If it feels wrong, upgrade to option 1 later.

### Existing AttachmentModal

The `AttachmentModal` at line 1219 is defined but not wired up. It could become a "browse all files" button or stay unused. Don't remove it — it's not hurting anything and could be useful later.