# AI Automation Dashboard

An Electron + React desktop application for automated Upwork job discovery, AI-driven content generation, and a public Next.js listing website.

## Architecture

```
Upwork search / Discord bot
  -> Electron local bridge
  -> GPT viability check
  -> Product + Blog + Service generation
  -> PostgreSQL (upwork_jobs)
  -> Sync to listing DB
  -> Next.js public website
```

## Modules

| Module | Tech | Purpose |
|--------|------|---------|
| **Desktop App** | Electron + React + Tailwind | Campaign management, account UI, scheduled sync |
| **Automation Engine** | Node.js (Puppeteer, GPT SDK) | Job processing, ChatGPT automation, content generation |
| **Listing Website** | Next.js 16 + PostgreSQL | Public-facing dashboard for generated content |
| **Discord Bot** | Python | Upwork RSS search, job posting to Discord |
| **Sync Scheduler** | node-cron | Periodic data mirror from `upwork_jobs` to `listing_site` |

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Python 3.10+ (Discord bot only)
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/Bakhtawarrahat33/Upwork-SEOBOt-and-ListingWebsite.git
cd Upwork-SEOBOt-and-ListingWebsite

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database and API credentials
```

### Development

```bash
# Run the Electron app in dev mode (Vite dev server + Electron)
npm run dev

# Run the Next.js website separately
cd website-next
npm install
npm run dev
```

### Build

```bash
# Build the Electron app for distribution
npm run build
npm run package
```

## Database

The system uses two PostgreSQL databases:

- **`upwork_jobs`** — Main operational database (campaigns, jobs, generated content)
- **`listing_site`** — Public-facing website database (synced via `scripts/sync-to-listing-db.mjs`)

The sync runs every 15 minutes via the Electron scheduler, with audit logging in `sync_audit_log`.

## Project Structure

```
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React UI
│   └── services/      # Automation services
├── scripts/           # Build scripts, DB setup, sync
├── website-next/      # Next.js listing website
├── upwork-discord-bot/ # Python Discord/Upwork bot
├── prompts/           # GPT system prompts
└── deliverables/      # Coursework documentation
```

## License

MIT
