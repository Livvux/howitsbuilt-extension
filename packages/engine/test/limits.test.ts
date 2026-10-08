import { createEngine } from '../src/index';
import technologies from '../data/technologies.json';
import categories from '../data/categories.json';

const cats = { '1': { name: 'CMS', priority: 1 } };
const url = 'https://x.test/';
const real = createEngine(technologies as Record<string, unknown>, categories);

test('hostile html cannot stall matching (quadratic vendor patterns)', () => {
  const html = '"'.repeat(500_000) + '<'.repeat(500_000);
  const start = performance.now();
  real.match({ url, html, scripts: Array(50).fill('"'.repeat(10_000) + '<'.repeat(10_000)) });
  expect(performance.now() - start).toBeLessThan(2000);
});

test('large realistic html stays fast', () => {
  const html = '<div class="a b c" data-x="1"><script src="/x.js"></script><a href="https://example.com/p?q=1">link</a></div>\n'.repeat(9000);
  const start = performance.now();
  real.match({ url, html });
  expect(performance.now() - start).toBeLessThan(1000);
});

test('head and tail of huge html are both matched', () => {
  const e = createEngine({ Head: { cats: [1], html: '<meta name="head-marker"' }, Tail: { cats: [1], html: 'tail-marker' } }, cats);
  const html = '<meta name="head-marker">' + '<p>filler</p>'.repeat(100_000) + '<script>tail-marker</script>';
  expect(e.match({ url, html }).map((d) => d.tech).sort()).toEqual(['Head', 'Tail']);
});

test('tags spanning a chunk boundary still match', () => {
  const e = createEngine({ React: { cats: [1], html: '<[^>]+data-reactroot' } }, cats);
  for (const offset of [9_990, 10_000, 10_010]) {
    const html = 'x'.repeat(offset) + '<div class="app" data-reactroot="">' + '<p>y</p>'.repeat(3000);
    expect(e.match({ url, html }).map((d) => d.tech)).toEqual(['React']);
  }
});
