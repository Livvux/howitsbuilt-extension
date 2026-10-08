import { parsePattern, resolveVersion } from '../src/pattern';

test('parses version + confidence', () => {
  const p = parsePattern('^Next\\.js ?([0-9.]+)?\\;version:\\1\\;confidence:50')!;
  expect(p.confidence).toBe(50);
  expect(resolveVersion(p.version!, p.regex.exec('Next.js 15.2.1')!)).toBe('15.2.1');
});

test('case-insensitive, empty = match anything', () => {
  expect(parsePattern('jquery')!.regex.test('jQuery')).toBe(true);
  expect(parsePattern('')!.regex.test('x')).toBe(true);
});

test('default confidence is 100', () => {
  expect(parsePattern('x')!.confidence).toBe(100);
});

test('ternary version', () => {
  const p = parsePattern('(ab)?c\\;version:\\1?v2:v1')!;
  expect(resolveVersion(p.version!, p.regex.exec('abc')!)).toBe('v2');
  expect(resolveVersion(p.version!, p.regex.exec('c')!)).toBe('v1');
});

test('missing group resolves to empty string', () => {
  const p = parsePattern('a(b)?\\;version:\\1')!;
  expect(resolveVersion(p.version!, p.regex.exec('a')!)).toBe('');
});

test('invalid regex → null', () => expect(parsePattern('(?i)foo')).toBeNull());
