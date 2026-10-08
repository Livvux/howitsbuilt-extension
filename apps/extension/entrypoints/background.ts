import { acceptToken, setToken } from '@/lib/account';

const BADGE_BG = '#3ECF8E';
const BADGE_TEXT = '#0A0A0B';

const quiet = (err: unknown) => {
  if (!/No tab with id/.test(String(err))) console.error(err);
};

export default defineBackground(() => {
  browser.action.setBadgeBackgroundColor({ color: BADGE_BG }).catch(quiet);
  browser.action.setBadgeTextColor?.({ color: BADGE_TEXT }).catch(quiet);

  // A scan now requires opening the popup (activeTab). Never scan silently on navigation.
  // Clear any badge from a previous scan when the tab navigates.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading') browser.action.setBadgeText({ tabId, text: '' }).catch(quiet);
  });

  // Content script restricted to howitsbuilt.fyi for optional account sign-in.
  browser.runtime.onMessage.addListener((message, sender) => {
    const token = acceptToken(message, sender, browser.runtime.id);
    if (!token) return undefined;
    return setToken(token).then(() => ({ ok: true }));
  });
});
