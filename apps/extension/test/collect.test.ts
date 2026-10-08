// @vitest-environment happy-dom
import { collectSignals } from '../lib/collect';

const none = { js: [], dom: [] };

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

test('collects meta, scriptSrc, inline scripts, cookies', () => {
  document.head.innerHTML =
    '<meta name="Generator" content="WordPress 6.4"><meta property="og:site_name" content="X"><script src="/a.js"></script><script>var x=1</script>';
  document.cookie = 'NEXT_LOCALE=en';
  const s = collectSignals(none);
  expect(s.meta).toEqual({ generator: ['WordPress 6.4'], 'og:site_name': ['X'] });
  expect(s.scriptSrc?.[0]).toMatch(/\/a\.js$/);
  expect(s.scripts).toEqual(['var x=1']);
  expect(s.cookies).toMatchObject({ NEXT_LOCALE: 'en' });
});

test('js chains: present only, nested, throwing getter ignored', () => {
  (window as any).next = { version: '15.2.1' };
  (window as any).obj = { deep: {} };
  Object.defineProperty(window, 'boom', {
    get() {
      throw new Error('x');
    },
    configurable: true,
  });
  const s = collectSignals({ js: ['next.version', 'obj.deep', 'boom.a', 'missing.x'], dom: [] });
  expect(s.js).toEqual({ 'next.version': '15.2.1', 'obj.deep': '' });
});

test('dom probes', () => {
  document.body.innerHTML = '<a class="x" href="/y" data-v="2">hi</a>';
  const s = collectSignals({
    js: [],
    dom: [
      { selector: 'a.x', text: true, attributes: ['href', 'missing'], properties: [] },
      { selector: '.none', text: false, attributes: [], properties: [] },
    ],
  });
  expect(s.dom).toEqual({ 'a.x': { exists: true, text: 'hi', attributes: { href: '/y' } } });
});

test('dom properties', () => {
  document.body.innerHTML = '<div id="app"></div>';
  (document.getElementById('app') as any)._vnode = { v: 1 };
  const s = collectSignals({ js: [], dom: [{ selector: '#app', text: false, attributes: [], properties: ['_vnode', 'nope'] }] });
  expect(s.dom!['#app']!.properties).toEqual({ _vnode: '' });
});

test('invalid selector does not throw', () => {
  expect(() =>
    collectSignals({ js: [], dom: [{ selector: 'a[', text: false, attributes: [], properties: [] }] }),
  ).not.toThrow();
});

test('truncates huge pages', () => {
  document.body.innerHTML = '<p>' + 'x'.repeat(2_000_000) + '</p>';
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('script');
    el.textContent = 'y'.repeat(30_000);
    document.head.appendChild(el);
  }
  const s = collectSignals(none);
  expect(s.html!.length).toBeLessThanOrEqual(1_000_000);
  expect(s.text!.length).toBeLessThanOrEqual(100_000);
  expect(s.scripts!.length).toBe(50);
  expect(s.scripts![0]!.length).toBe(20_000);
});

test('a throwing page API (CSP sandbox cookie) does not lose the other signals', () => {
  document.head.innerHTML = '<meta name="generator" content="Hugo">';
  Object.defineProperty(document, 'cookie', {
    get() {
      throw new DOMException('sandboxed', 'SecurityError');
    },
    configurable: true,
  });
  try {
    const s = collectSignals(none);
    expect(s.meta).toEqual({ generator: ['Hugo'] });
    expect(s.cookies).toEqual({});
  } finally {
    // The override is an own property; deleting it re-exposes the real accessor.
    delete (document as any).cookie;
  }
});

test('caps counts and value lengths of every signal', () => {
  const long = 'z'.repeat(50_000);
  document.head.innerHTML =
    Array.from({ length: 1200 }, (_, i) => `<script src="/s${i}.js"></script>`).join('') +
    `<meta name="description" content="${long}">` +
    Array.from({ length: 1200 }, (_, i) => `<meta name="m${i}" content="x">`).join('');
  document.body.innerHTML = `<a class="x" title="${long}">t</a>`;
  (window as any).big = long;
  const s = collectSignals({ js: ['big'], dom: [{ selector: 'a.x', text: false, attributes: ['title'], properties: [] }] });
  expect(s.scriptSrc!.length).toBe(1000);
  expect(Object.keys(s.meta!).length).toBeLessThanOrEqual(1000);
  expect(s.meta!.description?.[0]?.length ?? 0).toBeLessThanOrEqual(2000);
  expect(s.js!.big!.length).toBe(2000);
  expect(s.dom!['a.x']!.attributes!.title!.length).toBe(2000);
});

test('is self-contained (serializable for executeScript)', () => {
  const src = collectSignals.toString();
  // Rebuilding from source must still work: no closures over module scope.
  const rebuilt = new Function(`return (${src})`)();
  document.head.innerHTML = '<meta name="generator" content="Hugo">';
  expect(rebuilt(none).meta).toEqual({ generator: ['Hugo'] });
});
