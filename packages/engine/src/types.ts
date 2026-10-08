export type DomResult = {
  exists: true;
  text?: string;
  attributes?: Record<string, string>;
  properties?: Record<string, string>;
};

/** Everything observed about a page. Field names mirror the Wappalyzer fingerprint keys. */
export type Signals = {
  url: string;
  html?: string;
  text?: string;
  /** Keys lowercase. */
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  /** Keys lowercase (meta name or property). */
  meta?: Record<string, string[]>;
  scriptSrc?: string[];
  /** Inline script contents. */
  scripts?: string[];
  /** Only chains that exist → String(value). */
  js?: Record<string, string>;
  /** Selector → result, only for matching selectors. */
  dom?: Record<string, DomResult>;
  /** Record type ('MX', 'TXT', 'NS', …) → values. */
  dns?: Record<string, string[]>;
  certIssuer?: string;
};

export type EvidenceSource =
  | 'url' | 'html' | 'text' | 'header' | 'cookie' | 'meta' | 'scriptSrc'
  | 'script' | 'js' | 'dom' | 'dns' | 'cert' | 'implies';

export type Evidence = { source: EvidenceSource; key?: string; match: string };

export type Category = { id: number; name: string; priority: number };

export type Detection = {
  tech: string;
  icon?: string;
  website?: string;
  categories: Category[];
  version?: string;
  confidence: number;
  evidence: Evidence[];
};

export type Pattern = { regex: RegExp; version?: string; confidence: number; raw: string };

export type DomRule = {
  selector: string;
  exists?: true;
  text?: Pattern[];
  attributes?: Record<string, Pattern[]>;
  properties?: Record<string, Pattern[]>;
};

export type Implied = { name: string; confidence: number; version?: string };

export type CompiledTech = {
  name: string;
  cats: number[];
  icon?: string;
  website?: string;
  url: Pattern[];
  html: Pattern[];
  text: Pattern[];
  scriptSrc: Pattern[];
  scripts: Pattern[];
  headers: Record<string, Pattern[]>;
  cookies: Record<string, Pattern[]>;
  meta: Record<string, Pattern[]>;
  js: Record<string, Pattern[]>;
  dns: Record<string, Pattern[]>;
  certIssuer: Pattern[];
  dom: DomRule[];
  implies: Implied[];
  requires: string[];
  requiresCategory: number[];
  excludes: string[];
};

export type DomProbe = { selector: string; text: boolean; attributes: string[]; properties: string[] };

export type Probes = { js: string[]; dom: DomProbe[] };
