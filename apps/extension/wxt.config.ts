import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../packages/engine/data/icons');

export default defineConfig({
  manifest: {
    name: 'How Its Built',
    description: 'See how any website is built — frameworks, hosting, analytics and more.',
    permissions: ['scripting', 'storage', 'webRequest'],
    host_permissions: ['<all_urls>'],
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
