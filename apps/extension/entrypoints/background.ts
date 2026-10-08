import { analyzeTab, headersKey, resultKey } from '@/lib/analyze';

const BADGE_BG = '#3ECF8E';
const BADGE_TEXT = '#0A0A0B';

export default defineBackground(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_BG }).catch(console.error);
  browser.action.setBadgeTextColor?.({ color: BADGE_TEXT }).catch(console.error);

  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.tabId < 0) return undefined;
      const headers: Record<string, string> = {};
      for (const h of details.responseHeaders ?? []) {
        const name = h.name.toLowerCase();
        const value = h.value ?? '';
        headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
      }
      browser.storage.session.set({ [headersKey(details.tabId)]: headers }).catch(console.error);
      return undefined;
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['responseHeaders'],
  );

  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.status === 'loading') {
      browser.storage.session.remove(resultKey(tabId)).catch(console.error);
      browser.action.setBadgeText({ tabId, text: '' }).catch(console.error);
      return;
    }
    if (info.status !== 'complete' || !tab.url) return;
    analyzeTab(tabId, tab.url)
      .then(async (result) => {
        await browser.storage.session.set({ [resultKey(tabId)]: result });
        const count = result.status === 'ok' ? result.detections.length : 0;
        await browser.action.setBadgeText({ tabId, text: count > 0 ? String(count) : '' });
      })
      .catch(console.error);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    browser.storage.session.remove([resultKey(tabId), headersKey(tabId)]).catch(console.error);
  });
});
