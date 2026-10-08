import { parsePattern } from './pattern';
import type { CompiledTech, DomRule, Implied, Pattern } from './types';

type Raw = Record<string, unknown>;

const asArray = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const asStrings = (v: unknown): string[] => asArray(v).filter((x): x is string => typeof x === 'string');
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

export function compileTechnologies(raw: Record<string, unknown>): { techs: CompiledTech[]; invalidPatterns: number } {
  let invalidPatterns = 0;

  const patterns = (v: unknown): Pattern[] =>
    asStrings(v).flatMap((s) => {
      const p = parsePattern(s);
      if (!p) invalidPatterns++;
      return p ? [p] : [];
    });

  const keyed = (v: unknown, lowercase: boolean): Record<string, Pattern[]> =>
    isObject(v)
      ? Object.fromEntries(Object.entries(v).map(([k, p]) => [lowercase ? k.toLowerCase() : k, patterns(p)]))
      : {};

  const domRules = (v: unknown): DomRule[] => {
    if (!isObject(v)) return asStrings(v).map((selector) => ({ selector, exists: true }));
    return Object.entries(v).map(([selector, rule]) => {
      const r = isObject(rule) ? rule : {};
      const out: DomRule = { selector };
      if ('exists' in r) out.exists = true;
      if ('text' in r) out.text = patterns(r.text);
      if (isObject(r.attributes)) out.attributes = keyed(r.attributes, false);
      if (isObject(r.properties)) out.properties = keyed(r.properties, false);
      return out;
    });
  };

  const implies = (v: unknown): Implied[] =>
    asStrings(v).map((s) => {
      const [name = '', ...attrs] = s.split('\\;');
      const out: Implied = { name, confidence: 100 };
      for (const a of attrs) {
        if (a.startsWith('confidence:')) out.confidence = Number(a.slice(11)) || 0;
        else if (a.startsWith('version:')) out.version = a.slice(8);
      }
      return out;
    });

  const techs = Object.entries(raw).map(([name, value]): CompiledTech => {
    const t = isObject(value) ? value : {};
    return {
      name,
      cats: asArray(t.cats).map(Number),
      icon: typeof t.icon === 'string' ? t.icon : undefined,
      website: typeof t.website === 'string' ? t.website : undefined,
      url: patterns(t.url),
      html: patterns(t.html),
      text: patterns(t.text),
      scriptSrc: patterns(t.scriptSrc),
      scripts: patterns(t.scripts),
      headers: keyed(t.headers, true),
      cookies: keyed(t.cookies, false),
      meta: keyed(t.meta, true),
      js: keyed(t.js, false),
      dns: keyed(t.dns, false),
      certIssuer: patterns(t.certIssuer),
      dom: domRules(t.dom),
      implies: implies(t.implies),
      requires: asStrings(t.requires),
      requiresCategory: asArray(t.requiresCategory).map(Number),
      excludes: asStrings(t.excludes),
    };
  });

  return { techs, invalidPatterns };
}
