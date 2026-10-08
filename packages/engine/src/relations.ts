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

  // Stronger matches exclude first, so mutual excludes (Angular ⇄ AngularDart) keep one tech, not none.
  const strength = (name: string): [number, number, number] => {
    const hit = result.get(name)!;
    return [hit.confidence, hit.version ? 1 : 0, hit.evidence.length];
  };
  const order = [...result.keys()].sort((a, b) => {
    const [sa, sb] = [strength(a), strength(b)];
    return sb[0] - sa[0] || sb[1] - sa[1] || sb[2] - sa[2] || a.localeCompare(b);
  });
  for (const name of order) {
    if (!result.has(name)) continue;
    for (const ex of byName.get(name)?.excludes ?? []) result.delete(ex);
  }

  return result;
}
