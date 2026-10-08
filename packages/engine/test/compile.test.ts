import { compileTechnologies } from '../src/compile';
import realTech from '../data/technologies.json';

test('normalizes string|array|object fields and lowercases header/meta keys', () => {
  const { techs } = compileTechnologies({
    X: { cats: [1], headers: { 'X-Powered-By': 'x' }, scriptSrc: 'a\\.js', meta: { Generator: ['x'] }, implies: 'Y\\;confidence:50' },
  });
  const t = techs[0]!;
  expect(Object.keys(t.headers)).toEqual(['x-powered-by']);
  expect(Object.keys(t.meta)).toEqual(['generator']);
  expect(t.scriptSrc).toHaveLength(1);
  expect(t.implies).toEqual([{ name: 'Y', confidence: 50 }]);
});

test('implies keeps version template', () => {
  const { techs } = compileTechnologies({ X: { cats: [1], implies: ['Y\\;version:2'] } });
  expect(techs[0]!.implies).toEqual([{ name: 'Y', confidence: 100, version: '2' }]);
});

test('bad pattern dropped, tech kept, counted', () => {
  const r = compileTechnologies({ X: { cats: [1], html: ['(?i)bad', 'good'] } });
  expect(r.techs[0]!.html).toHaveLength(1);
  expect(r.invalidPatterns).toBe(1);
});

test('dom: string, array and object forms', () => {
  const a = compileTechnologies({ X: { cats: [1], dom: 'div.a' } }).techs[0]!;
  expect(a.dom).toEqual([{ selector: 'div.a', exists: true }]);
  const b = compileTechnologies({ X: { cats: [1], dom: ['div.a', 'div.b'] } }).techs[0]!;
  expect(b.dom.map((d) => d.selector)).toEqual(['div.a', 'div.b']);
  const c = compileTechnologies({
    X: { cats: [1], dom: { 'a.x': { attributes: { href: 'y' }, exists: '', text: 'hi', properties: { _v: '' } } } },
  }).techs[0]!;
  expect(c.dom[0]).toMatchObject({ selector: 'a.x', exists: true });
  expect(c.dom[0]!.attributes!.href).toHaveLength(1);
  expect(c.dom[0]!.text).toHaveLength(1);
  expect(c.dom[0]!.properties!._v).toHaveLength(1);
});

test('requires/requiresCategory/excludes normalized to arrays', () => {
  const t = compileTechnologies({ X: { cats: [1], requires: 'A', requiresCategory: 6, excludes: ['B'] } }).techs[0]!;
  expect(t).toMatchObject({ requires: ['A'], requiresCategory: [6], excludes: ['B'] });
});

test('real data compiles with < 1% invalid patterns', () => {
  const r = compileTechnologies(realTech as Record<string, unknown>);
  expect(r.techs.length).toBeGreaterThan(3000);
  expect(r.invalidPatterns / r.techs.length).toBeLessThan(0.01);
});
