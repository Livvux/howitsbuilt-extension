import { fakeBrowser } from 'wxt/testing/fake-browser';
import { fetchMe, fetchProScan, getToken, SITE_ORIGIN, tokenKey } from '../lib/account';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

test('fetchMe sends the bearer token and returns email + plan', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { success: true, data: { email: 'u@x.com', plan: { tier: 'free' } }, error: null }));
  expect(await fetchMe('tok_1')).toEqual({ email: 'u@x.com', plan: { tier: 'free' } });
  const [url, init] = spy.mock.calls[0]!;
  expect(String(url)).toBe(`${SITE_ORIGIN}/api/v1/me`);
  expect(new Headers(init!.headers).get('authorization')).toBe('Bearer tok_1');
});

test('fetchMe on 401 forgets the token', async () => {
  await browser.storage.local.set({ [tokenKey]: 'tok_1' });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { success: false, data: null, error: { code: 'unauthorized' } }));
  expect(await fetchMe('tok_1')).toBeNull();
  expect(await getToken()).toBeNull();
});

test('fetchMe on network failure keeps the token and returns null', async () => {
  await browser.storage.local.set({ [tokenKey]: 'tok_1' });
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
  expect(await fetchMe('tok_1')).toBeNull();
  expect(await getToken()).toBe('tok_1');
});

test('fetchProScan returns Pro data, null when not Pro', async () => {
  const pro = { domain: 'a.com', scannedAt: 1, technologies: [{ name: 'Next.js', category: 'X', version: '15', confidence: 100, evidence: [] }] };
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { success: true, data: pro, error: null }));
  expect(await fetchProScan('tok_1', 'a.com')).toEqual(pro);
  expect(String(spy.mock.calls[0]![0])).toBe(`${SITE_ORIGIN}/api/v1/scan?domain=a.com`);
  spy.mockResolvedValue(json(200, { success: true, data: { domain: 'a.com', scannedAt: 1, technologies: [{ name: 'X', category: 'Y' }] }, error: null }));
  expect(await fetchProScan('tok_1', 'a.com')).toBeNull();
});
