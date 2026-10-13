import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(path, 'utf8');
const catalog = (lang: string): Record<string, { message: string }> => JSON.parse(read(`public/_locales/${lang}/messages.json`));

const sources = ['lib', 'entrypoints/popup'].flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => join(dir, f)));
const used = new Set([
  ...sources.flatMap((f) => [...read(f).matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]!)),
  ...[...read('wxt.config.ts').matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]!),
]);

test('en and de have identical keys and no empty messages', () => {
  const [en, de] = [catalog('en'), catalog('de')];
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  for (const c of [en, de]) for (const [key, { message }] of Object.entries(c)) expect(message.trim(), key).not.toBe('');
});

test('every key used in code exists, and no key is unused', () => {
  expect(used.size).toBeGreaterThan(0);
  expect([...used].sort()).toEqual(Object.keys(catalog('en')).sort());
});
