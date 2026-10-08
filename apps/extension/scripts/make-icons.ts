// Renders assets/logo.svg to the extension icon PNGs. Run after changing the logo:
//   pnpm tsx scripts/make-icons.ts
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
for (const size of [16, 32, 48, 128]) {
  await sharp(join(root, 'assets/logo.svg'), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(root, `public/icon-${size}.png`));
}
