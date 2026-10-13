import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../packages/engine/data/icons');

export default defineConfig({
  manifestVersion: 3, // WXT defaults Firefox to MV2
  manifest: ({ browser }) => ({
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: ['activeTab', 'scripting', 'storage'],
    // Only the account / Pro API needs a persistent host grant.
    // Other sites are inspected only when the user opens the popup (activeTab).
    host_permissions: ['https://howitsbuilt.fyi/*'],
    // Opening the popup via the shortcut also grants activeTab for the current tab.
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+H' },
        description: '__MSG_cmdScan__',
      },
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'extension@howitsbuilt.fyi',
          // 140: first release with data_collection_permissions (also covers
          // scripting world: 'MAIN' since 128 and storage.session since 115).
          strict_min_version: '140.0',
          // Free scans collect nothing. Only the optional signed-in account sends
          // the auth token and the scanned domain to howitsbuilt.fyi.
          data_collection_permissions: { required: ['none'], optional: ['authenticationInfo', 'browsingActivity'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
  hooks: {
    // Technology icons live in the engine package; ship them as /tech-icons/<name>.webp.
    'build:publicAssets': (_, assets) => {
      for (const file of readdirSync(ICONS_DIR)) {
        assets.push({ absoluteSrc: join(ICONS_DIR, file), relativeDest: `tech-icons/${file}` });
      }
    },
  },
});
