import type { Detection } from '@howitsbuilt/engine';
import { collectSignals, type CollectedSignals } from './collect';
import { getEngine } from './engine';

export type TabResult =
  | { status: 'ok'; url: string; detections: Detection[]; scannedAt: number }
  | { status: 'unsupported'; url: string };

/** Response headers of the last main-frame document loaded in a tab, tagged with its URL. */
export type StoredHeaders = { url: string; headers: Record<string, string>; documentId?: string };

// Both live in chrome.storage.session so they survive service-worker restarts.
export const resultKey = (tabId: number) => `result:${tabId}`;
export const headersKey = (tabId: number) => `headers:${tabId}`;

const withoutHash = (url: string): string => url.split('#')[0]!;

/** `url` is undefined when Chrome hides it (chrome://, other extensions) — those can't be inspected. */
export async function analyzeTab(tabId: number, url: string | undefined): Promise<TabResult> {
  if (url === undefined) return { status: 'unsupported', url: '' };
  const protocol = URL.canParse(url) ? new URL(url).protocol : '';
  if (protocol !== 'http:' && protocol !== 'https:') return { status: 'unsupported', url };

  const engine = getEngine();
  let collected: CollectedSignals | undefined;
  let documentId: string | undefined;
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: collectSignals,
      args: [engine.probes],
    });
    collected = injection?.result as CollectedSignals | undefined;
    documentId = (injection as { documentId?: string } | undefined)?.documentId;
  } catch {
    // Chrome blocks injection on the Web Store, PDF viewer, error pages, etc.
    return { status: 'unsupported', url };
  }

  const headers = await headersFor(tabId, url, documentId);

  return {
    status: 'ok',
    url,
    detections: engine.match({ ...collected, url, ...(headers ? { headers } : {}) }),
    scannedAt: Date.now(),
  };
}

/**
 * Headers belong to one document. They apply when the URL is the one they were captured for
 * (binding them to that document), or when it is still the same document (SPA pushState).
 * bfcache restores, downloads and 204s leave the tab on a document whose headers we never saw.
 */
async function headersFor(tabId: number, url: string, documentId: string | undefined): Promise<Record<string, string> | undefined> {
  const key = headersKey(tabId);
  const stored = (await browser.storage.session.get(key))[key] as StoredHeaders | undefined;
  if (!stored) return undefined;
  if (withoutHash(stored.url) === withoutHash(url)) {
    if (documentId && stored.documentId !== documentId) await browser.storage.session.set({ [key]: { ...stored, documentId } });
    return stored.headers;
  }
  return documentId && stored.documentId === documentId ? stored.headers : undefined;
}
