// @vitest-environment happy-dom
import { collectSignals } from '../lib/collect';

const none = { js: [], dom: [] };

const noHeaders = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

beforeEach(() => {
  noHeaders();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

test('collects meta, scriptSrc, inline scripts, cookies', async () => {
  document.head.innerHTML =
    '<meta name="Generator" content="WordPress 6.4"><meta property="og:site_name" content="X"><script src="/a.js"></script><script>var x=1</script>';
  document.cookie = 'NEXT_LOCALE=en';
  const s = await collectSignals(none);
  expect(s.meta).toEqual({ generator: ['WordPress 6.4'], 'og:site_name': ['X'] });
  expect(s.scriptSrc?.[0]).toMatch(/\/a\.js$/);
  expect(s.scripts).toEqual(['var x=1']);
  expect(s.cookies).toMatchObject({ NEXT_LOCALE: 'en' });
});

test('js chains: present only, nested, throwing getter ignored', async () => {
  (window as any).next = { version: '15.2.1' };
  (window as any).obj = { deep: {} };
  Object.defineProperty(window, 'boom', {
    get() {
      throw new Error('x');
    },
    configurable: true,
  });
  const s = await collectSignals({ js: ['next.version', 'obj.deep', 'boom.a', 'missing.x'], dom: [] });
  expect(s.js).toEqual({ 'next.version': '15.2.1', 'obj.deep': '' });
});

test('dom probes', async () => {
  document.body.innerHTML = '<a class="x" href="/y" data-v="2">hi</a>';
  const s = await collectSignals({
    js: [],
    dom: [
      { selector: 'a.x', text: true, attributes: ['href', 'missing'], properties: [] },
      { selector: '.none', text: false, attributes: [], properties: [] },
    ],
  });
  expect(s.dom).toEqual({ 'a.x': { exists: true, text: 'hi', attributes: { href: '/y' } } });
});

test('dom properties', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  (document.getElementById('app') as any)._vnode = { v: 1 };
  const s = await collectSignals({ js: [], dom: [{ selector: '#app', text: false, attributes: [], properties: ['_vnode', 'nope'] }] });
  expect(s.dom!['#app']!.properties).toEqual({ _vnode: '' });
});

test('invalid selector does not throw', async () => {
  await expect(
    collectSignals({ js: [], dom: [{ selector: 'a[', text: false, attributes: [], properties: [] }] }),
  ).resolves.toBeDefined();
});

test('truncates huge pages', async () => {
  document.body.innerHTML = '<p>' + 'x'.repeat(2_000_000) + '</p>';
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('script');
    el.textContent = 'y'.repeat(30_000);
    document.head.appendChild(el);
  }
  const s = await collectSignals(none);
  expect(s.html!.length).toBeLessThanOrEqual(1_000_000);
  expect(s.text!.length).toBeLessThanOrEqual(100_000);
  expect(s.scripts!.length).toBe(50);
  expect(s.scripts![0]!.length).toBe(20_000);
});

test('a throwing page API (CSP sandbox cookie) does not lose the other signals', async () => {
  document.head.innerHTML = '<meta name="generator" content="Hugo">';
  Object.defineProperty(document, 'cookie', {
    get() {
      throw new DOMException('sandboxed', 'SecurityError');
    },
    configurable: true,
  });
  try {
    const s = await collectSignals(none);
    expect(s.meta).toEqual({ generator: ['Hugo'] });
    expect(s.cookies).toEqual({});
  } finally {
    // The override is an own property; deleting it re-exposes the real accessor.
    delete (document as any).cookie;
  }
});

test('caps counts and value lengths of every signal', async () => {
  const long = 'z'.repeat(50_000);
  document.head.innerHTML =
    Array.from({ length: 1200 }, (_, i) => `<script src="/s${i}.js"></script>`).join('') +
    `<meta name="description" content="${long}">` +
    Array.from({ length: 1200 }, (_, i) => `<meta name="m${i}" content="x">`).join('');
  document.body.innerHTML = `<a class="x" title="${long}">t</a>`;
  (window as any).big = long;
  const s = await collectSignals({ js: ['big'], dom: [{ selector: 'a.x', text: false, attributes: ['title'], properties: [] }] });
  expect(s.scriptSrc!.length).toBe(1000);
  expect(Object.keys(s.meta!).length).toBeLessThanOrEqual(1000);
  expect(s.meta!.description?.[0]?.length ?? 0).toBeLessThanOrEqual(2000);
  expect(s.js!.big!.length).toBe(2000);
  expect(s.dom!['a.x']!.attributes!.title!.length).toBe(2000);
});

test('is self-contained (serializable for executeScript)', async () => {
  const src = collectSignals.toString();
  // Rebuilding from source must still work: no closures over module scope.
  const rebuilt = new Function(`return (${src})`)();
  document.head.innerHTML = '<meta name="generator" content="Hugo">';
  expect((await rebuilt(none)).meta).toEqual({ generator: ['Hugo'] });
});

const head = (headers: Record<string, string>, url = '') =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers: new Headers(headers), url }));

test('headers: cookieless same-origin HEAD of the origin root, lowercased and capped', async () => {
  head({ Server: 'Caddy', 'X-Powered-By': 'x'.repeat(5000) });
  const s = await collectSignals(none);
  expect(s.headers).toEqual({ server: 'Caddy', 'x-powered-by': 'x'.repeat(2000) });
  expect(fetch).toHaveBeenCalledWith(
    `${location.origin}/`,
    expect.objectContaining({ method: 'HEAD', credentials: 'omit', cache: 'no-store', redirect: 'follow' }),
  );
});

test('headers: a redirect to another origin is discarded', async () => {
  head({ Server: 'Other' }, 'https://elsewhere.test/');
  expect((await collectSignals(none)).headers).toEqual({});
});

test('headers: fetch failure yields empty headers and an intact scan', async () => {
  document.head.innerHTML = '<meta name="generator" content="Hugo">';
  const s = await collectSignals(none);
  expect(s.headers).toEqual({});
  expect(s.meta).toEqual({ generator: ['Hugo'] });
});

test('headers: a hanging request is aborted after 2.5 s', async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal!.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
          ),
      ),
    );
    document.head.innerHTML = '<meta name="generator" content="Hugo">';
    const scan = collectSignals(none);
    await vi.advanceTimersByTimeAsync(2500);
    const s = await scan;
    expect(s.headers).toEqual({});
    expect(s.meta).toEqual({ generator: ['Hugo'] });
  } finally {
    vi.useRealTimers();
  }
});
