import { createEngine } from '../src/index';
import type { Signals } from '../src/types';

const cats = { '1': { name: 'CMS', priority: 1 } };
const url = 'https://x.test/';

function hit(def: Record<string, unknown>, signals: Omit<Signals, 'url'> & { url?: string }) {
  return createEngine({ T: { cats: [1], ...def } }, cats).match({ url, ...signals })[0];
}

test('header exists-check and value regex', () => {
  expect(hit({ headers: { 'X-Powered-By': '' } }, { headers: { 'x-powered-by': 'anything' } })).toBeDefined();
  const d = hit({ headers: { 'X-Powered-By': '^Next\\.js' } }, { headers: { 'x-powered-by': 'Next.js 15' } })!;
  expect(d.evidence).toEqual([{ source: 'header', key: 'x-powered-by', match: 'Next.js 15' }]);
  expect(hit({ headers: { 'X-Powered-By': '^Next' } }, { headers: { 'x-powered-by': 'PHP' } })).toBeUndefined();
});

test('meta matches any of several values', () => {
  const d = hit({ meta: { generator: '^WordPress ?([\\d.]+)?\\;version:\\1' } }, { meta: { generator: ['Other', 'WordPress 6.4'] } })!;
  expect(d.version).toBe('6.4');
  expect(d.evidence[0]).toMatchObject({ source: 'meta', key: 'generator' });
});

test('cookie', () => {
  expect(hit({ cookies: { NEXT_LOCALE: '' } }, { cookies: { NEXT_LOCALE: 'en' } })!.evidence[0]).toMatchObject({ source: 'cookie', key: 'NEXT_LOCALE' });
});

test('js chain', () => {
  const d = hit({ js: { 'next.version': '^(.+)$\\;version:\\1' } }, { js: { 'next.version': '15.2.1' } })!;
  expect(d).toMatchObject({ version: '15.2.1', evidence: [{ source: 'js', key: 'next.version', match: '15.2.1' }] });
});

test('scriptSrc, scripts, url, html, text', () => {
  expect(hit({ scriptSrc: 'jquery' }, { scriptSrc: ['/x.js', '/jquery.min.js'] })!.evidence[0]).toEqual({ source: 'scriptSrc', match: '/jquery.min.js' });
  expect(hit({ scripts: 'gtag\\(' }, { scripts: ['gtag("config")'] })!.evidence[0]).toEqual({ source: 'script', match: 'gtag(' });
  expect(hit({ url: '\\.myshopify\\.com' }, { url: 'https://a.myshopify.com/' })!.evidence[0]!.source).toBe('url');
  expect(hit({ html: '<div id="__nuxt"' }, { html: '<body><div id="__nuxt"></div>' })!.evidence[0]).toEqual({ source: 'html', match: '<div id="__nuxt"' });
  expect(hit({ text: 'powered by foo' }, { text: 'Powered by Foo' })!.evidence[0]!.source).toBe('text');
});

test('html evidence is truncated to 120 chars', () => {
  const d = hit({ html: 'a+' }, { html: 'a'.repeat(500) })!;
  expect(d.evidence[0]!.match.length).toBe(120);
});

test('dns and certIssuer', () => {
  expect(hit({ dns: { MX: 'google\\.com' } }, { dns: { MX: ['aspmx.l.google.com'] } })!.evidence[0]).toMatchObject({ source: 'dns', key: 'MX' });
  expect(hit({ certIssuer: "Let's Encrypt" }, { certIssuer: "Let's Encrypt" })!.evidence[0]!.source).toBe('cert');
});

test('dom: exists, text, attributes, properties', () => {
  expect(hit({ dom: 'div.x' }, { dom: { 'div.x': { exists: true } } })!.evidence[0]).toEqual({ source: 'dom', key: 'div.x', match: 'div.x' });
  expect(hit({ dom: { 'a.x': { text: '^hi$' } } }, { dom: { 'a.x': { exists: true, text: 'hi' } } })).toBeDefined();
  expect(hit({ dom: { 'a.x': { text: '^hi$' } } }, { dom: { 'a.x': { exists: true, text: 'no' } } })).toBeUndefined();
  const a = hit({ dom: { 'a.x': { attributes: { href: 'cdn\\.(\\d)\\;version:\\1' } } } }, { dom: { 'a.x': { exists: true, attributes: { href: 'cdn.3' } } } })!;
  expect(a.version).toBe('3');
  expect(hit({ dom: { 'a.x': { properties: { _v: '' } } } }, { dom: { 'a.x': { exists: true, properties: { _v: '1' } } } })).toBeDefined();
});

test('no signal for a field → no throw, no hit', () => {
  expect(hit({ headers: { a: '' }, meta: { b: '' }, js: { c: '' }, dom: 'x', dns: { MX: '' } }, {})).toBeUndefined();
});
