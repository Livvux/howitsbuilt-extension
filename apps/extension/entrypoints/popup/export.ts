import type { Detection } from '@howitsbuilt/engine';

export type Groups = [string, Detection[]][];

const withVersion = (d: Detection) => (d.version ? `${d.tech} ${d.version}` : d.tech);

export const toText = (host: string, groups: Groups): string =>
  [host, ...groups.map(([cat, items]) => `${cat}: ${items.map((d) => d.tech).join(', ')}`)].join('\n');

export const toMarkdown = (host: string, groups: Groups): string =>
  [`# ${host}`, ...groups.flatMap(([cat, items]) => ['', `## ${cat}`, ...items.map((d) => `- ${withVersion(d)}`)])].join('\n');

export const toJson = (url: string, scannedAt: number, groups: Groups): string =>
  JSON.stringify(
    {
      url,
      scannedAt,
      technologies: groups.flatMap(([, items]) =>
        items.map((d) => ({ name: d.tech, ...(d.version ? { version: d.version } : {}), categories: d.categories.map((c) => c.name) })),
      ),
    },
    null,
    2,
  );
