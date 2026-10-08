import '@/assets/tokens.css';
import './style.css';
import { fetchMe, fetchProScan, getToken } from '@/lib/account';
import { resultKey, type TabResult } from '@/lib/analyze';
import { renderDetails, renderPopup, type AccountView } from './render';

const root = document.getElementById('app')!;

async function init(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return renderPopup(root, null);
  const key = resultKey(tab.id);
  const read = async () => ((await browser.storage.session.get(key))[key] as TabResult | undefined) ?? null;

  const token = await getToken();
  let account: AccountView = token ? undefined : { kind: 'signed-out' };
  let state = await read();

  const onDetails = async (domain: string) => {
    const region = root.querySelector<HTMLElement>('[data-region=main]');
    if (!region || !token) return;
    renderDetails(region, 'loading');
    renderDetails(region, await fetchProScan(token, domain));
  };
  const draw = () => renderPopup(root, state, account, onDetails);

  browser.storage.session.onChanged.addListener((changes) => {
    if (key in changes) read().then((s) => ((state = s), draw())).catch(console.error);
  });
  draw();

  if (token) {
    const me = await fetchMe(token);
    account = me ? { kind: 'account', email: me.email, pro: me.plan.tier === 'pro' } : (await getToken()) ? undefined : { kind: 'signed-out' };
    draw();
  }
}

init().catch((err) => {
  console.error(err);
  renderPopup(root, null);
});
