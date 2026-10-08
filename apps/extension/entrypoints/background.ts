import { acceptToken, setToken } from '@/lib/account';
import { analyzeTab, headersKey, resultKey, type StoredHeaders, type TabResult } from '@/lib/analyze';

const BADGE_BG = '#3ECF8E';
const BADGE_TEXT = '#0A0A0B';
// Frameworks that hydrate after "load" (Angular, React roots, late cookies) show up on a second look.
const SECOND_PASS_MS = 3000;

// A tab closed mid-analysis is not an error.
const quiet = (err: unknown) => {
  if (!/No tab with id/.test(String(err))) console.error(err);
};

const count = (r: TabResult) => (r.status === 'ok' ? r.detections.length : 0);

async function publish(tabId: number, result: TabResult) {
  await browser.storage.session.set({ [resultKey(tabId)]: result });
  await browser.action.setBadgeText({ tabId, text: count(result) > 0 ? String(count(result)) : '' });
}

async function analyzeTwice(tabId: number, url: string | undefined) {
  const first = await analyzeTab(tabId, url);
  await publish(tabId, first);
  if (first.status !== 'ok') return;
  await new Promise((r) => setTimeout(r, SECOND_PASS_MS));
  const tab = await browser.tabs.get(tabId);
  if (tab.url !== url) return; // navigated meanwhile; the new page has its own analysis
  const second = await analyzeTab(tabId, url);
  if (count(second) > count(first)) await publish(tabId, second);
}

export default defineBackground(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_BG }).catch(quiet);
  browser.action.setBadgeTextColor?.({ color: BADGE_TEXT }).catch(quiet);

  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      // Prerendered documents share the tab id but aren't the page the user sees.
      if (details.tabId < 0 || details.documentLifecycle === 'prerender') return undefined;
      const headers: Record<string, string> = {};
      for (const h of details.responseHeaders ?? []) {
        const name = h.name.toLowerCase();
        const value = h.value ?? '';
        headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
      }
      const stored: StoredHeaders = { url: details.url, headers };
      browser.storage.session.set({ [headersKey(details.tabId)]: stored }).catch(quiet);
      return undefined;
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['responseHeaders'],
  );

  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'loading') {
      browser.storage.session.remove(resultKey(tabId)).catch(quiet);
      browser.action.setBadgeText({ tabId, text: '' }).catch(quiet);
      return;
    }
    if (info.status !== 'complete') return;
    analyzeTwice(tabId, tab.url).catch(quiet);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    browser.storage.session.remove([resultKey(tabId), headersKey(tabId)]).catch(quiet);
  });

  // Token from the howitsbuilt.fyi bridge (see entrypoints/bridge.content.ts).
  browser.runtime.onMessage.addListener((message, sender) => {
    const token = acceptToken(message, sender, browser.runtime.id);
    if (!token) return undefined;
    return setToken(token).then(() => ({ ok: true }));
  });
});
