import { boundHtml, chunk } from './bound';
import { compileTechnologies } from './compile';
import { matchTech, type Hit, type Prepared } from './match';
import { buildProbes } from './probes';
import { applyRelations } from './relations';
import type { Category, Detection, Probes, Signals } from './types';

export * from './types';

export type Engine = {
  /** Sorted by category priority, then name. Never throws. */
  match(signals: Signals): Detection[];
  probes: Probes;
  invalidPatterns: number;
};

const MAX_CONFIDENCE = 100;
// Wall-clock budget for document-sized fields; afterwards only cheap fields are matched.
// ponytail: coarse guard against hostile pages; a Worker with terminate() would be exact.
const DOCUMENT_BUDGET_MS = 300;

function prepare(s: Signals): Prepared {
  return {
    ...s,
    html: s.html === undefined ? undefined : boundHtml(s.html),
    scripts: s.scripts?.flatMap(chunk),
    text: s.text === undefined ? undefined : chunk(s.text),
  };
}

export function createEngine(
  technologies: Record<string, unknown>,
  categories: Record<string, { name: string; priority: number }>,
): Engine {
  const { techs, invalidPatterns } = compileTechnologies(technologies);
  const byName = new Map(techs.map((t) => [t.name, t]));
  const catById = new Map<number, Category>(
    Object.entries(categories).map(([id, c]) => [Number(id), { id: Number(id), name: c.name, priority: c.priority }]),
  );

  const toDetection = (name: string, hit: Hit): Detection => {
    const tech = byName.get(name)!;
    return {
      tech: name,
      ...(tech.icon ? { icon: tech.icon } : {}),
      ...(tech.website ? { website: tech.website } : {}),
      categories: tech.cats.flatMap((id) => catById.get(id) ?? []),
      ...(hit.version ? { version: hit.version } : {}),
      confidence: Math.min(hit.confidence, MAX_CONFIDENCE),
      evidence: hit.evidence,
    };
  };

  const priority = (d: Detection): number => Math.min(...d.categories.map((c) => c.priority), Infinity);

  return {
    match(signals) {
      const full = prepare(signals);
      const cheap: Prepared = { ...full, html: undefined, scripts: undefined, text: undefined };
      const deadline = performance.now() + DOCUMENT_BUDGET_MS;
      const hits = new Map<string, Hit>();
      for (const tech of techs) {
        const hit = matchTech(tech, performance.now() < deadline ? full : cheap);
        if (hit) hits.set(tech.name, hit);
      }
      return [...applyRelations(hits, byName)]
        .map(([name, hit]) => toDetection(name, hit))
        .sort((a, b) => priority(a) - priority(b) || a.tech.localeCompare(b.tech));
    },
    probes: buildProbes(techs),
    invalidPatterns,
  };
}
