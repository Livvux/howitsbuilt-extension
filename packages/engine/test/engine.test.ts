import { compileTechnologies } from '../src/compile';
import { createEngine } from '../src/index';
import technologies from '../data/technologies.json';
import categories from '../data/categories.json';

const engine = createEngine(technologies as Record<string, unknown>, categories);

test('Next.js header implies React', () => {
  const r = engine.match({ url: 'https://x.test', headers: { 'x-powered-by': 'Next.js 15.2.1' } });
  expect(r.find((d) => d.tech === 'Next.js')).toMatchObject({ version: '15.2.1' });
  expect(r.map((d) => d.tech)).toContain('React');
});

test('WordPress meta generator', () => {
  const r = engine.match({ url: 'https://x.test', meta: { generator: ['WordPress 6.4'] } });
  expect(r.find((d) => d.tech === 'WordPress')!.version).toBe('6.4');
  expect(r.map((d) => d.tech)).toContain('PHP');
});

test('probes list js chains and dom selectors', () => {
  expect(engine.probes.js).toContain('__NEXT_DATA__');
  expect(engine.probes.dom.length).toBeGreaterThan(0);
  expect(new Set(engine.probes.dom.map((p) => p.selector)).size).toBe(engine.probes.dom.length);
});

test('categories resolved', () => {
  const [d] = engine.match({ url: 'https://x.test', headers: { 'x-powered-by': 'Next.js' } });
  expect(d!.categories[0]).toEqual(expect.objectContaining({ id: expect.any(Number), name: expect.any(String) }));
});

test('icon and website passed through', () => {
  const d = engine.match({ url: 'https://x.test', headers: { 'x-powered-by': 'Next.js' } }).find((x) => x.tech === 'Next.js')!;
  expect(d).toMatchObject({ icon: 'Next.js.svg', website: 'https://nextjs.org' });
});

test('empty signals → nothing, no throw', () => {
  expect(engine.match({ url: 'https://x.test' })).toEqual([]);
});

test('probes (built from raw fingerprints) equal what the compiled techs need', () => {
  const { techs } = compileTechnologies(technologies as Record<string, unknown>);
  const js = new Set(techs.flatMap((t) => Object.keys(t.js)));
  const dom = new Map<string, { text: boolean; attributes: Set<string>; properties: Set<string> }>();
  for (const rule of techs.flatMap((t) => t.dom)) {
    const p = dom.get(rule.selector) ?? { text: false, attributes: new Set(), properties: new Set() };
    p.text ||= !!rule.text;
    Object.keys(rule.attributes ?? {}).forEach((a) => p.attributes.add(a));
    Object.keys(rule.properties ?? {}).forEach((a) => p.properties.add(a));
    dom.set(rule.selector, p);
  }
  expect(engine.probes.js).toEqual([...js]);
  expect(engine.probes.dom).toEqual(
    [...dom].map(([selector, p]) => ({ selector, text: p.text, attributes: [...p.attributes], properties: [...p.properties] })),
  );
});

test('lazily compiled engine: warm() is idempotent and detections match a fresh engine', () => {
  const fresh = createEngine(technologies as Record<string, unknown>, categories);
  fresh.warm();
  fresh.warm();
  const signals = {
    url: 'https://x.test',
    headers: { 'x-powered-by': 'Next.js 15.2.1', server: 'Caddy/2.8.4' },
    meta: { generator: ['WordPress 6.4'] },
    scriptSrc: ['https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js'],
    js: { __NEXT_DATA__: '' },
  };
  expect(fresh.match(signals)).toEqual(engine.match(signals));
  expect(fresh.match(signals).length).toBeGreaterThan(3);
  expect(fresh.invalidPatterns).toBe(engine.invalidPatterns);
});
