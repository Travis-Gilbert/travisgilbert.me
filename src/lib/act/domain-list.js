// Next.js port of browser-extension/src/inference/domain-list.js.
// The original file fetched the JSON via chrome.runtime.getURL() (extension
// runtime) or node:fs (test runner). Neither path works in a Next.js
// browser bundle, so this version imports the JSON statically and inits
// eagerly. Public API (loadDomainList / getTier / getParentOrg) is
// preserved so the upstream scoring.js can import it unchanged.

import payload from "./data/domains_v1.json";

const UNKNOWN_ENTRY = {
  domain: "unknown",
  tier: 4,
  parent_organization: "unknown",
  category: "unranked",
  known_issues: [],
  source_citations: ["Default policy for unknown domains"],
};

function coerceHost(value) {
  if (!value) return "";
  const raw = String(value).trim().toLowerCase();
  if (!raw) return "";
  let host = "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    host = (parsed.host || parsed.pathname || "").trim().toLowerCase();
  } catch {
    host = raw;
  }
  if (host.includes(":")) {
    host = host.split(":", 1)[0];
  }
  return host.replace(/^\.+|\.+$/g, "");
}

function candidateDomains(host) {
  const parts = host.split(".");
  if (parts.length < 2) return [host];
  const out = [];
  for (let idx = 0; idx < parts.length - 1; idx += 1) {
    const suffix = parts.slice(idx).join(".");
    if (suffix && !out.includes(suffix)) out.push(suffix);
  }
  return out;
}

function normalizePayload(payload) {
  const rows = Array.isArray(payload?.domains) ? payload.domains : [];
  const out = {};
  for (const row of rows) {
    const domain = String(row?.domain || "").trim().toLowerCase();
    if (!domain) continue;
    out[domain] = {
      domain,
      tier: Number.parseInt(row?.tier ?? 4, 10),
      parent_organization: String(row?.parent_organization || domain).trim().toLowerCase(),
      category: String(row?.category || "unranked"),
      known_issues: Array.isArray(row?.known_issues) ? row.known_issues : [],
      source_citations: Array.isArray(row?.source_citations) ? row.source_citations : [],
    };
  }
  return out;
}

const domainMap = normalizePayload(payload);

export async function loadDomainList() {
  return domainMap;
}

function getEntry(domain) {
  const host = coerceHost(domain);
  if (!host) return UNKNOWN_ENTRY;
  for (const candidate of candidateDomains(host)) {
    if (domainMap[candidate]) return domainMap[candidate];
  }
  return UNKNOWN_ENTRY;
}

export function getTier(domain) {
  return Number(getEntry(domain).tier || 4);
}

export function getParentOrg(domain) {
  const entry = getEntry(domain);
  return entry.parent_organization || entry.domain || "unknown";
}
