import { fakeBrowser } from 'wxt/testing/fake-browser';
import { clearToken, fetchMe, fetchProScan, getToken, isPublicHost, setToken, SITE_ORIGIN, tokenKey } from '../lib/account';

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
  expect(await fetchProScan('tok_1', 'b.com')).toBeNull();
});

test('fetchProScan caches per domain in session storage for 10 minutes', async () => {
  const pro = { domain: 'a.com', scannedAt: 1, technologies: [{ name: 'Next.js', category: 'X', confidence: 100, evidence: [] }] };
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, { success: true, data: pro, error: null }));
  const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
  expect(await fetchProScan('tok_1', 'a.com')).toEqual(pro);
  expect(await browser.storage.session.get('pro:a.com')).toEqual({ 'pro:a.com': { at: 1_000_000, scan: pro } });
  now.mockReturnValue(1_000_000 + 9 * 60_000);
  expect(await fetchProScan('tok_1', 'a.com')).toEqual(pro);
  expect(spy).toHaveBeenCalledTimes(1);
  await fetchProScan('tok_1', 'b.com'); // other domain: own entry
  expect(spy).toHaveBeenCalledTimes(2);
  now.mockReturnValue(1_000_000 + 10 * 60_000);
  await fetchProScan('tok_1', 'a.com'); // expired: refetch
  expect(spy).toHaveBeenCalledTimes(3);
});

test('fetchProScan does not cache failures', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
  expect(await fetchProScan('tok_1', 'a.com')).toBeNull();
  expect(await fetchProScan('tok_1', 'a.com')).toBeNull();
  expect(spy).toHaveBeenCalledTimes(2);
});

test('setToken and clearToken drop the Pro scan cache', async () => {
  await browser.storage.session.set({ 'pro:a.com': { at: 1, scan: {} } });
  await setToken('tok_2');
  expect(await browser.storage.session.get(null)).toEqual({});
  expect(await getToken()).toBe('tok_2');
  await browser.storage.session.set({ 'pro:a.com': { at: 1, scan: {} } });
  await clearToken();
  expect(await browser.storage.session.get(null)).toEqual({});
  expect(await getToken()).toBeNull();
});

test('fetchProScan rejects and does not cache technologies without a name or evidence array', async () => {
  const bad = (t: unknown) => ({ domain: 'a.com', scannedAt: 1, technologies: [t] });
  const spy = vi.spyOn(globalThis, 'fetch');
  for (const t of [{ category: 'X', confidence: 1, evidence: [] }, { name: 'X', category: 'Y', confidence: 1 }, { name: 'X', category: 'Y', confidence: 1, evidence: 'no' }, null]) {
    spy.mockResolvedValue(json(200, { success: true, data: bad(t), error: null }));
    expect(await fetchProScan('tok_1', 'a.com')).toBeNull();
  }
  expect(await browser.storage.session.get(null)).toEqual({});
});

test('isPublicHost only allows public-looking hostnames', () => {
  for (const h of ['example.com', 'www.Example.co.uk', 'a.b.io']) expect(isPublicHost(h), h).toBe(true);
  for (const h of ['localhost', 'intranet', 'x.local', 'x.internal', 'nas.lan', 'app.localhost', '127.0.0.1', '192.168.1.5', '[::1]', '::1', 'example.com.local', ''])
    expect(isPublicHost(h), h).toBe(false);
});

test('fetchProScan keeps a well-formed deep report and drops a malformed one', async () => {
  const deep = {
    infrastructure: { ips: ['1.2.3.4'], nameservers: [], mx: [], hosting: 'Hetzner' },
    tracking: [{ kind: 'GA4', id: 'G-ABC1234567' }],
    security: { grade: 'B', score: 80, checks: [{ id: 'https', label: 'HTTPS', pass: true }], leaks: [] },
    pages: [{ url: 'https://a.com/blog', ok: true }],
    rendered: true,
  };
  const base = { domain: 'a.com', scannedAt: 1, technologies: [] };
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { success: true, data: { ...base, deep }, error: null }));
  expect(await fetchProScan('tok_1', 'a.com')).toEqual({ ...base, deep });
  spy.mockResolvedValue(json(200, { success: true, data: { ...base, deep: { ...deep, tracking: [{ kind: 1 }] } }, error: null }));
  expect(await fetchProScan('tok_1', 'b.com')).toEqual(base);
});
