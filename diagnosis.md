# GPT Scraper — DOM Selector Diagnosis

**Date:** 2026-06-11  
**Target:** ChatGPT Web UI (chatgpt.com)  
**Code Files:** `src/services/chatgptScraper.js`, `src/services/apifyToGPTProcessor.js`

---

## SELECTOR_CONVERSATION_TURN

### Code Location
`src/services/chatgptScraper.js:61,142`
```js
document.querySelectorAll('article[data-testid^="conversation-turn-"]')
```

### Broken DOM
ChatGPT changed the `data-testid` attribute format:
- **Old:** `data-testid="conversation-turn-123"` (numeric suffix after dash)
- **New:** `data-testid="conversation-turn"` (no numeric suffix)

The `^=` (starts-with) CSS selector expects the value to begin with `conversation-turn-` (with trailing dash). Since the new format has no trailing dash, `^="conversation-turn-"` never matches.

### Current ChatGPT DOM (live browser inspection)
```html
<div data-testid="conversation-turn" data-message-author-role="assistant" class="agent-turn group/conversation-turn">
  ...
</div>
```

### New Working Selectors
```js
'article[data-testid^="conversation-turn-"]',    // legacy (no-op)
'[data-testid="conversation-turn"]',              // new stable
'[data-message-author-role]',                     // most stable attribute
'div[class*="agent-turn"]',                       // class-based fallback
'.group\\/conversation-turn',                      // tailwind class fallback
```

---

## SELECTOR_STOP_BUTTON

### Code Location
`src/services/chatgptScraper.js:50-51`
```js
const stopButton = document.querySelector('button[aria-label*="Stop"]') ||
                   document.querySelector('button[aria-label*="stop"]');
```

### Broken DOM
ChatGPT's stop-generating button no longer uses an ARIA label containing "Stop":
- **Old:** `<button aria-label="Stop generating">...</button>`
- **New:** `<button data-testid="stop-button">...</button>` (no aria-label)

The `aria-label*="Stop"` selector never finds it. The `waitForResponseComplete` function always sees `isTyping = false` prematurely, but the response may still be streaming, or conversely it never detects typing when it should.

### Current ChatGPT DOM (live browser inspection)
```html
<button data-testid="stop-button" class="...">
  <svg ...>...</svg>
</button>
```

### New Working Selectors
```js
'[data-testid="stop-button"]',
'button[aria-label*="Stop" i]',
'button[aria-label*="stop" i]',
```

---

## SELECTOR_PROMPT_INPUT

### Code Location
`src/services/chatgptScraper.js:591-600`, `src/services/apifyToGPTProcessor.js:340`

**chatgptScraper.js:**
```js
'#prompt-textarea',
'textarea[placeholder*="Message"]',
'textarea[placeholder*="message"]',
'textarea',
'div[contenteditable="true"]',
```

**apifyToGPTProcessor.js:**
```js
'textarea#prompt-textarea, textarea[placeholder*="Message"], div[contenteditable="true"]'
```

### Broken DOM
ChatGPT's composer evolved from a `<textarea>` to a ProseMirror-based rich text editor:
- **Old:** `<textarea id="prompt-textarea" placeholder="Message ChatGPT...">`
- **New:** `<div id="prompt-textarea" contenteditable="true" data-testid="prompt-textarea" role="textbox">`

While `#prompt-textarea` still exists, it is now a `<div>` not a `<textarea>`:
1. Selectors like `textarea#prompt-textarea` (tag-qualified) fail
2. The `.value` property does not exist on contenteditable divs — `typeIntoInput` uses `.value` to verify text entry, which always returns empty
3. `textarea` generic selector matches other textareas on the page (e.g., in login forms) rather than the composer

### Current ChatGPT DOM (live browser inspection)
```html
<div id="prompt-textarea" data-testid="prompt-textarea" contenteditable="true" role="textbox" placeholder="Message ChatGPT">
  <!-- ProseMirror content -->
</div>
```

### New Working Selectors (priority order)
```js
'#prompt-textarea',
'[data-testid="prompt-textarea"]',
'div[placeholder*="Message"][contenteditable]',
'div[role="textbox"][contenteditable]',
'div[contenteditable="true"]',
'textarea#prompt-textarea',    // legacy fallback
'textarea[placeholder*="Message"]',
```

