import type { Detection } from '@howitsbuilt/engine';
import { collectSignals, type CollectedSignals } from './collect';
import { getEngine } from './engine';

export type TabResult =
  | { status: 'ok'; url: string; detections: Detection[]; scannedAt: number }
  | { status: 'unsupported'; url: string };

/**
 * Inspect the active tab only after the user opens the extension popup.
 * activeTab grants temporary scripting access without permanent site permissions.
 * Response headers are intentionally not collected: webRequest would require
 * observing navigation before the user explicitly invokes the extension.
 */
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
    // Chrome blocks injection on internal pages, the Web Store, PDF viewers,
    // or when activeTab access was not granted (e.g. a popup opened directly by URL).
    return { status: 'unsupported', url };
  }

  return {
    status: 'ok',
    url,
    detections: engine.match({ ...collected, url }),
    scannedAt: Date.now(),
  };
}
