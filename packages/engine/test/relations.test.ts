import { createEngine } from '../src/index';
import technologies from '../data/technologies.json';
import categories from '../data/categories.json';

const cats = { '1': { name: 'CMS', priority: 1 }, '2': { name: 'Other', priority: 2 } };
const url = 'https://x.test';
const names = (e: ReturnType<typeof createEngine>, s: Parameters<ReturnType<typeof createEngine>['match']>[0]) =>
  e.match(s).map((d) => d.tech).sort();

test('implies is transitive and carries confidence', () => {
  const e = createEngine({ A: { cats: [1], html: 'aaa', implies: 'B\\;confidence:50' }, B: { cats: [1], implies: 'C' }, C: { cats: [1] } }, cats);
  const r = e.match({ url, html: 'aaa' });
  expect(r.map((d) => d.tech).sort()).toEqual(['A', 'B', 'C']);
  expect(r.find((d) => d.tech === 'B')!.confidence).toBe(50);
  expect(r.find((d) => d.tech === 'C')!.confidence).toBe(50);
  expect(r.find((d) => d.tech === 'C')!.evidence[0]).toEqual({ source: 'implies', match: 'B' });
});

test('implies with version', () => {
  const e = createEngine({ A: { cats: [1], html: 'a', implies: 'B\\;version:7' }, B: { cats: [1] } }, cats);
  expect(e.match({ url, html: 'a' }).find((d) => d.tech === 'B')!.version).toBe('7');
});

test('cyclic implies terminates', () => {
  const e = createEngine({ A: { cats: [1], html: 'a', implies: 'B' }, B: { cats: [1], implies: 'A' } }, cats);
  expect(e.match({ url, html: 'a' })).toHaveLength(2);
});

test('implies of unknown tech is ignored', () => {
  const e = createEngine({ A: { cats: [1], html: 'a', implies: 'Nope' } }, cats);
  expect(names(e, { url, html: 'a' })).toEqual(['A']);
});

test('requires / requiresCategory / excludes', () => {
  const e = createEngine(
    {
      A: { cats: [1], html: 'a' },
      R: { cats: [2], html: 'r', requires: 'Missing' },
      RC: { cats: [2], html: 'rc', requiresCategory: 1 },
      X: { cats: [2], html: 'x', excludes: 'A' },
    },
    cats,
  );
  expect(names(e, { url, html: 'a r rc' })).toEqual(['A', 'RC']);
  expect(names(e, { url, html: 'a x' })).toEqual(['X']);
});

test('requires satisfied keeps tech', () => {
  const e = createEngine({ A: { cats: [1], html: 'a' }, R: { cats: [2], html: 'r', requires: 'A' } }, cats);
  expect(names(e, { url, html: 'a r' })).toEqual(['A', 'R']);
});

test('confidence sums and caps at 100; longest version wins', () => {
  const e = createEngine(
    { A: { cats: [1], html: 'v(1\\.2)\\;version:\\1\\;confidence:60', scriptSrc: 'a-(1\\.2\\.3)\\.js\\;version:\\1\\;confidence:60' } },
    cats,
  );
  const [d] = e.match({ url, html: 'v1.2', scriptSrc: ['/a-1.2.3.js'] });
  expect(d).toMatchObject({ confidence: 100, version: '1.2.3' });
});

test('sorted by category priority, then name', () => {
  const e = createEngine({ Z: { cats: [1], html: 'z' }, B: { cats: [2], html: 'b' }, A: { cats: [2], html: 'a' } }, cats);
  expect(e.match({ url, html: 'a b z' }).map((d) => d.tech)).toEqual(['Z', 'A', 'B']);
});

test('mutual excludes keep the stronger match instead of dropping both (Angular vs AngularDart)', () => {
  const e = createEngine(
    {
      Angular: { cats: [1], dom: { '[ng-version]': { attributes: { 'ng-version': '^([\\d.]+)\\;version:\\1' } } }, implies: 'TS', excludes: 'AngularDart' },
      AngularDart: { cats: [1], js: { ngTestabilityRegistries: '' }, excludes: 'Angular' },
      TS: { cats: [1] },
    },
    cats,
  );
  const r = e.match({ url, js: { ngTestabilityRegistries: '' }, dom: { '[ng-version]': { exists: true, attributes: { 'ng-version': '22.2.1' } } } });
  expect(r.map((d) => d.tech).sort()).toEqual(['Angular', 'TS']);
});

test('real data: modern Angular is not erased by AngularDart', () => {
  const real = createEngine(technologies as Record<string, unknown>, categories);
  const r = real.match({ url, js: { ngTestabilityRegistries: '' }, dom: { '[ng-version]': { exists: true, attributes: { 'ng-version': '22.2.1+sha-5ff83c1' } } } });
  expect(r.map((d) => d.tech)).toContain('Angular');
});
