import type { Pattern } from './types';

const DEFAULT_CONFIDENCE = 100;

/** Parses a Wappalyzer pattern: `regex\;version:\1\;confidence:50`. Returns null for regexes JS can't compile. */
export function parsePattern(raw: string): Pattern | null {
  const [source = '', ...attrs] = raw.split('\\;');
  let regex: RegExp;
  try {
    regex = new RegExp(source, 'i');
  } catch {
    return null;
  }
  const pattern: Pattern = { regex, confidence: DEFAULT_CONFIDENCE, raw };
  for (const attr of attrs) {
    const i = attr.indexOf(':');
    if (i === -1) continue;
    const key = attr.slice(0, i);
    const value = attr.slice(i + 1);
    if (key === 'version') pattern.version = value;
    else if (key === 'confidence') pattern.confidence = Number(value) || 0;
  }
  return pattern;
}

/** Fills `\N` with capture groups and resolves the `x?a:b` ternary. */
export function resolveVersion(template: string, m: RegExpExecArray): string {
  const filled = template.replace(/\\(\d+)/g, (_, n: string) => m[Number(n)] ?? '');
  const ternary = /^(.*?)\?(.*?):(.*)$/.exec(filled);
  const resolved = ternary ? (ternary[1] ? ternary[2] : ternary[3]) : filled;
  return (resolved ?? '').trim();
}
