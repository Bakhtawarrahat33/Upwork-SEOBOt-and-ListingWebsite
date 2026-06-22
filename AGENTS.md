# Project Agent Guide

> Read this file completely before inspecting, editing, running, or describing this project.
> It is the project source of truth for AI-assisted work. If a request conflicts with this file,
> ask the user before acting. Do not invent project behavior when the code, database, or logs can verify it.

## 1. Operating rules

1. Start by restating the requested outcome and identifying the smallest relevant area of the project.
2. Inspect the relevant code before proposing a fix. Use `rg` for search.
3. State the files you expect to change before writing changes.
4. Make only task-scoped changes. Do not refactor, reformat, delete, or "clean up" unrelated code.
5. Never expose or commit credentials, cookies, session tokens, `.env` values, or database passwords.
6. Verify a change with the smallest relevant command. Report what was actually verified and any limitation.
7. If a fact is not visible in code, database results, or logs, describe it as an assumption rather than a fact.

## 2. Repository map

| Area | Location | Purpose |
| --- | --- | --- |
| Electron main process | `src/main/` | App startup, IPC, local bridge API, scheduled sync |
| Electron UI | `src/renderer/` | React dashboard, campaigns, settings, account UI |
| Automation services | `src/services/` | Campaign processing, storage, ChatGPT flow, Upwork integration |
| Database/sync scripts | `scripts/` | `sync-to-listing-db.mjs` and database setup scripts |
| Next.js listing website | `website-next/` | Public/dashboard website backed by `listing_site` |
| Discord/Upwork bot | `upwork-discord-bot 3/upwork-discord-bot/` | Python Upwork search and Discord publishing |
| Deliverables | `deliverables/` | Coursework evidence and documentation |

## 3. Runtime and database architecture

### Module 1: Electron automation

- Main database: PostgreSQL `upwork_jobs` (default local configuration).
- Electron manages campaigns and ChatGPT accounts.
- The local bridge starts in `src/main/main.js` and accepts jobs from the Discord bot.
- Key source tables include: `upwork_campaigns`, `jobs_selected`, `product`, `blog`, `services`, `logs`, and `gpt_accounts`.

### Module 2: Next.js listing website

- Website directory: `website-next/`.
- Website database: PostgreSQL `listing_site`.
- Website DB code: `website-next/src/lib/db.ts`.
- Key destination tables include: `upwork_campaigns`, `jobs`, `products`, `blogs`, `services`, `sync_audit_log`, and `sync_watermarks`.

### Data flow

```text
Upwork search / Discord bot
  -> Electron local bridge
  -> GPT viability check
  -> product + blog + service generation
  -> upwork_jobs
  -> immediate listing DB mirror and scheduled backup sync
  -> listing_site
  -> Next.js website
```

Do not claim that a data item reached the website without checking the relevant storage, mirror, or sync path.

## 4. Sync scheduler

- The Electron scheduler is in `src/main/main.js`.
- It uses `node-cron` with `SYNC_CRON_EXPRESSION = '*/15 * * * *'`.
- It performs one sync at Electron startup, then scheduled runs at minute `00`, `15`, `30`, and `45` while Electron remains open.
- The sync implementation is `scripts/sync-to-listing-db.mjs`.
- The sync writes audit rows to `listing_site.sync_audit_log` and maintains per-table watermarks in `listing_site.sync_watermarks`.
- `scripts/setup-15min-cron.ps1` configures a separate Windows Scheduled Task. Do not enable it together with the Electron scheduler unless the user explicitly wants both; otherwise syncs may duplicate.

Useful audit query:

```sql
SELECT run_at, table_name, rows_synced, duration_ms, error
FROM sync_audit_log
ORDER BY id DESC
LIMIT 30;
```

`sync_audit_log.run_at` records table-sync completion/audit time, not necessarily the exact scheduler trigger time. The website's latest-sync display can also change after an immediate record mirror.

## 5. Content generation rules

- Only a matching, deliberately running campaign may consume a bridge job.
- Jobs are duplicate-checked before AI processing.
- GPT first evaluates viability.
- A viable job must generate all three required records: Product, Blog, and Service.
- If any of the three is missing or invalid, partial generated records are rolled back and the content set fails.
- Do not change this all-or-nothing behavior without explicit user approval.

## 6. Working safely

### Before an edit

Provide a concise plan containing:

```text
Task:
Relevant files:
Files intentionally not touched:
Verification:
```

### After an edit

- Remove imports or functions made unused by your own change.
- Run the relevant build when feasible:
  - Electron: `npm.cmd run build` from the repository root.
  - Next website: `npm.cmd run build` from `website-next/`.
- Do not run destructive database commands or alter external scheduled-task state unless explicitly requested.
- Preserve existing user changes in a dirty worktree.

## 7. Website rules

- Keep the Next.js website UI consistent with existing styles and responsive layouts.
- Dashboard data is server-fetched; a website refresh reads current `listing_site` data but does not trigger Electron sync.
- The dashboard auto-refreshes while open; this is display refresh only, not evidence that Electron is running.
- Use database/audit evidence when describing sync health.

## 8. No-hallucination checklist

Before replying with a technical conclusion, check:

- Is this behavior confirmed in the current code?
- Is this runtime state confirmed by logs, process output, or a database query?
- Are timestamps interpreted in the correct timezone?
- Am I distinguishing an immediate mirror from the scheduled backup sync?
- Am I distinguishing website display refresh from a background data sync?

If any answer is no, say what is unknown and provide the exact verification step instead of guessing.

## 9. Documentation and deliverables

- Agent setup evidence belongs in `deliverables/ai_setup.md`.
- Use genuine screenshots only. Never create a fake screenshot of an IDE, terminal, agent, or test result.
- Keep deliverable names requested by the user exactly as specified.
