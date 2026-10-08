import { resolveVersion } from './pattern';
import type { CompiledTech, Evidence, EvidenceSource, Pattern, Signals } from './types';

export type Hit = { confidence: number; version?: string; evidence: Evidence[] };

/** Signals with document-sized fields pre-chunked (see bound.ts). */
export type Prepared = Omit<Signals, 'html' | 'scripts' | 'text'> & { html?: string[]; scripts?: string[]; text?: string[] };

const EVIDENCE_MAX = 120;
// Sources whose value is a whole document: show the matched excerpt, not the value.
const EXCERPT_SOURCES = new Set<EvidenceSource>(['html', 'script', 'text']);

export function matchTech(tech: CompiledTech, s: Prepared): Hit | null {
  let confidence = 0;
  let version: string | undefined;
  const evidence: Evidence[] = [];

  // Each pattern counts once: the first value it matches.
  const test = (patterns: Pattern[] | undefined, values: string[] | undefined, source: EvidenceSource, key?: string): void => {
    if (!patterns || !values) return;
    for (const p of patterns) {
      for (const value of values) {
        const m = p.regex.exec(value);
        if (!m) continue;
        confidence += p.confidence;
        if (p.version) {
          const v = resolveVersion(p.version, m);
          if (v.length > (version?.length ?? 0)) version = v;
        }
        const shown = EXCERPT_SOURCES.has(source) ? m[0] : value;
        evidence.push({ source, ...(key === undefined ? {} : { key }), match: shown.slice(0, EVIDENCE_MAX) });
        break;
      }
    }
  };
  const one = (v: string | undefined): string[] | undefined => (v === undefined ? undefined : [v]);

  test(tech.url, [s.url], 'url');
  test(tech.html, s.html, 'html');
  test(tech.text, s.text, 'text');
  test(tech.scriptSrc, s.scriptSrc, 'scriptSrc');
  test(tech.scripts, s.scripts, 'script');
  test(tech.certIssuer, one(s.certIssuer), 'cert');
  for (const [k, p] of Object.entries(tech.headers)) test(p, one(s.headers?.[k]), 'header', k);
  for (const [k, p] of Object.entries(tech.cookies)) test(p, one(s.cookies?.[k]), 'cookie', k);
  for (const [k, p] of Object.entries(tech.meta)) test(p, s.meta?.[k], 'meta', k);
  for (const [k, p] of Object.entries(tech.js)) test(p, one(s.js?.[k]), 'js', k);
  for (const [k, p] of Object.entries(tech.dns)) test(p, s.dns?.[k], 'dns', k);

  for (const rule of tech.dom) {
    const r = s.dom?.[rule.selector];
    if (!r) continue;
    const key = rule.selector;
    if (rule.exists || (!rule.text && !rule.attributes && !rule.properties)) {
      confidence += 100;
      evidence.push({ source: 'dom', key, match: key });
    }
    test(rule.text, one(r.text), 'dom', key);
    for (const [name, p] of Object.entries(rule.attributes ?? {})) test(p, one(r.attributes?.[name]), 'dom', key);
    for (const [name, p] of Object.entries(rule.properties ?? {})) test(p, one(r.properties?.[name]), 'dom', key);
  }

  if (evidence.length === 0) return null;
  return { confidence, ...(version ? { version } : {}), evidence };
}
