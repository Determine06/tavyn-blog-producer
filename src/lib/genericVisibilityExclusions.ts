import { readFile } from "node:fs/promises";

const REGISTRY_URL = new URL(
  "../generic-visibility-exclusions.json",
  import.meta.url,
);

export type GenericVisibilityExclusions = {
  registrableDomains: ReadonlySet<string>;
  exactHosts: ReadonlySet<string>;
  allowlist: ReadonlySet<string>;
};

let cachedRegistry: GenericVisibilityExclusions | undefined;

export async function loadGenericVisibilityExclusions(): Promise<GenericVisibilityExclusions> {
  if (cachedRegistry !== undefined) {
    return cachedRegistry;
  }

  let value: unknown;

  try {
    value = JSON.parse(await readFile(REGISTRY_URL, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Could not load generic visibility exclusions from ${REGISTRY_URL.pathname}.`,
      { cause: error },
    );
  }

  cachedRegistry = parseGenericVisibilityExclusions(value);
  return cachedRegistry;
}

export function parseGenericVisibilityExclusions(
  value: unknown,
): GenericVisibilityExclusions {
  const root = requireRecord(value, "generic visibility exclusions root");
  const exclusions = requireRecord(
    root.exclusions,
    "generic visibility exclusions.exclusions",
  );

  return {
    registrableDomains: flattenCategorizedDomains(
      exclusions.registrable_domains,
      "exclusions.registrable_domains",
    ),
    exactHosts: flattenCategorizedDomains(
      exclusions.exact_hosts,
      "exclusions.exact_hosts",
    ),
    allowlist: parseDomainArray(root.allowlist, "allowlist"),
  };
}

export function normalizeCandidateHostname(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const input = value.trim();

  try {
    const parsed = new URL(
      /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(input)
        ? input
        : `http://${input}`,
    );
    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");

    return hostname.length > 0 ? hostname : null;
  } catch {
    return null;
  }
}

export function hostnameMatchesDomain(
  hostname: string,
  domain: string,
): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isGenericVisibilityExcluded(
  hostname: string,
  exclusions: GenericVisibilityExclusions,
): boolean {
  for (const domain of exclusions.allowlist) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return false;
    }
  }

  if (exclusions.exactHosts.has(hostname)) {
    return true;
  }

  for (const domain of exclusions.registrableDomains) {
    if (hostnameMatchesDomain(hostname, domain)) {
      return true;
    }
  }

  return false;
}

function flattenCategorizedDomains(
  value: unknown,
  label: string,
): ReadonlySet<string> {
  const categories = requireRecord(value, label);
  const domains = new Set<string>();

  for (const [category, entries] of Object.entries(categories)) {
    const categoryDomains = parseDomainArray(entries, `${label}.${category}`);

    for (const domain of categoryDomains) {
      if (domains.has(domain)) {
        throw new Error(`${label} contains duplicate active entry ${domain}.`);
      }

      domains.add(domain);
    }
  }

  return domains;
}

function parseDomainArray(value: unknown, label: string): ReadonlySet<string> {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array.`);
  }

  const domains = new Set<string>();

  for (const [index, entry] of value.entries()) {
    const domain = normalizeCandidateHostname(entry);

    if (domain === null) {
      throw new Error(`Expected ${label}[${index}] to be a valid hostname.`);
    }

    if (domains.has(domain)) {
      throw new Error(`${label} contains duplicate active entry ${domain}.`);
    }

    domains.add(domain);
  }

  return domains;
}

function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }

  return value as Record<string, unknown>;
}
