import type { CompiledTech, DomProbe, Probes } from './types';

/** What a collector must read from a page so every js/dom fingerprint can be evaluated. */
export function buildProbes(techs: CompiledTech[]): Probes {
  const js = new Set<string>();
  const dom = new Map<string, { text: boolean; attributes: Set<string>; properties: Set<string> }>();

  for (const tech of techs) {
    for (const chain of Object.keys(tech.js)) js.add(chain);
    for (const rule of tech.dom) {
      const probe = dom.get(rule.selector) ?? { text: false, attributes: new Set(), properties: new Set() };
      if (rule.text) probe.text = true;
      for (const a of Object.keys(rule.attributes ?? {})) probe.attributes.add(a);
      for (const p of Object.keys(rule.properties ?? {})) probe.properties.add(p);
      dom.set(rule.selector, probe);
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
