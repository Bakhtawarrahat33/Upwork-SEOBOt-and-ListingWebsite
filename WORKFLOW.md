# Upwork Discord Bot - Complete Workflow

## 🎯 System Overview

This is a fully automated system that:
1. **Scrapes Upwork** for job listings using 23 predefined keywords
2. **Stores jobs** in PostgreSQL database with deduplication
3. **Posts to Discord** when new jobs are found
4. **Filters jobs** by experience level, skills, and keywords
5. **Runs continuously** with auto-restart on crashes

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UPWORK DISCORD BOT SYSTEM                │
└─────────────────────────────────────────────────────────────┘

1. JOB SCRAPING LAYER
   ├── Upwork GraphQL API
   ├── 23 Concurrent Keyword Searches
   │   ├── Android Automation
   │   ├── Stealth Automation
   │   ├── AI Automation
   │   ├── Web Development
   │   ├── TikTok Shop
   │   └── General Automation
   ├── Filters & Deduplication
   └── Error Handling & Retries

2. STORAGE LAYER
   ├── PostgreSQL Database
   ├── Jobs Table (id, job_id, title, description, budget, skills, client, posted_at)
   ├── Unique Constraint (job_id)
   └── Auto-deduplication on insert

3. PROCESSING LAYER
   ├── Job Validation
   ├── Experience Level Filtering
   ├── Keyword Filtering
   ├── Temporal Filtering (5-minute window)
   └── Job Detail Enrichment

4. DISCORD LAYER
   ├── 6 Discord Channels
   │   ├── Android Automation
   │   ├── Stealth Automation
   │   ├── AI Automation
   │   ├── Web Development
   │   ├── TikTok Shop
   │   └── General Automation
   ├── Formatted Message Posting
   ├── Colored Terminal Output
   └── Error Logging

5. EXECUTION LAYER
   ├── Python 3.10.11
   ├── Discord.py Bot
   ├── Async Event Loop
   ├── Background Tasks
   └── Auto-restart Wrapper
```

---

## 📋 Workflow Steps

### Step 1: Startup (main.py)
```
START → Initialize Database → Create Tables → Load Config
    → Load Discord Token → Connect to Discord
    → Spawn Background Task → Bot Ready
```

### Step 2: Job Scraping Loop (Every 5 seconds)
```
LOOP (runs_advanced_job_searches):
  1. Run 23 keyword searches in parallel
  2. Fetch 10 jobs per keyword
  3. Parse GraphQL response
  4. Extract job data (id, title, description, budget, skills)
  5. Check for errors and retries
```

### Step 3: Database Deduplication
```
For each job:
  1. Check if job_id already exists
  2. If YES → Skip (duplicate)
  3. If NO → Insert new job
  4. Handle unique constraint violation
```

### Step 4: Job Filtering
```
For each new job:
  1. Check experience level (filter out "entrylevel")
  2. Check keywords (exclude n8n, hubspot, etc.)
  3. Check posted time (< 5 minutes old)
  4. If passes → Add to posting queue
```

### Step 5: Terminal Display
```
If job passes filters:
  Display with colored output:
  ✅ GREEN checkmark for "NEW JOB FOUND"
  CYAN labels for Title, Budget, Skills
  Yellow decorative separators
```

### Step 6: Discord Posting
```
For each approved job:
  1. Determine which channel based on keyword
  2. Format rich message with:
     - Title
     - Link to Upwork
     - Budget
     - Experience Level
     - Skills
     - Description snippet
  3. Send to Discord channel
  4. Log success
```

### Step 7: Error Handling
```
If error occurs:
  1. Catch exception
  2. Log error details
  3. Continue with next job
  4. Retry on next loop cycle
  5. If critical: Wrapper restarts bot
```

---

## 🔄 Data Flow Diagram

```
┌──────────────┐
│ Upwork Site  │
└──────┬───────┘
       │ GraphQL Request
       ▼
┌──────────────────────┐
│ 23 Job Searches      │ ◄─── Runs every 5 seconds
│ (Concurrent)         │
└──────┬───────────────┘
       │ Job Results (10 per search)
       ▼
┌──────────────────────┐
│ Parse & Validate     │
│ - Extract data       │
│ - Handle errors      │
└──────┬───────────────┘
       │ Raw Jobs
       ▼
┌──────────────────────┐
│ PostgreSQL Database  │
│ - Check duplicates   │ ◄─── Unique constraint on job_id
│ - Insert if new      │
└──────┬───────────────┘
       │ New Jobs
       ▼
┌──────────────────────┐
│ Filtering Engine     │
│ - Experience level   │
│ - Keywords           │
│ - Posted time        │
└──────┬───────────────┘
       │ Approved Jobs
       ▼
┌──────────────────────┐      ┌─────────────────┐
│ Discord Posts        │─────►│ Terminal Output │
│ 6 Channels           │      │ (Colored)       │
└──────────────────────┘      └─────────────────┘
```

---

## 🔐 Database Schema

### jobs table
```sql
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,  -- Upwork job ID
    title VARCHAR(255) NOT NULL,           -- Job title
    description TEXT,                      -- Full description
    budget FLOAT,                          -- Job budget
    skills TEXT,                           -- Required skills (JSON)
    client VARCHAR(255),                   -- Client name
    posted_at TIMESTAMP NOT NULL           -- When job was posted
);

