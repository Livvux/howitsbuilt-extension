import { fakeBrowser } from 'wxt/testing/fake-browser';
import { analyzeTab, headersKey } from '../lib/analyze';

const injected = (result: unknown) => [{ frameId: 0, documentId: 'd', result }] as any;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

test('non-http(s) url → unsupported without calling executeScript', async () => {
  const spy = vi.spyOn(browser.scripting, 'executeScript');
  expect(await analyzeTab(1, 'chrome://extensions')).toEqual({ status: 'unsupported', url: 'chrome://extensions' });
  expect(spy).not.toHaveBeenCalled();
});

test('hidden url (chrome:// without "tabs" permission) → unsupported', async () => {
  expect(await analyzeTab(1, undefined)).toEqual({ status: 'unsupported', url: '' });
});

test('executeScript rejection → unsupported (web store, pdf)', async () => {
  vi.spyOn(browser.scripting, 'executeScript').mockRejectedValue(new Error('Cannot access contents of the page'));
  expect(await analyzeTab(1, 'https://chromewebstore.google.com/x')).toEqual({
    status: 'unsupported',
    url: 'https://chromewebstore.google.com/x',
  });
});

test('merges stored headers with collected signals', async () => {
  await browser.storage.session.set({ [headersKey(1)]: { url: 'https://x.test/', headers: { 'x-powered-by': 'Next.js 15' } } });
  const spy = vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue(injected({}));
  const r = await analyzeTab(1, 'https://x.test/');
  expect(r.status).toBe('ok');
  expect(r.status === 'ok' && r.detections.map((d) => d.tech)).toContain('Next.js');
  expect(spy.mock.calls[0]![0]).toMatchObject({ target: { tabId: 1 }, world: 'MAIN' });
});

test('headers captured for another document (bfcache, download, prerender) are ignored', async () => {
  await browser.storage.session.set({ [headersKey(1)]: { url: 'https://other.test/', headers: { 'x-powered-by': 'Next.js 15' } } });
  vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue(injected({}));
  const r = await analyzeTab(1, 'https://x.test/');
  expect(r.status === 'ok' && r.detections.map((d) => d.tech)).not.toContain('Next.js');
});

test('fragment-only difference still uses the headers', async () => {
  await browser.storage.session.set({ [headersKey(1)]: { url: 'https://x.test/', headers: { 'x-powered-by': 'Next.js 15' } } });
  vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue(injected({}));
  const r = await analyzeTab(1, 'https://x.test/#pricing');
  expect(r.status === 'ok' && r.detections.map((d) => d.tech)).toContain('Next.js');
});

test('missing headers (SW restart) still analyzes', async () => {
  vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue(injected({ meta: { generator: ['WordPress 6.4'] } }));
  const r = await analyzeTab(2, 'https://x.test/');
  expect(r.status === 'ok' && r.detections.map((d) => d.tech)).toContain('WordPress');
});

test('empty injection result (page navigated away) → ok with no detections', async () => {
  vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue([] as any);
  const r = await analyzeTab(3, 'https://x.test/');
  expect(r).toMatchObject({ status: 'ok', detections: [] });
});

test('SPA navigation (same document) keeps the headers captured for that document', async () => {
  await browser.storage.session.set({ [headersKey(1)]: { url: 'https://x.test/', headers: { 'x-powered-by': 'Next.js 15' } } });
  const exec = vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue([{ frameId: 0, documentId: 'doc-A', result: {} }] as any);
  await analyzeTab(1, 'https://x.test/');
  const r = await analyzeTab(1, 'https://x.test/pricing');
  expect(r.status === 'ok' && r.detections.map((d) => d.tech)).toContain('Next.js');
  exec.mockResolvedValue([{ frameId: 0, documentId: 'doc-B', result: {} }] as any);
  const other = await analyzeTab(1, 'https://x.test/back');
  expect(other.status === 'ok' && other.detections.map((d) => d.tech)).not.toContain('Next.js');
});
