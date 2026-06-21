# Cookie Refresh Fixes for upworkCampaignManager.js

All changes in `D:\One-Week-work-with-CEO\src\services\upworkCampaignManager.js`

---

## Fix C: Cookie expiry validation in `getGPTCookies` (~line 2243)

**Find:**
```javascript
      // Normalize: handle both ARRAY and OBJECT formats
      const normalized = cookies ? this.normalizeCookies(cookies) : [];
      if (normalized.length === 0) {
        this.log(campaignId, 'info', `No stored cookies for ${account.name} — auto-login will be used.`);
        return [];
      }

      this.log(campaignId, 'info', `🍪 Loaded ${normalized.length} cookies for account: ${account.name}`);
      return normalized;
```

**Replace with:**
```javascript
      // Normalize: handle both ARRAY and OBJECT formats
      const normalized = cookies ? this.normalizeCookies(cookies) : [];
      if (normalized.length === 0) {
        this.log(campaignId, 'info', `No stored cookies for ${account.name} — auto-login will be used.`);
        return [];
      }

      // C: Check if the session token cookie is expired
      const sessionCookie = normalized.find(c => c.name === '__Secure-next-auth.session-token');
      if (sessionCookie && sessionCookie.expires) {
        const expiresSec = Number(sessionCookie.expires);
        const nowSec = Date.now() / 1000;
        if (expiresSec < nowSec) {
          this.log(campaignId, 'warning', `Session token for ${account.name} expired ${Math.round((nowSec - expiresSec) / 60)}m ago — will refresh.`);
          throw new Error('GPT session token has expired');
        }
        const remainingMin = Math.round((expiresSec - nowSec) / 60);
        this.log(campaignId, 'info', `Session token expires in ~${remainingMin} minutes.`);
      }

      this.log(campaignId, 'info', `🍪 Loaded ${normalized.length} cookies for account: ${account.name}`);
      return normalized;
```

---

## Fix A: Proactive cookie refresh before campaign loop (~line 2320)

**Find:**
```javascript
    // Get GPT cookies
    let cookies;
    try {
      cookies = await this.getGPTCookies(campaign.gptAccountId, id);
    } catch (cookieError) {
      this.log(id, 'error', `❌ Cannot start campaign: ${cookieError.message}`);
      await this.setStatus(id, 'Failed');
      this.running.delete(id);
      return;
    }

    let processed = 0;
```

**Replace with:**
```javascript
    // Get GPT cookies
    let cookies;
    try {
      cookies = await this.getGPTCookies(campaign.gptAccountId, id);
    } catch (cookieError) {
      this.log(id, 'warning', `❌ Stored cookies expired — proactively refreshing...`);
      try {
        await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
        cookies = await this.getGPTCookies(campaign.gptAccountId, id);
      } catch (refreshError) {
        this.log(id, 'error', `❌ Cannot start campaign: cookie refresh failed — ${refreshError.message}`);
        await this.setStatus(id, 'Failed');
        this.running.delete(id);
        return;
      }
    }

    // A: Proactive cookie health check — even if getGPTCookies returned ok, verify freshness
    try {
      const nowSec = Date.now() / 1000;
      const sessionCookie = cookies.find(c => c.name === '__Secure-next-auth.session-token');
      const isStale = !sessionCookie ||
        !sessionCookie.value ||
        sessionCookie.value.length <= 20 ||
        (sessionCookie.expires && sessionCookie.expires < nowSec + 300); // expiring within 5 min
      if (isStale) {
        this.log(id, 'warning', 'GPT session token expiring soon — proactively refreshing...');
        await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
        cookies = await this.getGPTCookies(campaign.gptAccountId, id);
      }
    } catch (proactiveError) {
      // Non-fatal: the campaign will try auto-login when needed
      this.log(id, 'warning', `Proactive cookie refresh failed (will retry on demand): ${proactiveError.message}`);
    }

    let processed = 0;
```

---

## Fix B: Auth recovery in `processSingleJob` (~line 935 and ~line 983)

### B1: Filter error catch block (~line 935)

**Find:**
```javascript
    } catch (error) {
      this.log(id, 'error', `GPT viability check failed: ${error.message}`);
      if (sharedBrowser) {
        await sharedBrowser.close().catch(() => {});
        this.activeBrowsers.delete(id);
      }
      return { status: 'error', error: error.message, job_id: jobData.id, title };
    }
```

**Replace with:**
```javascript
    } catch (error) {
      this.log(id, 'error', `GPT viability check failed: ${error.message}`);
      // B: Auth recovery — try refreshing cookies on auth errors
      if (this.isChatGPTAuthError(error)) {
        try {
          this.log(id, 'warning', 'Auth error during filter — refreshing GPT session...');
          await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
          cookies = await this.getGPTCookies(campaign.gptAccountId, id);
        } catch (refreshError) {
          this.log(id, 'error', `Cookie refresh failed: ${refreshError.message}`);
        }
      }
      if (sharedBrowser) {
        await sharedBrowser.close().catch(() => {});
        this.activeBrowsers.delete(id);
      }
      return { status: 'error', error: error.message, job_id: jobData.id, title };
    }
```

### B2: Content gen error catch block (~line 983)

**Find:**
```javascript
    } catch (error) {
      this.log(id, 'error', `Content generation failed: ${error.message}`);
      if (sharedBrowser) {
        await sharedBrowser.close().catch(() => {});
        this.activeBrowsers.delete(id);
      }
      return { status: 'error', error: error.message, job_id: jobData.id, title };
    } finally {
```

**Replace with:**
```javascript
    } catch (error) {
      this.log(id, 'error', `Content generation failed: ${error.message}`);
      // B: Auth recovery — try refreshing cookies on auth errors
      if (this.isChatGPTAuthError(error)) {
        try {
          this.log(id, 'warning', 'Auth error during content gen — refreshing GPT session...');
          await this._refreshCookiesViaAutoLogin(id, campaign.gptAccountId);
          cookies = await this.getGPTCookies(campaign.gptAccountId, id);
        } catch (refreshError) {
          this.log(id, 'error', `Cookie refresh failed: ${refreshError.message}`);
        }
      }
      if (sharedBrowser) {
        await sharedBrowser.close().catch(() => {});
        this.activeBrowsers.delete(id);
      }
      return { status: 'error', error: error.message, job_id: jobData.id, title };
    } finally {
```

---

## Summary of what each fix does

| Fix | What | When it triggers |
|-----|------|-----------------|
| **A** | Verifies session token isn't expiring within 5 min before campaign loop starts | Campaign startup |
| **A catch** | If `getGPTCookies` throws "expired", proactively refreshes instead of failing | Campaign startup |
| **B1** | Catches auth errors in `processSingleJob` filter step, refreshes cookies, continues | Bridge job processing |
| **B2** | Catches auth errors in `processSingleJob` content gen step, refreshes cookies, continues | Bridge job processing |
| **C** | Checks `__Secure-next-auth.session-token.expires` in `getGPTCookies`, throws if expired | Every cookie load |
