import type { DomResult, Probes, Signals } from '@howitsbuilt/engine';

export type CollectedSignals = Omit<Signals, 'url' | 'headers' | 'dns' | 'certIssuer'>;

/**
 * Runs in the page's MAIN world via chrome.scripting.executeScript({ func, args }).
 * Must stay self-contained: it is serialized with Function#toString, so no imports,
 * no module-scope references, and limits are literals.
 * The page is hostile: every section is isolated and every value is capped.
 */
export function collectSignals(probes: Probes): CollectedSignals {
  const HTML_MAX = 1_000_000;
  const TEXT_MAX = 100_000;
  const SCRIPTS_MAX = 50;
  const SCRIPT_MAX = 20_000;
  const ITEMS_MAX = 1000;
  const VALUE_MAX = 2000;

  // A page can break any DOM API (CSP sandbox cookies, overridden getters); lose one section, not all.
  const safe = <T,>(read: () => T, fallback: T): T => {
    try {
      return read();
    } catch {
      return fallback;
    }
  };
  const cap = (v: string, max = VALUE_MAX): string => v.slice(0, max);
  // Objects/functions count as "exists" with an empty value; primitives are stringified.
  const stringify = (v: unknown): string => (typeof v === 'object' || typeof v === 'function' ? '' : cap(String(v)));

  const meta = safe(() => {
    const out: Record<string, string[]> = {};
    let count = 0;
    for (const el of Array.from(document.querySelectorAll('meta'))) {
      const key = (el.getAttribute('name') ?? el.getAttribute('property'))?.toLowerCase();
      const content = el.getAttribute('content');
      if (!key || content === null) continue;
      if (++count > ITEMS_MAX) break;
      (out[cap(key)] ??= []).push(cap(content));
    }
    return out;
  }, {});

  const scriptEls = safe(() => Array.from(document.querySelectorAll('script')), []);
  const scriptSrc = safe(() => scriptEls.filter((el) => el.src).slice(0, ITEMS_MAX).map((el) => cap(el.src)), []);
  const scripts = safe(
    () =>
      scriptEls
        .filter((el) => !el.src && el.textContent)
        .slice(0, SCRIPTS_MAX)
        .map((el) => cap(el.textContent!, SCRIPT_MAX)),
    [],
  );

  const cookies = safe(() => {
    const out: Record<string, string> = {};
    for (const pair of document.cookie.split(';').slice(0, ITEMS_MAX)) {
      const i = pair.indexOf('=');
      const name = (i === -1 ? pair : pair.slice(0, i)).trim();
      if (name) out[cap(name)] = i === -1 ? '' : cap(pair.slice(i + 1).trim());
    }
    return out;
  }, {});

  const js: Record<string, string> = {};
  for (const chain of probes.js) {
    safe(() => {
      let value: unknown = window;
      for (const part of chain.split('.')) {
        if (value === null || value === undefined) break;
        value = (value as Record<string, unknown>)[part];
      }
      if (value !== undefined && value !== null) js[chain] = stringify(value);
    }, undefined);
  }

  const dom: Record<string, DomResult> = {};
  for (const probe of probes.dom) {
    safe(() => {
      const el = document.querySelector(probe.selector);
      if (!el) return;
      const result: DomResult = { exists: true };
      if (probe.text) result.text = cap((el.textContent ?? '').trim());
      for (const name of probe.attributes) {
        const v = el.getAttribute(name);
        if (v !== null) (result.attributes ??= {})[name] = cap(v);
      }
      for (const name of probe.properties) {
        const v = (el as unknown as Record<string, unknown>)[name];
        if (v !== undefined) (result.properties ??= {})[name] = stringify(v);
      }
      dom[probe.selector] = result;
    }, undefined);
  }

  return {
    html: safe(() => cap(document.documentElement.outerHTML, HTML_MAX), ''),
    text: safe(() => cap(document.body?.innerText ?? '', TEXT_MAX), ''),
    meta,
    scriptSrc,
    scripts,
    cookies,
    js,
    dom,
  };
}
