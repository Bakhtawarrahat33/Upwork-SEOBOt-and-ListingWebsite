# PROJECT BAKHT — Complete Agentic Flow

> **Codename:** BAKHT | **Version:** 1.0 | **Type:** Autonomous Campaign Intelligence Pipeline

---

## MASTER AGENT PROMPT

```
You are BAKHT, an autonomous campaign intelligence agent.

Your mission is a four-stage pipeline that runs without human intervention:

STAGE 1 — SCRAPE
Connect to the live Upwork job feed via this URL:
https://www.upwork.com/nx/search/jobs/?q=(apify%20OR%20automation%20OR%20make.com%20OR%20n8n%20OR%20cold%20OR%20calling)&sort=recency

For each job posting, extract:
- job_id
- title
- description (full)
- budget (fixed/hourly + amount)
- client_history (hire rate, total spent, rating)
- posted_at (timestamp)
- skills_required (array)
- job_url

Push each extracted job as a structured JSON object to the Discord bot channel #job-feed in real time.

STAGE 2 — VIABILITY ASSESSMENT
For each job JSON received, run it through the Viability Prompt (below).
Use GPT-4 via the OpenAI API with credentials from environment variable OPENAI_API_KEY.
Return a viability_score (0–100) and a binary decision: PROCEED or SKIP.
If PROCEED → trigger Stage 3. If SKIP → log to #skipped-jobs and halt.

VIABILITY PROMPT (inject job JSON as context):
"""
You are a ruthless freelance business analyst. Given this Upwork job:

{{JOB_JSON}}

Score this job 0–100 on:
- Budget adequacy (>$500 fixed or >$25/hr = strong)
- Scope clarity (can it be productized?)
- Client quality (hire rate >60%, total spent >$1k)
- Skill alignment with: automation, scraping, n8n, make.com, cold calling, Apify
- Repeatability (can this become a product/service?)

Return ONLY valid JSON:
{
  "viability_score": <int>,
  "decision": "PROCEED" | "SKIP",
  "reason": "<one sentence>",
  "suggested_product_angle": "<what product/service this maps to>"
}
"""

STAGE 3 — CONTENT GENERATION
If decision is PROCEED, generate three assets simultaneously:

A. PRODUCT LISTING
Generate a complete product listing for a digital/automation product that solves this job's pain point.
Include: product_name, tagline, description (200 words), features (5 bullets), pricing_tier, use_case.

B. BLOG POST
Generate an SEO-optimized blog post (600–800 words) that:
- Targets the keyword implied by the job
- Educates the market on the problem this job represents
- Subtly positions YOUR service as the solution
- Ends with a CTA linking to the product listing

C. SERVICE PACKAGE
Generate a packaged service offer that maps directly to the job type:
- service_name
- deliverables (3–5 items)
- turnaround_time
- price_point
- guarantee_clause

STAGE 4 — UPLOAD & PUBLISH
Upload all three generated assets to the configured listing website via API.
Endpoints are loaded from environment variables:
- LISTING_API_KEY
- LISTING_BASE_URL
- LISTING_PRODUCT_ENDPOINT
- LISTING_BLOG_ENDPOINT
- LISTING_SERVICE_ENDPOINT

Confirm successful upload by posting a summary card to Discord channel #published-listings with:
- job title that triggered the flow
- viability_score
- links to all three published assets
- timestamp

On any API failure: retry 3x with exponential backoff, then post error to #agent-errors.

LOOP: After each cycle completes, wait 15 minutes and re-scrape for new jobs.
Deduplicate using job_id — never process the same job twice.
```

---

## AGENTIC FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                     ELECTRON APP (Campaign Manager)         │
│  - Configure search queries                                 │
│  - Set viability thresholds                                 │
│  - Monitor pipeline status                                  │
│  - View published listings dashboard                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ Triggers / Config
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    STAGE 1: SCRAPER AGENT                   │
│                                                             │
│  Source: Upwork Search Feed (recency-sorted)                │
│  URL: /nx/search/jobs/?q=(apify OR automation OR           │
│        make.com OR n8n OR cold OR calling)&sort=recency    │
│                                                             │
│  Method: Playwright / Apify Actor / Puppeteer               │
│  Cadence: Every 15 minutes                                  │
│  Dedup: job_id hash registry (Redis or SQLite)              │
│                                                             │
│  Output → Discord Bot → #job-feed (raw job JSON)            │
└──────────────────────────┬──────────────────────────────────┘
                           │ New job JSON
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 2: VIABILITY AGENT (GPT-4)            │
│                                                             │
│  Input: job JSON from #job-feed                             │
│  Model: gpt-4o (via OPENAI_API_KEY)                         │
│  Prompt: Viability Prompt (injected with job context)       │
│                                                             │
│  Scoring dimensions:                                        │
│  ├── Budget adequacy                                        │
│  ├── Scope clarity                                          │
│  ├── Client quality signals                                 │
│  ├── Skill alignment                                        │
│  └── Productization potential                               │
│                                                             │
│  Decision:                                                  │
│  ├── SKIP → log to #skipped-jobs → END                      │
│  └── PROCEED → pass to Stage 3 with product_angle          │
└──────────────────────────┬──────────────────────────────────┘
                           │ PROCEED + product_angle
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               STAGE 3: CONTENT GENERATION AGENT             │
│                                                             │
│  Runs 3 parallel generation tasks:                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   PRODUCT    │  │  BLOG POST   │  │ SERVICE PACKAGE  │  │
│  │  LISTING     │  │  (SEO, 700w) │  │  (deliverables,  │  │
│  │  (features,  │  │  (keyword-   │  │   price, SLA)    │  │
│  │   pricing)   │  │   targeted)  │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┴──────────────────┘             │
│                           │ 3 content assets                │
└──────────────────────────┬──────────────────────────────────┘
                           │ Content bundle
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 4: PUBLISHER AGENT                    │
│                                                             │
│  Listing Website API (credentials from .env):               │
│  ├── POST /products    → product listing                    │
│  ├── POST /blog        → blog post                          │
│  └── POST /services    → service package                    │
│                                                             │
│  On success: Discord #published-listings summary card       │
│  On failure: 3x retry → Discord #agent-errors alert         │
│                                                             │
│  Confirmation card includes:                                │
│  ├── Source job title + viability_score                     │
│  ├── Links to all 3 published assets                        │
│  └── ISO timestamp                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  WAIT 15min  │
                    │  RE-SCRAPE   │
                    │  (dedup loop)│
                    └──────────────┘
