import type { Hit } from './match';
import type { CompiledTech } from './types';

/** Applies implies (transitively), then requires/requiresCategory, then excludes. Returns a new map. */
export function applyRelations(hits: Map<string, Hit>, byName: Map<string, CompiledTech>): Map<string, Hit> {
  const result = new Map(hits);

  const queue = [...hits.keys()];
  while (queue.length > 0) {
    const parent = queue.shift()!;
    const parentHit = result.get(parent)!;
    for (const imp of byName.get(parent)?.implies ?? []) {
      if (result.has(imp.name) || !byName.has(imp.name)) continue;
      // Version templates with capture refs have nothing to resolve against here.
      const version = imp.version && !imp.version.includes('\\') ? imp.version : undefined;
      result.set(imp.name, {
        confidence: Math.min(parentHit.confidence, imp.confidence),
        ...(version ? { version } : {}),
        evidence: [{ source: 'implies', match: parent }],
      });
      queue.push(imp.name);
    }
  }

  const present = [...result.keys()];
  for (const name of present) {
    const tech = byName.get(name);
    if (!tech) continue;
    const missingTech = tech.requires.some((r) => !result.has(r));
    const missingCat = tech.requiresCategory.some(
      (cat) => !present.some((other) => other !== name && byName.get(other)?.cats.includes(cat)),
    );
    if (missingTech || missingCat) result.delete(name);
  }

  const excluded = new Set([...result.keys()].flatMap((name) => byName.get(name)?.excludes ?? []));
  for (const name of excluded) result.delete(name);

  return result;
}
