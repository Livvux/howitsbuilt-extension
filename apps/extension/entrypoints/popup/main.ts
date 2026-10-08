import '@/assets/tokens.css';
import './style.css';
import { resultKey, type TabResult } from '@/lib/analyze';
import { renderPopup } from './render';

const root = document.getElementById('app')!;

async function init(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return renderPopup(root, null);
  const key = resultKey(tab.id);
  const read = async () => ((await browser.storage.session.get(key))[key] as TabResult | undefined) ?? null;

  renderPopup(root, await read());
  browser.storage.session.onChanged.addListener((changes) => {
    if (key in changes) read().then((state) => renderPopup(root, state)).catch(console.error);
  });
}

init().catch((err) => {
  console.error(err);
  renderPopup(root, null);
});
