import type { Detection } from '@howitsbuilt/engine';
import { collectSignals, type CollectedSignals } from './collect';
import { getEngine } from './engine';

export type TabResult =
  | { status: 'ok'; url: string; detections: Detection[]; scannedAt: number }
  | { status: 'unsupported'; url: string };

// Both live in chrome.storage.session so they survive service-worker restarts.
export const resultKey = (tabId: number) => `result:${tabId}`;
export const headersKey = (tabId: number) => `headers:${tabId}`;

/** `url` is undefined when Chrome hides it (chrome://, other extensions) — those can't be inspected. */
export async function analyzeTab(tabId: number, url: string | undefined): Promise<TabResult> {
  if (url === undefined) return { status: 'unsupported', url: '' };
  const protocol = URL.canParse(url) ? new URL(url).protocol : '';
  if (protocol !== 'http:' && protocol !== 'https:') return { status: 'unsupported', url };

  const engine = getEngine();
  let collected: CollectedSignals | undefined;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: collectSignals,
      args: [engine.probes],
    });
    collected = injection?.result as CollectedSignals | undefined;
  } catch {
    // Chrome blocks injection on the Web Store, PDF viewer, error pages, etc.
    return { status: 'unsupported', url };
  }

  const stored = await browser.storage.session.get(headersKey(tabId));
  const headers = stored[headersKey(tabId)] as Record<string, string> | undefined;

  return {
    status: 'ok',
    url,
    detections: engine.match({ ...collected, url, ...(headers ? { headers } : {}) }),
    scannedAt: Date.now(),
  };
}