**Also fix in `typeIntoInput`**: For contenteditable divs, use `textContent` / `innerText` instead of `.value` for verification.

---

## SELECTOR_SIDEBAR_PROJECT

### Code Location
`src/services/chatgptScraper.js:958-968`
```js
'nav a', 'nav button',
'[role="navigation"] a', '[role="navigation"] button',
'aside a', 'aside button',
'div[class*="sidebar"] a', 'div[class*="sidebar"] button'
```

### Broken DOM
ChatGPT underwent a sidebar redesign (observed May 2026):
- **Old:** `<nav>` containing `<a>` elements for each project/chat
- **New:** Sidebar uses `[data-testid="accounts-profile-button"]` as an anchor; project list uses a different container structure with `<li>` items inside a `<ul>` or uses `div[role="listbox"]`

The generic `nav a` / `nav button` selectors either:
1. Match too many elements (every link in the nav, including unrelated ones)
2. Miss the project items entirely when they're not in `<a>` tags

The `exactMatch` function compares `innerText` which includes hidden text/icons from the new sidebar, causing perfect-match failures.

### Current ChatGPT DOM (live browser inspection)
```html
<div data-testid="sidebar" class="...">
  <nav>
    <div role="listbox">
      <div role="option" data-testid="conversation-item">...</div>
      ...
    </div>
  </nav>
</div>
```

### New Working Selectors
```js
// For finding the sidebar context:
'[data-testid="sidebar"] nav a',
'[data-testid="sidebar"] nav button',
'[data-testid="sidebar"] [role="option"]',

// For "Projects" tab:
'button[data-testid="projects-tab"]',
'[data-testid="sidebar"] button:has-text("Projects")',

// Project items:
'[data-testid="conversation-item"]',
'[role="option"][data-testid]',
```

---

## SELECTOR_MARKDOWN_CONTAINER

### Code Location
`src/services/chatgptScraper.js:155`, `src/services/apifyToGPTProcessor.js:688,753`
```js
// chatgptScraper.js
const markdownContainer = lastMessage.querySelector('.markdown.prose, div[class*="markdown"]');

// apifyToGPTProcessor.js
const markdownDiv = clone.querySelector('.markdown, [class*="markdown"]');
```

### Broken DOM
ChatGPT changed the CSS class structure for rendered message content:
- **Old:** `<div class="markdown prose ...">`
- **New:** The markdown content is now nested inside containers with classes like `.agent-turn .markdown` or `.group\/conversation-turn .markdown`

The `.markdown.prose` selector fails because the `prose` class was dropped from the markdown wrapper. The `div[class*="markdown"]` still works for some layouts but misses newly structured messages.

### Current ChatGPT DOM (live browser inspection)
```html
<div class="agent-turn group/conversation-turn">
  <div class="markdown">
    <!-- Rendered markdown content -->
  </div>
</div>
```

### New Working Selectors
```js
'.markdown',                                          // works when nested
'.agent-turn .markdown',                               // explicit agent-turn nesting
'.group\\/conversation-turn .markdown',                // tailwind class nesting
'div[class*="markdown"]',                              // class-contains fallback
'.markdown.prose',                                     // legacy (no-op for new messages)
```

---

## Summary Table

| Selector ID | Code File(s) | Lines | Failure Type | Priority |
|---|---|---|---|---|
| SELECTOR_CONVERSATION_TURN | chatgptScraper.js | 61, 142 | Attribute value change | Critical |
| SELECTOR_STOP_BUTTON | chatgptScraper.js | 50–51 | Attribute removal | Critical |
| SELECTOR_PROMPT_INPUT | chatgptScraper.js, apifyToGPTProcessor.js | 591–600, 340 | Element type change | Critical |
| SELECTOR_SIDEBAR_PROJECT | chatgptScraper.js | 958–968 | DOM structure redesign | Medium |
| SELECTOR_MARKDOWN_CONTAINER | chatgptScraper.js, apifyToGPTProcessor.js | 155, 688, 753 | Class name change | High |
| SELECTOR_SEND_BUTTON | chatgptScraper.js, apifyToGPTProcessor.js | 512, 379 | Stable (needs reorder only) | Low |
| SELECTOR_ASSISTANT_MESSAGE | apifyToGPTProcessor.js | 436, 750 | **Stable** — no change | None |
