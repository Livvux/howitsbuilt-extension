// Vendors fingerprints from enthec/webappanalyzer (GPL-3.0) into ../data.
// Usage: tsx scripts/update-fingerprints.ts [--ref <sha>]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const REPO = 'enthec/webappanalyzer';
const PINNED_REF = 'eea872af449e207e055398f7369d11ee48c8ea03';
const DATA_DIR = join(import.meta.dirname, '..', 'data');
const FILES = ['_', ...'abcdefghijklmnopqrstuvwxyz'];
const ICON_PX = 32; // popup shows 16px icons, 2x for retina
const ICON_CONCURRENCY = 16;

function argRef(): string {
  const i = process.argv.indexOf('--ref');
  const ref = i === -1 ? PINNED_REF : process.argv[i + 1];
  if (!ref || !/^[\w.-]+$/.test(ref)) throw new Error(`invalid --ref: ${ref}`);
  return ref;
}

// Upstream icons total ~67 MB (many SVGs embed rasters); normalize to small WebPs.
// Output name = original basename + .webp; consumers swap the extension.
async function convertIcons(srcDir: string, outDir: string): Promise<number> {
  mkdirSync(outDir, { recursive: true });
  const files = readdirSync(srcDir);
  let failed = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const file = files[next++]!;
      try {
        await sharp(join(srcDir, file), { density: 300 })
          .resize(ICON_PX, ICON_PX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 90 })
          .toFile(join(outDir, `${parse(file).name}.webp`));
      } catch (err) {
        failed++;
        console.warn(`icon skipped: ${file} (${(err as Error).message})`);
      }
    }
  };
  await Promise.all(Array.from({ length: ICON_CONCURRENCY }, worker));
  return failed;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

async function main(): Promise<void> {
  const ref = argRef();
  const tmp = mkdtempSync(join(tmpdir(), 'hib-fingerprints-'));
  try {
    const res = await fetch(`https://codeload.github.com/${REPO}/tar.gz/${ref}`);
    if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
    const archive = join(tmp, 'src.tar.gz');
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    execFileSync('tar', ['-xzf', archive, '-C', tmp, '--strip-components=1']);

    const technologies: Record<string, unknown> = {};
    for (const f of FILES) {
      const part = JSON.parse(readFileSync(join(tmp, 'src', 'technologies', `${f}.json`), 'utf8'));
      for (const [name, def] of Object.entries(part)) {
        if (name in technologies) throw new Error(`duplicate technology: ${name}`);
        technologies[name] = def;
      }
    }

    const categories = JSON.parse(readFileSync(join(tmp, 'src', 'categories.json'), 'utf8'));
    writeFileSync(join(DATA_DIR, 'technologies.json'), JSON.stringify(sortKeys(technologies)));
    writeFileSync(join(DATA_DIR, 'categories.json'), JSON.stringify(categories));
    rmSync(join(DATA_DIR, 'icons'), { recursive: true, force: true });
    const failedIcons = await convertIcons(join(tmp, 'src', 'images', 'icons'), join(DATA_DIR, 'icons'));
    writeFileSync(join(DATA_DIR, 'SOURCE'), `${REPO}@${ref}\nfetched ${new Date().toISOString().slice(0, 10)}\n`);

    console.log(`${Object.keys(technologies).length} technologies, ${Object.keys(categories).length} categories, ${failedIcons} icons skipped (${REPO}@${ref})`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
