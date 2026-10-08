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
