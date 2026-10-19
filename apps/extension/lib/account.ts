// Optional How Its Built account: free detection never needs it; Pro details come from the server.
export const SITE_ORIGIN = 'https://howitsbuilt.fyi';
export const tokenKey = 'auth:token';
const TOKEN_MAX = 512;
const API_TIMEOUT_MS = 45_000;

export type Plan = { tier: 'free' } | { tier: 'pro'; source: string; [k: string]: unknown };
export type Me = { email: string; plan: Plan };
export type ProTech = { name: string; category: string; icon?: string; website?: string; version?: string; confidence: number; evidence: { source: string; key?: string; match: string }[] };
export type ProDeep = {
  infrastructure: {
    ips: string[];
    asn?: { number: number; name: string; country?: string };
    hosting?: string;
    cdn?: string;
    nameservers: string[];
    dnsProvider?: string;
    mx: string[];
    mailProvider?: string;
    spf?: { record: string; all?: string };
    dmarc?: { record: string; policy?: string };
    tlsIssuer?: string;
  };
  tracking: { kind: string; id: string }[];
  security: { grade: string; score: number; checks: { id: string; label: string; pass: boolean }[]; leaks: { header: string; value: string }[] };
  pages: { url: string; ok: boolean }[];
  rendered: boolean;
};
export type ProScan = { domain: string; scannedAt: number; technologies: ProTech[]; deep?: ProDeep };

type Envelope<T> = { success: boolean; data: T | null };

export const getToken = async (): Promise<string | null> => ((await browser.storage.local.get(tokenKey))[tokenKey] as string | undefined) ?? null;
// storage.session holds only the per-domain Pro scan cache, so clearing it on any token change keeps one account's data from leaking to the next.
export const setToken = async (token: string) => {
  await browser.storage.session.clear();
  await browser.storage.local.set({ [tokenKey]: token });
};
export const clearToken = async () => {
  await browser.storage.session.clear();
  await browser.storage.local.remove(tokenKey);
};

async function api<T>(token: string, path: string): Promise<{ status: number; data: T | null } | null> {
  try {
    // A cold Pro deep scan renders the site in a browser server-side; give it time, but not forever.
    const res = await fetch(`${SITE_ORIGIN}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    const body = (await res.json().catch(() => null)) as Envelope<T> | null;
    return { status: res.status, data: body?.success ? body.data : null };
  } catch {
    return null; // offline: keep the token, show the free view
  }
}

/** Who is signed in. A 401 means the session ended (signed out on the web): forget the token. */
export async function fetchMe(token: string): Promise<Me | null> {
  const r = await api<Me>(token, '/api/v1/me');
  if (r?.status === 401) await clearToken();
  return r?.data ?? null;
}

const PRIVATE_SUFFIXES = ['.local', '.internal', '.lan', '.localhost'];

/** Only public-looking hostnames may leave the browser: no single-label names, localhost, private suffixes or IP literals. */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h.includes('.') || h === 'localhost' || h.includes(':') || /^\d+(\.\d+){3}$/.test(h)) return false;
  return !PRIVATE_SUFFIXES.some((s) => h.endsWith(s));
}

const PRO_TTL_MS = 10 * 60 * 1000;
type CachedScan = { at: number; scan: ProScan };

/** Server-side Pro view of a domain; null unless the response actually carries Pro fields. Cached 10 min per domain. */
export async function fetchProScan(token: string, domain: string): Promise<ProScan | null> {
  const key = `pro:${domain}`;
  const cached = (await browser.storage.session.get(key))[key] as CachedScan | undefined;
  if (cached && Date.now() - cached.at < PRO_TTL_MS) return cached.scan;
  const r = await api<ProScan>(token, `/api/v1/scan?domain=${encodeURIComponent(domain)}`);
  if (r?.status === 401) await clearToken();
  const scan = r?.data;
  if (
    !scan ||
    !Array.isArray(scan.technologies) ||
    !scan.technologies.every((t) => typeof t?.name === 'string' && typeof t.confidence === 'number' && Array.isArray(t.evidence))
  )
    return null;
  const { deep, ...rest } = scan;
  const checked: ProScan = isDeep(deep) ? { ...rest, deep } : rest;
  await browser.storage.session.set({ [key]: { at: Date.now(), scan: checked } satisfies CachedScan });
  return checked;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const allOf = (v: unknown, ok: (x: Record<string, unknown>) => boolean) =>
  Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && ok(x as Record<string, unknown>));

/** The deep report is optional: a malformed one is dropped, the rest of the Pro view still shows. */
export function isDeep(v: unknown): v is ProDeep {
  const d = v as Partial<ProDeep> | null | undefined;
  const infra = d?.infrastructure;
  return (
    !!infra &&
    [infra.ips, infra.nameservers, infra.mx].every((a) => Array.isArray(a) && a.every(isStr)) &&
    allOf(d.tracking, (x) => isStr(x.kind) && isStr(x.id)) &&
    isStr(d.security?.grade) &&
    typeof d.security.score === 'number' &&
    allOf(d.security.checks, (x) => isStr(x.id) && isStr(x.label) && typeof x.pass === 'boolean') &&
    allOf(d.security.leaks, (x) => isStr(x.header) && isStr(x.value)) &&
    allOf(d.pages, (x) => isStr(x.url) && typeof x.ok === 'boolean') &&
    typeof d.rendered === 'boolean'
  );
}

/** Content script on howitsbuilt.fyi: relays the token posted by /connect to the background. */
export function bridgeHandler(send: (message: { type: 'hib:token'; token: string }) => Promise<unknown>, ack: (message: { type: 'hib:connected' }) => void) {
  return async (event: MessageEvent) => {
    if (event.source !== window || event.origin !== SITE_ORIGIN) return;
    const data = event.data as { type?: unknown; token?: unknown } | null;
    if (data?.type !== 'hib:connect' || typeof data.token !== 'string' || !data.token || data.token.length > TOKEN_MAX) return;
    await send({ type: 'hib:token', token: data.token });
    ack({ type: 'hib:connected' });
  };
}

/** Background: only our own content script, running on our own site, may hand over a token. */
export function acceptToken(message: unknown, sender: { id?: string; url?: string }, selfId: string): string | null {
  const m = message as { type?: unknown; token?: unknown } | null;
  if (m?.type !== 'hib:token' || typeof m.token !== 'string' || m.token.length > TOKEN_MAX) return null;
  if (sender.id !== selfId || !sender.url || new URL(sender.url).origin !== SITE_ORIGIN) return null;
  return m.token;
}
