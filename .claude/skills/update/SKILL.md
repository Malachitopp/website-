---
name: update
description: Refreshes context/PROJECT.md with the current state of this project — stack decisions, schema philosophy, integration plans, file structure, and working-style notes — so the next session picks up with full context. Use when the user says "/update", "update the context", or wants this session's progress saved for next time.
---

Update `context/PROJECT.md` at the project root so it accurately reflects the
current state of the project, based on this conversation and the actual files on
disk. This file is how a future session (with no memory of this one) gets caught
up fast — treat it as a living project brief, not a changelog.

## What to do

1. Read the existing `context/PROJECT.md` in full.
2. Read the actual project structure and key files (`package.json` in each
   package, `tsconfig.json`(s), `docker-compose.yaml`, `.env` — names of vars only,
   never values/secrets, migration files, backend route files) to ground the
   update in what's really there, not just what was discussed.
3. Rewrite the sections that have changed: stack decisions, schema philosophy,
   integration plans (e.g. Spotify), local dev setup, deployment plan, current
   file structure snapshot. Keep sections that are still accurate as-is rather than
   rewriting for the sake of it.
4. Fold in anything new from this conversation: decisions made, things ruled out
   and why, new files/tables/routes added, open TODOs, corrections to earlier
   assumptions.
5. Keep the "Working style notes for this project" section maintained too — e.g.
   if the user has shown a new preference (asked to be scaffolded more/less, a
   tool or pattern they like or dislike), fold it in there. Don't overwrite
   accurate existing notes just to shorten the file.
6. Update the "Last updated" date at the top to today's date.
7. Never write actual secret values (passwords, tokens, API keys) into this file
   — reference that they exist and where (e.g. ".env holds DATABASE_URL"), not
   their contents.

## Output

Just do the update — rewrite the file via Edit/Write. Afterward, give the user a
short (2-4 bullet) summary of what changed in the context file, not a restatement
of the whole file.
