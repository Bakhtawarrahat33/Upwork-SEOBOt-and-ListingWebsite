# AI Workflow Setup

## Tool Used
OpenCode — an agentic AI coding assistant for the command line.

## Model Connected
big-pickle (opencode/big-pickle)

## How It Was Configured
The agent was launched inside the project root directory (`D:\One-Week-work-with-CEO`) via OpenCode's CLI. It began by exploring the full project structure, identifying entry points, reading key configuration files, and then documenting its integration.

## Project Structure Summary
```
D:\One-Week-work-with-CEO\
├── .editorconfig
├── .git/
├── .gitignore
├── .npmrc
├── build-dev.js
├── electron-builder.yml
├── LICENSE
├── main.js                          # Electron entry point (bootstraps compiled main)
├── package-lock copy.json
├── package.json
├── postcss.config.cjs
├── preload.js                       # Minified preload (built output)
├── tailwind.config.js
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── ai_test.txt                      # Proof-of-life file (created by this agent)
├── ai_setup.md                      # This file
├── prompts/
│   ├── upwork-automation-readme.txt
│   ├── upwork-saas-filter.txt
│   ├── upwork-scraper-readme.txt
│   ├── va-multiple-repo.txt
│   └── va-single-repo.txt
├── scripts/
│   ├── build-main.mjs
│   └── ... (other dev/utility scripts)
├── src/
│   ├── config/
│   ├── main/
│   │   ├── main.js                  # Actual Electron main process
│   │   ├── preload.js               # ES module preload (source)
│   │   └── menu.js                  # Application menu
│   ├── renderer/
│   │   ├── index.html               # HTML shell for renderer
│   │   ├── main.jsx                 # React entry point
│   │   ├── App.jsx                  # Root React component
│   │   ├── styles.css               # Global styles / Tailwind
│   │   ├── components/              # Shared UI components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── CampaignList.jsx
│   │   │   ├── CreateCampaignModal.jsx
│   │   │   ├── CampaignResultsModal.jsx
│   │   │   ├── LogViewer.jsx
│   │   │   └── ...
│   │   └── pages/                   # Route-level page components
│   │       ├── Dashboard.jsx
│   │       ├── Settings.jsx
│   │       ├── AccountsGroup.jsx
│   │       ├── GithubAccounts.jsx
│   │       ├── StarsCampaign.jsx
│   │       ├── IndexerChecker.jsx
│   │       ├── RepoViews.jsx
│   │       ├── GitHubRepoGenerator.jsx
│   │       ├── ViewsCampaign.jsx
│   │       ├── ProxiesPage.jsx
│   │       └── Logs.jsx
│   ├── services/                    # Business logic & automation services
│   │   ├── campaignManager.js
│   │   ├── indexerCampaignManager.js
│   │   ├── upworkCampaignManager.js
│   │   ├── chatgptScraper.js
│   │   ├── githubService.js
│   │   ├── storage.js
│   │   ├── initializeGPTAccounts.js
│   │   ├── Codegenerator.js
│   │   ├── Codeparser.js
│   │   ├── Githubfilepusher.js
│   │   └── ...
│   └── utils/
│       ├── parser.js
│       ├── portFinder.js
│       └── jsonRepairUtil.js
```

## Entry Points Identified
- **JavaScript (Electron main process)**: `src/main/main.js` — Creates the BrowserWindow, registers all IPC handlers, initializes campaign managers (GitHub stars, indexer checker, Upwork), and manages the application lifecycle.
- **JavaScript (Renderer/UI)**: `src/renderer/main.jsx` — Mounts the React application inside `#root` using React Router's HashRouter, defining page-level routes (Dashboard, StarsCampaign, Settings, etc.).
- **JavaScript (Entry shim)**: `main.js` (root) — Minimal shim that requires `./dist/main/main.js` to boot the compiled app.
- **HTML (Renderer shell)**: `src/renderer/index.html` — Minimal HTML5 document with a single `<div id="root">` and a `<script>` tag loading `main.jsx`.

## Proof of File Access
The following files were successfully read and verified:
- `package.json` — Contains project name (`ai-automation-dashboard`), version, scripts, and Electron build config.
- `main.js` — 1-line shim requiring the compiled main process.
- `src/main/main.js` — Full Electron main process (373 lines) with window creation, IPC handling, and campaign management.
- `src/renderer/main.jsx` — React entry with HashRouter and route definitions.
- `src/renderer/index.html` — HTML template for the renderer.
- `src/main/preload.js` — ES module preload script exposing `window.api` via contextBridge.
- `preload.js` — Minified build output of the preload script.
- `electron-builder.yml`, `tailwind.config.js`, `vite.renderer.config.ts`, `vite.preload.config.ts` — Build/configuration files.
- No Python files or `requirements.txt` were found (this project is JavaScript-only).

## Proof of File Modification
A file named `ai_test.txt` was created in the project root with the following content:

```
AI agent successfully connected to this project on Wed Jun 10 2026
```

This confirms the AI agent has read-write access to the project filesystem.

## Screenshot
![Agent Running Inside Project](./screenshots/opencode_running.png)
