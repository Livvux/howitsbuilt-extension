import { compileTechnologies } from './compile';
import { matchTech, type Hit } from './match';
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
      const hits = new Map<string, Hit>();
      for (const tech of techs) {
        const hit = matchTech(tech, signals);
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