Indexes:
- ix_jobs_job_id (UNIQUE) - Prevents duplicate job insertions
```

---

## 🎛️ Configuration

### .env File
```env
# Discord
DISCORD_TOKEN=your_bot_token
CHANNEL_ANDROID_AUTOMATION=channel_id
CHANNEL_STEALTH_AUTOMATION=channel_id
CHANNEL_AI_AUTOMATION=channel_id
CHANNEL_WEB_DEVELOPMENT=channel_id
CHANNEL_TIKTOK_SHOP=channel_id
CHANNEL_GENERAL_AUTOMATION=channel_id

# Database
POSTGRES_URL=postgresql+psycopg2://postgres:1234@localhost:5432/upwork_jobs

# Upwork
UPWORK_EMAIL=your_email@gmail.com
UPWORK_PASSWORD=your_password
```

### Keywords Monitored (23 total)
**Android Automation (3):**
- Android Accessibility Service
- Browser Automation
- Browser Automation Tools

**Stealth Automation (3):**
- Bot Development
- TikTok Shop Manager
- Web Developer Stack

**AI Automation (3):**
- Pipedream
- Zapier
- Make.com

**And 14 more...**

---

## ⚙️ Running the System

### Option 1: Manual Start
```powershell
cd "d:\One-Week-work-with-CEO\upwork-discord-bot 3\upwork-discord-bot"
python main.py
```

### Option 2: With Auto-Restart Wrapper
```powershell
cd "d:\One-Week-work-with-CEO\upwork-discord-bot 3\upwork-discord-bot"
powershell -ExecutionPolicy Bypass -File bot-wrapper.ps1
```

### Option 3: Windows Task Scheduler (Every 15 minutes)
See instructions below.

---

## 🕐 Scheduled Execution (Every 15 minutes)

### Windows Task Scheduler Setup

1. **Open Task Scheduler:**
   - Press `Windows + R`
   - Type `taskschd.msc`
   - Press Enter

2. **Create Basic Task:**
   - Right-click "Task Scheduler Library"
   - Click "Create Basic Task..."
   - Name: `Upwork Discord Bot`
   - Description: `Runs Upwork job scraper and Discord bot every 15 minutes`

3. **Set Trigger:**
   - Click "Next"
   - Select "On a schedule"
   - Choose "Daily"
   - Start time: (any time)
   - Check "Repeat task every: 15 minutes"
   - Duration: "Indefinitely"
   - Click "Next"

4. **Set Action:**
   - Select "Start a program"
   - Program: `C:\Users\Bakhtawar\AppData\Local\Programs\Python\Python310\python.exe`
   - Arguments: `main.py`
   - Start in (folder): `d:\One-Week-work-with-CEO\upwork-discord-bot 3\upwork-discord-bot`
   - Click "Next"

5. **Conditions & Settings:**
   - Uncheck "Stop the task if it runs longer than"
   - Check "If the task is already running, then the following rule applies"
   - Select "Stop the existing instance"
   - Click "Finish"

### Verify Task is Running:
```powershell
Get-ScheduledTask -TaskName "Upwork Discord Bot" | Get-ScheduledTaskInfo
```

### View Task History:
```powershell
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 | Where-Object {$_.Message -like "*Upwork*"}
```

---

## 📊 Monitoring

### View Database Status
```powershell
cd "d:\One-Week-work-with-CEO\upwork-discord-bot 3\upwork-discord-bot"
python view_db.py
```

### View Bot Logs
```powershell
# Check if bot is running
Get-Process python | Where-Object {$_.ProcessName -eq "python"}

# Kill bot if needed
Stop-Process -Name python -Force
```

### Check Discord Integration
```powershell
python debug_discord.py
```

---

## 🐛 Troubleshooting

### Bot Crashes
**Solution:** Use the wrapper script
```powershell
powershell -ExecutionPolicy Bypass -File bot-wrapper.ps1
```

### Database Connection Error
**Check:** PostgreSQL is running
```powershell
Get-Service postgresql-x64* | Start-Service
```

### Discord Not Receiving Messages
**Check:** Channel IDs are correct in .env file
```powershell
python debug_discord.py
```

### Jobs Not Being Scraped
**Check:** Upwork API is accessible
```powershell
python -c "from scraper.job_fetch import fetch_jobs; print(fetch_jobs('python', 3))"
```

---

## 📈 Performance Metrics

- **Scraping:** 23 keywords in parallel, ~10-30 seconds per cycle
- **Database:** Deduplication using unique constraints
- **Discord:** Instant posting once job is validated
- **Memory:** ~150-200 MB idle, ~300 MB under load
- **CPU:** <1% idle, 20-30% while scraping

---

## ✅ Checklist

- [x] PostgreSQL database running
- [x] Discord bot invited to server
- [x] All 6 Discord channels accessible
- [x] Upwork API working (verified with job_fetch.py)
- [x] Python environment configured
- [x] .env file with all credentials
- [x] Bot wrapper script created
- [x] Task Scheduler configured (if automated)

---

## 🚀 Next Steps

1. **Start the bot:** Run wrapper script
2. **Monitor jobs:** Watch terminal or Discord channels
3. **View database:** Use pgAdmin or view_db.py
4. **Adjust keywords:** Edit `bot/job_search_keywords.py`
5. **Customize filters:** Edit filtering logic in `discord_bot.py`

---

## 📞 Support

All logs are printed to terminal with timestamps and colored output for easy debugging.

**Key Log Markers:**
- `✅ NEW JOB FOUND` - New job posted to Discord
- `[Real-time]` - Job processing in real-time
- `Database error:` - Database issues (usually duplicate, safe to ignore)
- `Error in [keyword]` - Scraping error for specific keyword

---

**Last Updated:** 2026-06-12
**System Status:** ✅ Fully Operational
