import '@/assets/tokens.css';
import './style.css';
import { fetchMe, fetchProScan, getToken, isPublicHost } from '@/lib/account';
import { analyzeTab, type TabResult } from '@/lib/analyze';
import { hostOf, renderPopup, type AccountView, type PopupState, type ProView } from './render';

const root = document.getElementById('app')!;
document.documentElement.lang = browser.i18n.getUILanguage();
// Catch frameworks that hydrate shortly after load, while the user keeps the popup open.
const SECOND_PASS_MS = 3000;

const detectionCount = (result: TabResult) => (result.status === 'ok' ? result.detections.length : 0);
const setBadge = (tabId: number, result: TabResult) =>
  browser.action.setBadgeText({ tabId, text: detectionCount(result) ? String(detectionCount(result)) : '' });

async function init(): Promise<void> {
  let state: PopupState = null;
  let account: AccountView;
  let token: string | null = null;
  let pro: ProView;
  let proStarted = false;
  let shown = 0;
  let scanning = false;
  let proHost = '';

  const draw = () => renderPopup(root, state, account, { pro, onRescan: () => void rescan() });
  draw(); // Display an immediate scanning state instead of waiting for account/API calls.

  // Opening the toolbar popup is the user gesture that grants activeTab access.
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  let tabUrl = tab?.url;

  // Pro accounts get the server scan merged into the list; it never blocks the local render.
  const loadPro = async () => {
    if (proStarted || !token || !(account?.kind === 'account' && account.pro)) return;
    if (!state || state === 'error' || state.status !== 'ok') return;
    const host = hostOf(state.url);
    if (!isPublicHost(host)) return; // never send private/local hosts to the server
    proStarted = true;
    proHost = host;
    pro = 'loading';
    draw();
    const scan = (await fetchProScan(token, host).catch(() => null)) ?? 'error';
    if (proHost !== host) return; // the page changed during the request: a newer scan owns this view
    pro = scan;
    draw();
  };

  const apply = async (result: TabResult) => {
    state = result;
    shown = detectionCount(result);
    draw();
    if (tabId !== undefined) await setBadge(tabId, result).catch(console.error);
    void loadPro();
  };

  async function rescan(): Promise<TabResult | undefined> {
    if (tabId === undefined || scanning) return;
    scanning = true;
    try {
      const [current] = await browser.tabs.query({ active: true, currentWindow: true });
      if (current?.id !== tabId) return;
      tabUrl = current.url;
      const result = await analyzeTab(tabId, tabUrl);
      if (result.status === 'ok' && hostOf(result.url) !== proHost) {
        proStarted = false;
        proHost = '';
        // navigated to another site: the old Pro result does not apply
        pro = undefined;
      }
      await apply(result);
      return result;
    } catch (err) {
      console.error(err);
      state = 'error';
      draw();
    } finally {
      scanning = false;
    }
  }

  // Load account data independently; it must not delay the local technology scan.
  void (async () => {
    token = await getToken();
    account = token ? undefined : { kind: 'signed-out' };
    draw();
    if (token) {
      const me = await fetchMe(token);
      account = me
        ? { kind: 'account', email: me.email, pro: me.plan.tier === 'pro' }
        : (await getToken()) ? undefined : { kind: 'signed-out' };
      draw();
      void loadPro();
    }
  })().catch(console.error);

  if (tabId === undefined) {
    state = { status: 'unsupported', url: '' };
    draw();
    return;
  }

  const first = await rescan();
  if (first?.status !== 'ok') return;

  // No background scanning: the second pass runs only if the user keeps
  // the popup open, and only while the originally invoked page is still active.
  await new Promise((resolve) => setTimeout(resolve, SECOND_PASS_MS));
  const [current] = await browser.tabs.query({ active: true, currentWindow: true });
  if (current?.id !== tabId || current.url !== tabUrl) return;
  try {
    const second = await analyzeTab(tabId, tabUrl);
    if (detectionCount(second) > shown) await apply(second);
  } catch (err) {
    console.error(err); // keep the first result on screen
  }
}

init().catch((err) => {
  console.error(err);
  renderPopup(root, 'error', undefined, { onRescan: () => location.reload() });
});
