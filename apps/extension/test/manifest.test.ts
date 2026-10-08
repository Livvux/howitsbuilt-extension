import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const OUT = '.output/chrome-mv3';

test('manifest permissions are minimal', async () => {
  const m = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
  expect(m.manifest_version).toBe(3);
  expect(m.name).toBe('How Its Built');
  expect([...m.permissions].sort()).toEqual(['scripting', 'storage', 'webRequest']);
  expect(m.host_permissions).toEqual(['<all_urls>']);
  // Only the sign-in bridge, and only on our own site.
  expect(m.content_scripts).toEqual([expect.objectContaining({ matches: ['https://howitsbuilt.fyi/*'] })]);
  expect(Object.keys(m.icons)).toEqual(expect.arrayContaining(['16', '32', '48', '128']));
});

test('technology icons are bundled', () => {
  expect(existsSync(`${OUT}/tech-icons/Next.js.webp`)).toBe(true);
});
