import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const OUT = '.output/chrome-mv3';

test('manifest requests access only to the invoked tab and our account service', async () => {
  const m = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
  expect(m.manifest_version).toBe(3);
  expect(m.name).toBe('How Its Built');
  expect([...m.permissions].sort()).toEqual(['activeTab', 'scripting', 'storage']);
  expect(m.host_permissions).toEqual(['https://howitsbuilt.fyi/*']);
  expect(m.optional_host_permissions ?? []).toEqual([]);
  expect(m.content_scripts).toEqual([expect.objectContaining({ matches: ['https://howitsbuilt.fyi/*'] })]);
  expect(m.permissions).not.toContain('webRequest');
  expect(Object.keys(m.icons)).toEqual(expect.arrayContaining(['16', '32', '48', '128']));
});

test('technology icons are bundled', () => {
  expect(existsSync(`${OUT}/tech-icons/Next.js.webp`)).toBe(true);
});
