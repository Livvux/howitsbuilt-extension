import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../packages/engine/data/icons');

export default defineConfig({
  manifest: ({ browser }) => ({
    name: 'How Its Built',
    description: 'See how any website is built — frameworks, hosting, analytics and more.',
    permissions: ['activeTab', 'scripting', 'storage'],
    // Only the account / Pro API needs a persistent host grant.
    // Other sites are inspected only when the user opens the popup (activeTab).
    host_permissions: ['https://howitsbuilt.fyi/*'],
    action: { default_title: 'How Its Built' },
    // Opening the popup via the shortcut also grants activeTab for the current tab.
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+H' },
        description: 'Scan the current site',
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
