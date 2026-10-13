import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const OUT = '.output/chrome-mv3';

test('manifest requests access only to the invoked tab and our account service', async () => {
  const m = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
  expect(m.manifest_version).toBe(3);
  expect(m.default_locale).toBe('en');
  expect(m.name).toBe('__MSG_extName__');
  expect(m.description).toBe('__MSG_extDescription__');
  expect(m.action.default_title).toBe('__MSG_extName__');
  expect(m.commands._execute_action.description).toBe('__MSG_cmdScan__');
  expect([...m.permissions].sort()).toEqual(['activeTab', 'scripting', 'storage']);
  expect(m.host_permissions).toEqual(['https://howitsbuilt.fyi/*']);
  expect(m.optional_host_permissions ?? []).toEqual([]);
  expect(m.content_scripts).toEqual([expect.objectContaining({ matches: ['https://howitsbuilt.fyi/*'] })]);
  expect(m.permissions).not.toContain('webRequest');
  expect(Object.keys(m.icons)).toEqual(expect.arrayContaining(['16', '32', '48', '128']));
});

test('keyboard shortcut opens the popup (and so grants activeTab)', async () => {
  const m = JSON.parse(await readFile(`${OUT}/manifest.json`, 'utf8'));
  expect(m.commands._execute_action.suggested_key.default).toBe('Alt+Shift+H');
  expect(m.browser_specific_settings).toBeUndefined();
});

test('technology icons are bundled', () => {
  expect(existsSync(`${OUT}/tech-icons/Next.js.webp`)).toBe(true);
});
