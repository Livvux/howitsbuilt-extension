import { fakeBrowser } from 'wxt/testing/fake-browser';
import { analyzeTab } from '../lib/analyze';

const injected = (result: unknown) => [{ frameId: 0, documentId: 'd', result }] as any;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

test('non-http(s) URL is unsupported without reading the page', async () => {
  const spy = vi.spyOn(browser.scripting, 'executeScript');
  expect(await analyzeTab(1, 'chrome://extensions')).toEqual({ status: 'unsupported', url: 'chrome://extensions' });
  expect(spy).not.toHaveBeenCalled();
});

test('hidden URL is unsupported without reading the page', async () => {
  const spy = vi.spyOn(browser.scripting, 'executeScript');
  expect(await analyzeTab(1, undefined)).toEqual({ status: 'unsupported', url: '' });
  expect(spy).not.toHaveBeenCalled();
});

test('script injection rejection gracefully reports unsupported', async () => {
  vi.spyOn(browser.scripting, 'executeScript').mockRejectedValue(new Error('Cannot access contents of the page'));
  expect(await analyzeTab(1, 'https://chromewebstore.google.com/x')).toEqual({
    status: 'unsupported',
    url: 'https://chromewebstore.google.com/x',
  });
});

test('detects technologies from page-local signals using MAIN-world injection', async () => {
  const spy = vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue(
    injected({ meta: { generator: ['WordPress 6.4'] } }),
  );
  const readSession = vi.spyOn(browser.storage.session, 'get');
  const result = await analyzeTab(1, 'https://example.test/');
  expect(result.status).toBe('ok');
  expect(result.status === 'ok' && result.detections.map((d) => d.tech)).toContain('WordPress');
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0]![0]).toMatchObject({ target: { tabId: 1 }, world: 'MAIN' });
  expect(readSession).not.toHaveBeenCalled();
});

test('no result from a navigated-away page produces no detections', async () => {
  vi.spyOn(browser.scripting, 'executeScript').mockResolvedValue([] as any);
  expect(await analyzeTab(3, 'https://example.test/')).toMatchObject({ status: 'ok', detections: [] });
});