```

---

## ENVIRONMENT VARIABLES REQUIRED

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Discord Bot
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_CHANNEL_JOB_FEED=...
DISCORD_CHANNEL_PUBLISHED=...
DISCORD_CHANNEL_SKIPPED=...
DISCORD_CHANNEL_ERRORS=...

# Listing Website
LISTING_API_KEY=...
LISTING_BASE_URL=https://yourlistingsite.com/api/v1
LISTING_PRODUCT_ENDPOINT=/products
LISTING_BLOG_ENDPOINT=/blog
LISTING_SERVICE_ENDPOINT=/services

# Scraper
SCRAPE_INTERVAL_MINUTES=15
VIABILITY_THRESHOLD=60
UPWORK_SEARCH_URL=https://www.upwork.com/nx/search/jobs/?q=(apify%20OR%20automation%20OR%20make.com%20OR%20n8n%20OR%20cold%20OR%20calling)&sort=recency
```

---

## TECH STACK RECOMMENDATION

| Component | Tool |
|---|---|
| Electron App (Campaign Manager UI) | Electron + React + Tailwind |
| Scraper | Playwright or Apify Actor |
| Deduplication Store | SQLite (local) or Redis |
| Discord Bot | discord.js v14 |
| Viability LLM | GPT-4o via OpenAI SDK |
| Content Generation LLM | GPT-4o (same key) |
| Job Queue / Orchestration | Bull (Redis-backed) or n8n workflow |
| Listing Upload | Axios + retry logic (p-retry) |
| Secrets Management | .env + electron-store (encrypted) |

---

## DISCORD BOT CHANNEL STRUCTURE

```
SERVER: BAKHT Intelligence
├── #job-feed          ← raw scraped jobs (auto-posted by scraper)
├── #viable-jobs       ← jobs that passed viability (score ≥ threshold)
├── #skipped-jobs      ← jobs that failed viability (archived)
├── #published-listings← confirmation cards after successful publish
└── #agent-errors      ← retry failures and exceptions
```

---

## DATA SCHEMA

### Job Object (Scraped)
```json
{
  "job_id": "~01abc123def456",
  "title": "Build Apify scraper for LinkedIn leads",
  "description": "...",
  "budget": { "type": "fixed", "amount": 750 },
  "client": { "hire_rate": 0.72, "total_spent": 4200, "rating": 4.8 },
  "posted_at": "2026-06-10T08:30:00Z",
  "skills": ["Apify", "Node.js", "Web Scraping"],
  "job_url": "https://www.upwork.com/jobs/..."
}
```

### Viability Response
```json
{
  "viability_score": 82,
  "decision": "PROCEED",
  "reason": "High budget, clear scope, strong client history, direct skill match.",
  "suggested_product_angle": "Done-for-you LinkedIn lead scraper with Apify + CRM export"
}
```

### Published Bundle
```json
{
  "product": { "id": "prod_x1y2", "url": "https://..." },
  "blog": { "id": "post_a3b4", "url": "https://..." },
  "service": { "id": "svc_c5d6", "url": "https://..." },
  "source_job_id": "~01abc123def456",
  "viability_score": 82,
  "published_at": "2026-06-10T08:45:12Z"
}
```

---

## ELECTRON APP — CAMPAIGN MANAGER SCREENS

1. **Dashboard** — Live pipeline status, jobs scraped today, published count, skipped count
2. **Search Config** — Edit Upwork search query, set viability threshold, adjust scrape interval
3. **Credentials Vault** — Securely store/update all API keys (encrypted via electron-store)
4. **Job Feed** — Live table of scraped jobs with viability scores and status badges
5. **Published Listings** — Gallery of all published products/blogs/services with links
6. **Logs** — Full pipeline log with timestamps, filterable by stage

---

## FAILURE HANDLING MATRIX

| Failure | Behavior |
|---|---|
| Scraper blocked by Upwork | Rotate user-agent/proxy, alert #agent-errors |
| GPT-4 API timeout | Retry 3x, then SKIP job, log reason |
| Listing API 4xx | Log error, do NOT retry — likely data issue |
| Listing API 5xx | Retry 3x with backoff, then alert #agent-errors |
| Discord bot offline | Buffer messages, flush on reconnect |
| Duplicate job_id detected | Silent skip, increment dedup counter in dashboard |

---

*Project BAKHT — Autonomous campaign intelligence. Scrape. Score. Ship.*