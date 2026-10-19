import type { Category, Detection } from '@howitsbuilt/engine';
import type { ProDeep, ProScan, ProTech } from '@/lib/account';
import type { TabResult } from '@/lib/analyze';
import { t } from '@/lib/i18n';
import { toJson, toMarkdown, toText, type Groups } from './export';

const PRICING_URL = 'https://howitsbuilt.fyi/pricing';
const CONNECT_URL = 'https://howitsbuilt.fyi/connect';
const SEARCH_MIN = 15;

/** undefined = not known yet (no account UI); the free popup works without an account. */
export type AccountView = { kind: 'signed-out' } | { kind: 'account'; email: string; pro: boolean } | undefined;

/** Popup content: a finished/failed scan, or null while scanning. */
export type PopupState = TabResult | 'error' | null;
/** Server-side Pro scan for the current domain. undefined = not applicable (no Pro account). */
export type ProView = ProScan | 'loading' | 'error' | undefined;
export type PopupOpts = { pro?: ProView; onRescan?: () => void };

type Row = { d: Detection; pro?: ProTech };
type Attrs = Record<string, string>;

/** Tiny element builder. Children strings become text nodes — never parsed as HTML. */
function h(tag: string, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

const primaryCategory = (d: Detection): Category | undefined =>
  [...d.categories].sort((a, b) => a.priority - b.priority)[0];

function groupByCategory(detections: Detection[]): Groups {
  const groups = new Map<string, { priority: number; items: Detection[] }>();
  for (const d of detections) {
    const cat = primaryCategory(d) ?? { name: 'Other', priority: Infinity };
    const group = groups.get(cat.name) ?? { priority: cat.priority, items: [] };
    groups.set(cat.name, { ...group, items: [...group.items, d] });
  }
  return [...groups]
    .sort(([an, a], [bn, b]) => a.priority - b.priority || an.localeCompare(bn))
    .map(([name, g]) => [name, g.items]);
}

export const hostOf = (url: string): string => (URL.canParse(url) ? new URL(url).hostname : url);

const lc = (s: string) => s.toLowerCase();
const isWebUrl = (u: string) => URL.canParse(u) && /^https?:$/.test(new URL(u).protocol);

/** Local rows gain the server version when they have none; techs only the server found come back separately. */
export function mergePro(local: Detection[], scan: ProScan | undefined): { rows: Row[]; serverOnly: Row[] } {
  const byName = new Map((scan?.technologies ?? []).map((t) => [lc(t.name), t]));
  const rows = local.map((d): Row => {
    const pro = byName.get(lc(d.tech));
    return { d: pro?.version && !d.version ? { ...d, version: pro.version } : d, ...(pro ? { pro } : {}) };
  });
  const seen = new Set(local.map((d) => lc(d.tech)));
  const serverOnly = [...byName.values()]
    .filter((t) => !seen.has(lc(t.name)))
    .map((t): Row => ({
      d: {
        tech: t.name,
        ...(t.icon ? { icon: t.icon } : {}),
        ...(t.website && isWebUrl(t.website) ? { website: t.website } : {}),
        ...(t.version ? { version: t.version } : {}),
        categories: [{ id: 0, name: t.category, priority: Infinity }],
        confidence: t.confidence,
        evidence: [],
      },
      pro: t,
    }));
  return { rows, serverOnly };
}

const evidenceLine = (e: ProTech['evidence'][number]) => `${e.source === 'implies' ? t('impliedBy') : e.source}${e.key ? ` ${e.key}` : ''}: ${e.match}`;

function techRow({ d, pro }: Row): HTMLElement {
  const placeholder = () => h('span', { class: 'icon placeholder', 'aria-hidden': 'true' }, d.tech.charAt(0).toUpperCase());
  const icon = d.icon
    ? h('img', { class: 'icon', src: `/tech-icons/${d.icon.replace(/\.[^.]+$/, '.webp')}`, alt: '', width: '16', height: '16' })
    : placeholder();
  icon.addEventListener('error', () => icon.replaceWith(placeholder()), { once: true });
  const content = [icon, h('span', { class: 'name' }, d.tech), d.version ? h('span', { class: 'version' }, d.version) : ''];
  const body = d.website
    ? h('a', { href: d.website, target: '_blank', rel: 'noopener noreferrer' }, ...content)
    : h('span', { class: 'row' }, ...content);
  const proInfo = !pro
    ? ''
    : pro.evidence.length
      ? h('details', {}, h('summary', {}, `${pro.confidence}% · ${t('evidence')}`), h('ul', { class: 'evidence' }, ...pro.evidence.map((e) => h('li', {}, evidenceLine(e)))))
      : h('p', { class: 'conf' }, `${pro.confidence}%`);
  return h('li', { 'data-testid': 'tech', 'data-name': lc(d.tech) }, body, proInfo);
}

function message(title: string, detail: string): HTMLElement {
  return h('div', { class: 'message' }, h('p', { class: 'title' }, title), h('p', { class: 'detail' }, detail));
}

function copyButton(label: string, text: () => string, attrs: Attrs = {}): HTMLElement {
  const button = h('button', { type: 'button', ...attrs }, label);
  button.addEventListener('click', () => {
    navigator.clipboard
      .writeText(text())
      .then(() => {
        button.textContent = t('copied');
        setTimeout(() => (button.textContent = label), 1500);
      })
      .catch(console.error);
  });
  return button;
}

/** Hide rows (and then-empty sections) that don't match; no re-render, no re-scan. */
function applyFilter(main: HTMLElement, query: string): void {
  const needle = lc(query.trim());
  for (const li of main.querySelectorAll('li[data-name]')) li.toggleAttribute('hidden', !li.getAttribute('data-name')!.includes(needle));
  for (const s of main.querySelectorAll(':scope > section')) s.toggleAttribute('hidden', !s.querySelector('li[data-name]:not([hidden])'));
}

const link = (href: string, text: string, cls = 'pro') => h('a', { class: cls, href, target: '_blank', rel: 'noopener noreferrer' }, text);

const proStatus = (pro: ProView) =>
  pro === 'loading'
    ? h('p', { class: 'status', role: 'status' }, t('proLoading'))
    : pro === 'error'
      ? h('p', { class: 'status', role: 'status' }, t('proError'))
      : '';

function techList(rows: Row[], serverOnly: Row[]): HTMLElement {
  const rowOf = new Map(rows.map((r) => [r.d, r]));
  return h(
    'main',
    {},
    ...groupByCategory(rows.map((r) => r.d)).map(([cat, items]) =>
      h('section', {}, h('h2', { 'data-testid': 'category' }, cat), h('ul', {}, ...items.map((d) => techRow(rowOf.get(d)!)))),
    ),
    ...(serverOnly.length ? [h('section', {}, h('h2', {}, t('serverSection')), h('ul', {}, ...serverOnly.map(techRow)))] : []),
  );
}

const factRow = (label: string, value: string | undefined) => (value ? [h('dt', {}, label), h('dd', {}, value)] : []);

/** Server-side Pro deep scan. Nested in a div so the technology filter (direct child sections only) never hides it. */
function deepView(deep: ProDeep): HTMLElement {
  const infra = deep.infrastructure;
  const checkLabel: Record<string, string> = {
    https: t('secHttps'),
    hsts: t('secHsts'),
    csp: t('secCsp'),
    frame: t('secFrame'),
    nosniff: t('secNosniff'),
    referrer: t('secReferrer'),
    permissions: t('secPermissions'),
  };
  const facts = [
    ...factRow(t('infoHosting'), infra.hosting),
    ...factRow('ASN', infra.asn && `AS${infra.asn.number} · ${infra.asn.name}`),
    ...factRow('CDN', infra.cdn),
    ...factRow(t('infoDns'), infra.dnsProvider),
    ...factRow(t('infoMail'), infra.mailProvider),
    ...factRow('SPF', infra.spf ? (infra.spf.all ?? infra.spf.record) : t('infoNone')),
    ...factRow('DMARC', infra.dmarc ? `p=${infra.dmarc.policy ?? '?'}` : t('infoNone')),
    ...factRow(t('infoTls'), infra.tlsIssuer),
  ];
  const { security } = deep;
  return h(
    'div',
    { class: 'deep', 'data-testid': 'deep' },
    h('section', {}, h('h2', {}, t('infraTitle')), h('dl', { class: 'facts' }, ...facts)),
    h(
      'section',
      {},
      h('h2', {}, t('trackingTitle')),
      deep.tracking.length
        ? h('dl', { class: 'facts' }, ...deep.tracking.flatMap((x) => factRow(x.kind, x.id)))
        : h('p', { class: 'note' }, t('trackingNone')),
    ),
    h(
      'section',
      {},
      h('h2', {}, `${t('securityTitle')} · ${security.grade} ${security.score}`),
      h('ul', { class: 'checks' }, ...security.checks.map((c) => h('li', { class: c.pass ? 'pass' : 'fail' }, `${c.pass ? '●' : '○'} ${checkLabel[c.id] ?? c.label}`))),
      ...(security.leaks.length ? [h('p', { class: 'note' }, `${t('securityLeaks')}: ${security.leaks.map((l) => `${l.header}: ${l.value}`).join(', ')}`)] : []),
    ),
    h(
      'p',
      { class: 'note' },
      t('scannedPages', String(1 + deep.pages.filter((p) => p.ok).length)),
      deep.rendered ? ` · ${t('rendered')}` : '',
    ),
  );
}

function searchBox(main: HTMLElement, previous: string): HTMLInputElement {
  const search = h('input', { type: 'search', class: 'search', placeholder: t('filterLabel'), 'aria-label': t('filterLabel') }) as HTMLInputElement;
  search.addEventListener('input', () => applyFilter(main, search.value));
  search.value = previous;
  if (previous) applyFilter(main, previous);
  return search;
}

export function renderPopup(root: HTMLElement, state: PopupState, account?: AccountView, opts: PopupOpts = {}): void {
  const okState = state && state !== 'error' && state.status === 'ok' ? state : undefined;
  const url = state && state !== 'error' ? state.url : '';
  const host = hostOf(url);
  const header = h(
    'header',
    {},
    h('span', { class: 'brand' }, 'How Its Built'),
    h('span', { class: 'domain', 'data-testid': 'domain' }, host),
  );
  const oldSearch = root.querySelector<HTMLInputElement>('input[type=search]');
  const refocus = !!oldSearch && document.activeElement === oldSearch;

  let main: HTMLElement;
  let groups: Groups = [];
  let search: HTMLInputElement | undefined;
  if (state === null) {
    main = message(t('scanningTitle'), t('scanningDetail'));
  } else if (state === 'error') {
    main = message(t('errorTitle'), t('errorDetail'));
  } else if (!okState) {
    main = message(t('unsupportedTitle'), t('unsupportedDetail'));
  } else {
    const proScan = typeof opts.pro === 'object' ? opts.pro : undefined;
    const { rows, serverOnly } = mergePro(okState.detections, proScan);
    const all = [...rows, ...serverOnly].map((r) => r.d);
    if (all.length === 0) {
      main = message(t('emptyTitle'), t('emptyDetail'));
    } else {
      groups = groupByCategory(all);
      main = techList(rows, serverOnly);
      if (all.length > SEARCH_MIN) search = searchBox(main, oldSearch?.value ?? '');
    }
    if (proScan?.deep) main.append(deepView(proScan.deep));
  }

  const footer = h('footer', {});
  if (okState && groups.length > 0) {
    footer.append(
      copyButton(t('copy'), () => toText(host, groups), { 'data-testid': 'copy' }),
      copyButton('MD', () => toMarkdown(host, groups), { 'aria-label': t('copyMarkdown') }),
      copyButton('JSON', () => toJson(url, okState.scannedAt, groups), { 'aria-label': t('copyJson') }),
    );
  }
  if (opts.onRescan && (state === 'error' || okState)) {
    const rescan = h('button', { type: 'button', 'data-testid': 'rescan' }, t('rescan'));
    rescan.addEventListener('click', opts.onRescan);
    footer.append(rescan);
  }
  if (account?.kind === 'signed-out') footer.append(link(CONNECT_URL, t('signInLink')));
  else if (!account || !account.pro) footer.append(link(PRICING_URL, t('proLink')));

  main.setAttribute('data-region', 'main');
  const parts: (HTMLElement | string)[] = [header];
  if (account?.kind === 'account') parts.push(h('p', { class: 'account', 'data-testid': 'account' }, account.email, account.pro ? ' · Pro' : ' · Free'));
  parts.push(proStatus(opts.pro));
  if (search) parts.push(search);
  root.replaceChildren(...parts, main, footer);
  if (refocus) search?.focus();
}
