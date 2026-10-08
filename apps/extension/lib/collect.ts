import type { DomResult, Probes, Signals } from '@howitsbuilt/engine';

export type CollectedSignals = Omit<Signals, 'url' | 'headers' | 'dns' | 'certIssuer'>;

/**
 * Runs in the page's MAIN world via chrome.scripting.executeScript({ func, args }).
 * Must stay self-contained: it is serialized with Function#toString, so no imports,
 * no module-scope references, and limits are literals.
 */
export function collectSignals(probes: Probes): CollectedSignals {
  const HTML_MAX = 1_000_000;
  const TEXT_MAX = 100_000;
  const SCRIPTS_MAX = 50;
  const SCRIPT_MAX = 20_000;

  const meta: Record<string, string[]> = {};
  for (const el of Array.from(document.querySelectorAll('meta'))) {
    const key = (el.getAttribute('name') ?? el.getAttribute('property'))?.toLowerCase();
    const content = el.getAttribute('content');
    if (!key || content === null) continue;
    (meta[key] ??= []).push(content);
  }

  const scriptEls = Array.from(document.querySelectorAll('script'));
  const scriptSrc = scriptEls.filter((el) => el.src).map((el) => el.src);
  const scripts = scriptEls
    .filter((el) => !el.src && el.textContent)
    .slice(0, SCRIPTS_MAX)
    .map((el) => el.textContent!.slice(0, SCRIPT_MAX));

  const cookies: Record<string, string> = {};
  for (const pair of document.cookie.split(';')) {
    const i = pair.indexOf('=');
    const name = (i === -1 ? pair : pair.slice(0, i)).trim();
    if (name) cookies[name] = i === -1 ? '' : pair.slice(i + 1).trim();
  }

  // Objects/functions count as "exists" with an empty value; primitives are stringified.
  const stringify = (v: unknown): string => (typeof v === 'object' || typeof v === 'function' ? '' : String(v));

  const js: Record<string, string> = {};
  for (const chain of probes.js) {
    try {
      let value: unknown = window;
      for (const part of chain.split('.')) {
        if (value === null || value === undefined) break;
        value = (value as Record<string, unknown>)[part];
      }
      if (value !== undefined && value !== null) js[chain] = stringify(value);
    } catch {
      // Hostile getters and proxies: treat as absent.
    }
  }

  const dom: Record<string, DomResult> = {};
  for (const probe of probes.dom) {
    try {
      const el = document.querySelector(probe.selector);
      if (!el) continue;
      const result: DomResult = { exists: true };
      if (probe.text) result.text = (el.textContent ?? '').trim().slice(0, SCRIPT_MAX);
      for (const name of probe.attributes) {
        const v = el.getAttribute(name);
        if (v !== null) (result.attributes ??= {})[name] = v;
      }
      for (const name of probe.properties) {
        const v = (el as unknown as Record<string, unknown>)[name];
        if (v !== undefined) (result.properties ??= {})[name] = stringify(v);
      }
      dom[probe.selector] = result;
    } catch {
      // Invalid selector or throwing property.
    }
  }

  return {
    html: document.documentElement.outerHTML.slice(0, HTML_MAX),
    text: (document.body?.innerText ?? '').slice(0, TEXT_MAX),
    meta,
    scriptSrc,
    scripts,
    cookies,
    js,
    dom,
  };
}
