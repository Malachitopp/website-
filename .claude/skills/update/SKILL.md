---
name: update
description: Refreshes the project context files (context/PROJECT.md, plus context/studio.md and context/deployment.md when this session touched those areas) with the current state of this project — stack decisions, schema, integrations, remaining work, file structure, and working-style notes — so the next session picks up fast. Use when the user says "/update", "update the context", or wants this session's progress saved for next time.
---

Update the context files so a future session (with no memory of this one) gets caught up fast **for as few
tokens as possible**. They are a living project brief, not a changelog. The user is token-conscious and asked
for these notes to be trimmed (2026-09-16: 169 KB → ~50 KB across three files) — keep them that way.

## The files
- `context/PROJECT.md` — the brief every session may read: what the project is, stack, backend, schema, general
  gotchas, local dev, remaining work, file map, working style. **Keep it under ~30 KB.**
- `context/studio.md` — studio page overlays, scene contents, renderer commands/costs/cameras, renderer gotchas.
- `context/deployment.md` — Vercel, Neon, DNS, env vars on the host, live checks.
- `CLAUDE.md` (repo root) — only the always-loaded pointers (context files, graphify-first navigation). Keep it tiny.

## What to do
1. Read `context/PROJECT.md` in full. Read `studio.md` / `deployment.md` only if this session touched those areas.
2. Ground the update in what's really on disk: `git status`, `git log`, `package.json`s, the files that changed
   this session, `.env` **key names only** (never values — comment lines can hold secrets).
3. Fold in what's new from this conversation: decisions and why, things ruled out, new files/routes/tables,
   open TODOs, corrections to earlier notes, and new user preferences in "Working style notes".
4. Put each fact in the right file. Detail that only matters for one area goes in that area's file, with at
   most a one-line pointer in `PROJECT.md`.
5. **Prune while you're there** — replace rather than append:
   - state the current value, not the sequence of values it went through (keep a one-line "tried X, rejected
     because Y" only when it stops a future session re-proposing X);
   - drop finished TODOs, superseded measurements (keep only the latest render times etc.), long quotes of the
     user (keep a few words when the wording itself is the decision), and step-by-step logs of how something
     was verified (keep the result);
   - merge working-style notes that say the same thing.
6. Update the "Last updated" date at the top of `PROJECT.md` and the commit-state bullet in Remaining work.
7. Never write secret values (passwords, tokens, API keys, recovery codes) — name the variable and where it lives.

## Output
Just do the update via Edit/Write. Afterwards give the user a short (2-4 bullet) summary of what changed and the
new size of `PROJECT.md`, not a restatement of the files.
