# AGENTS.md — Upwork SEO Bot & Listing Website
> OpenCode reads this file automatically at session start.
> Every agent session must verify this file before touching a single line of code.

---

## 0. VERIFY BEFORE YOU START
Before doing anything — read this entire file.
Then confirm out loud:
- What module am I working in? (Module 1 or Module 2)
- What is the single task I was asked to do?
- What files am I allowed to touch?
- What files am I NOT allowed to touch?

If you cannot answer all four, stop and ask.

---

## 1. THINK BEFORE CODING

**Do not assume. Do not hide confusion. Surface tradeoffs.**

Before writing a single line:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, list them — do not pick silently.
- If a simpler approach exists, say so and propose it.
- If something is unclear, stop. Name what is confusing. Ask.
- If you are about to create a new file, confirm it does not already exist first.

Never start implementing until you have stated:
1. What you are building
2. Which files you will modify or create
3. What the success condition looks like

---

## 2. PROJECT STRUCTURE — READ FIRST, TOUCH SECOND

This project has TWO separate modules. They are independent. Do not cross the boundary.

### Module 1 — Upwork SEO Bot
- Language: JavaScript (Electron app) + Python (backend processing)
- What it does: Electron desktop app manages campaigns. Discord bot scrapes Upwork jobs. Python backend runs ChatGPT viability check. If viable, generates product/blog/service content.
- Database: PostgreSQL (migrated from MongoDB — never write MongoDB syntax)

### Module 2 — Listing Website
- Language: To be determined by existing codebase
- What it does: Separate website that displays jobs, products, blogs, services publicly
- Database: Its OWN separate PostgreSQL database — NOT the same DB as Module 1
- Syncs FROM Module 1 DB via cron job every 15 minutes

### SCOPE RULE — NON-NEGOTIABLE
You are ONLY allowed to work on:
- The live Upwork query module (Module 1)
- The listing website (Module 2)

Do NOT touch, read, modify, or explore any other part of the codebase.
If you notice something outside scope that could be improved — mention it in a comment, do not change it.

---

## 3. EXACT TABLE NAMES — USE THESE EXACTLY, NO VARIATIONS

### Module 1 — PostgreSQL Tables
| Table Name | Purpose |
|---|---|
| `jobs_selected` | Jobs where viability = 'Yes' |
| `product` | Auto-generated product pages |
| `blog` | Auto-generated blog posts |
| `services` | Auto-generated service pages |

### Module 2 — Listing Website PostgreSQL Tables
| Table Name | Purpose |
| `sync_audit_log` | Cron run log — fields: run_at, table_name, rows_synced, error |

### sync_audit_log Schema — Exact
```sql
CREATE TABLE sync_audit_log (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  table_name VARCHAR(50) NOT NULL,
  rows_synced INTEGER NOT NULL DEFAULT 0,
  error TEXT DEFAULT NULL
);
```

Wrong table names = broken pipeline. Use the exact names above. No pluralising, no renaming, no creativity.

---

## 4. EXACT FILE NAMES FOR DELIVERABLES — DO NOT RENAME

| File | Purpose |
|---|---|
| `ai_setup.md` | Documents the AI tool setup — Task 1 |
| `diagnosis.md` | ChatGPT DOM scraping bug diagnosis — Task 6 |
| `failure_log.txt` | PostgreSQL column drop error log — Task 5 |
| `AGENTS.md` | This file |

If the task says `diagnosis.md`, the file is called `diagnosis.md`. Not `diagnosis_report.md`. Not `bug_report.md`. Exactly `diagnosis.md`.

---

## 5. SIMPLICITY FIRST

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was explicitly asked.
- No abstractions for single-use code.
- No "flexibility" you invented — only what the task requires.
- No error handling for impossible or out-of-scope scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?"
If yes — simplify before showing output.

---

## 6. SURGICAL CHANGES — TOUCH ONLY WHAT YOU MUST

When editing existing code:
- Do NOT improve adjacent code, comments, or formatting.
- Do NOT refactor things that are not broken.
- Match existing style exactly, even if you would do it differently.
- If you notice unrelated dead code — mention it, do not delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Do NOT remove pre-existing dead code unless explicitly asked.

**Test:** Every changed line must trace directly to the task you were given.
If a changed line cannot be traced to the task — revert it.

---

## 7. CODING STANDARDS

### Python (SEO Board backend)
- Use `async` where the existing code uses it — match the pattern
- All database calls use the existing DB connection pattern in the codebase
- Never write raw MongoDB syntax — database is PostgreSQL
- Every function that touches the DB must have a `try/except` block
- Log format: `[MODULE_NAME] YYYY-MM-DD HH:MM:SS message`
- Never swallow exceptions with an empty `except: pass`

