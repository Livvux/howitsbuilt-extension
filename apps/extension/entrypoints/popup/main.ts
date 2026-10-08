import '@/assets/tokens.css';
import './style.css';
import { fetchMe, fetchProScan, getToken } from '@/lib/account';
import { analyzeTab, type TabResult } from '@/lib/analyze';
import { renderDetails, renderPopup, type AccountView } from './render';

const root = document.getElementById('app')!;
// Catch frameworks that hydrate shortly after load, while the user keeps the popup open.
const SECOND_PASS_MS = 3000;

const detectionCount = (result: TabResult) => (result.status === 'ok' ? result.detections.length : 0);
const setBadge = (tabId: number, result: TabResult) =>
  browser.action.setBadgeText({ tabId, text: detectionCount(result) ? String(detectionCount(result)) : '' });

async function init(): Promise<void> {
  let state: TabResult | null = null;
  let account: AccountView;
  let token: string | null = null;

  const onDetails = async (domain: string) => {
    const region = root.querySelector<HTMLElement>('[data-region=main]');
    if (!region || !token) return;
    renderDetails(region, 'loading');
    renderDetails(region, await fetchProScan(token, domain));
  };
  const draw = () => renderPopup(root, state, account, onDetails);
  draw(); // Display an immediate scanning state instead of waiting for account/API calls.

  // Opening the toolbar popup is the user gesture that grants activeTab access.
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

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
    }
  })().catch(console.error);

  if (tab?.id === undefined) {
    state = { status: 'unsupported', url: '' };
    draw();
    return;
  }

  const tabId = tab.id;
  const first = await analyzeTab(tabId, tab.url);
  state = first;
  draw();
  await setBadge(tabId, first).catch(console.error);
  if (first.status !== 'ok') return;

  // No background scanning: the second pass runs only if the user keeps
  // the popup open, and only while the originally invoked page is still active.
  await new Promise((resolve) => setTimeout(resolve, SECOND_PASS_MS));
  const [current] = await browser.tabs.query({ active: true, currentWindow: true });
  if (current?.id !== tabId || current.url !== tab.url) return;
  const second = await analyzeTab(tabId, tab.url);
  if (detectionCount(second) > detectionCount(first)) {
    state = second;
    draw();
    await setBadge(tabId, second).catch(console.error);
  }
}

init().catch((err) => {
  console.error(err);
  renderPopup(root, { status: 'unsupported', url: '' });
});
