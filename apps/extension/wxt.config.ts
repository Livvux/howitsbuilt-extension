import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../packages/engine/data/icons');

export default defineConfig({
  manifest: {
    name: 'How Its Built',
    description: 'See how any website is built — frameworks, hosting, analytics and more.',
    permissions: ['activeTab', 'scripting', 'storage'],
    // Only the account / Pro API needs a persistent host grant.
    // Other sites are inspected only when the user opens the popup (activeTab).
    host_permissions: ['https://howitsbuilt.fyi/*'],
    action: { default_title: 'How Its Built' },
  },
  hooks: {
    // Technology icons live in the engine package; ship them as /tech-icons/<name>.webp.
    'build:publicAssets': (_, assets) => {
      for (const file of readdirSync(ICONS_DIR)) {
        assets.push({ absoluteSrc: join(ICONS_DIR, file), relativeDest: `tech-icons/${file}` });
      }
    },
  },
});