### JavaScript (Electron app)
- `async/await` only — no raw `.then()` chains
- All DB calls inside `try/catch`
- IPC bridge uses `contextBridge.exposeInMainWorld` — never expose `ipcRenderer` directly
- Log format: `[MODULE_NAME] message`

### SQL
- Always use parameterised queries — never string-concatenated SQL
- All migrations must be reversible (include a rollback)
- Column names are snake_case

---

## 8. KNOWN BUG — DO NOT FIX WITHOUT DIAGNOSIS FIRST

**ChatGPT DOM scraping is broken.**

Before writing any fix:
1. Switch to **Plan mode** (read-only)
2. Find the exact failing selector in the code
3. Open Puppeteer in headful mode and screenshot the actual DOM
4. Write `diagnosis.md` with: screenshot, failing selector + why it fails, 3-sentence root cause
5. Only then switch to **Build mode** and write the fix
6. The fix must include a comment block: `# FIX: selector <name> — see diagnosis.md`

A fix without `diagnosis.md` will be rejected by the CEO. Do not skip this.

---

## 9. CRON JOB RULES — MODULE 2

The cron job syncs Module 1 DB → Module 2 DB every 15 minutes.

**Mandatory behaviour:**
- Store a `last_synced_at` watermark per table — never re-copy already-synced rows
- Every run inserts one row into `sync_audit_log` with run_at, table_name, rows_synced, error
- If the sync fails, catch the error message and write it to the `error` column — do not let it silently fail
- On recovery, the next successful run writes `error = NULL`

**What will be tested by the CEO:**
- Kill the Module 1 DB mid-sync → verify the audit log row contains the error message
- Show 5+ audit log rows including at least one failure and one clean recovery
- Prove the watermark prevents duplicate rows on re-run

A cron job without a watermark and audit trail will not be accepted.

---

## 10. POSTGRESQL MIGRATION RULES

- Never write MongoDB syntax anywhere in the migrated code
- All four tables must exist before the pipeline runs: `jobs_selected`, `product`, `blog`, `services`
- After migration, the CEO will intentionally drop a column from `jobs_selected` while the pipeline runs
- You must be able to identify the exact file name and line number where the error is thrown (not caught)
- Capture this in `failure_log.txt` with timestamp and line number
- Fix the schema and provide before/after screenshots in TablePlus, pgAdmin, or psql

---

## 11. GOAL-DRIVEN EXECUTION

For every task, state a plan before starting:

```
Task: [what I was asked to do]
Files I will touch: [list]
Files I will NOT touch: [list]
Steps:
1. [step] → verify: [how I confirm it worked]
2. [step] → verify: [how I confirm it worked]
3. [step] → verify: [how I confirm it worked]
Success condition: [exactly what done looks like]
```

Do not start step 2 until step 1 is verified.
Do not mark a task done until the success condition is met.

---

## 12. WHAT THE CEO WILL CHECK IN THE FINAL MEETING

You will be asked live — without warning — to:
- Run the full pipeline from cold start in under 60 seconds
- Modify one part of the code on the spot (change cron interval, add a column, adjust a prompt)
- Show every AI prompt you used — raw, unedited, including failed attempts
- Identify the exact line number where an error was thrown (not caught)
- Walk through the listing website page by page and prove a new entry flows through within one cron cycle

**If you cannot do any of these — you are not done.**

---

## 13. THINGS THAT WILL GET YOU FAILED IMMEDIATELY

- Deleting or editing AI prompt history
- Submitting a fix for the ChatGPT scraping bug without `diagnosis.md`
- Submitting the PostgreSQL migration without `failure_log.txt` and screenshots
- Table names that do not exactly match: `jobs_selected`, `product`, `blog`, `services`, `sync_audit_log`
- Touching code outside the two assigned modules
- A cron job without a watermark and audit trail
- A Loom video for Task 2 that has cuts, pre-built code, or no correction loop

---

## 14. AGENT MODE GUIDE

| Mode | When to Use |
|---|---|
| **Plan (read-only)** | Exploring the codebase, writing diagnosis.md, reviewing before changing |
| **Build (full access)** | Writing new files, fixing bugs, implementing features |

**Rule:** Always start a new task in Plan mode. Read the relevant files first.
Only switch to Build mode when you know exactly what you are changing and why.

---

*This file is law. When in doubt — re-read this file before proceeding.*