import { asStrings, isObject } from './compile';
import type { DomProbe, Probes } from './types';

/**
 * What a collector must read from a page so every js/dom fingerprint can be evaluated.
 * Reads the raw fingerprints (no regex construction) so it is cheap enough to run before compiling;
 * must mirror how compile.ts normalizes `js` and `dom` (the engine test checks this).
 */
export function buildProbes(raw: Record<string, unknown>): Probes {
  const js = new Set<string>();
  const dom = new Map<string, { text: boolean; attributes: Set<string>; properties: Set<string> }>();

  for (const value of Object.values(raw)) {
    const t = isObject(value) ? value : {};
    if (isObject(t.js)) for (const chain of Object.keys(t.js)) js.add(chain);
    const rules = isObject(t.dom) ? Object.entries(t.dom) : asStrings(t.dom).map((selector) => [selector, {}] as const);
    for (const [selector, rule] of rules) {
      const r = isObject(rule) ? rule : {};
      const probe = dom.get(selector) ?? { text: false, attributes: new Set(), properties: new Set() };
      if ('text' in r) probe.text = true;
      if (isObject(r.attributes)) for (const a of Object.keys(r.attributes)) probe.attributes.add(a);
      if (isObject(r.properties)) for (const p of Object.keys(r.properties)) probe.properties.add(p);
      dom.set(selector, probe);
    }
  }

  return {
    js: [...js],
    dom: [...dom].map(([selector, p]): DomProbe => ({
      selector,
      text: p.text,
      attributes: [...p.attributes],
      properties: [...p.properties],
    })),
  };
}
