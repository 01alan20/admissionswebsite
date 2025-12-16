import type { MajorsMeta } from "../types";

export type MajorLevel = "two" | "four" | "six";

export type MajorCandidate = {
  code: string;
  label: string;
  level: MajorLevel;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string): string[] => {
  const normalized = normalize(value);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 2);
};

const unique = (items: string[]) => Array.from(new Set(items));

export type MajorsIndex = {
  byCode: Map<string, MajorCandidate>;
  tokenToCodes: Map<string, string[]>;
  all: MajorCandidate[];
};

export const buildMajorsIndex = (meta: MajorsMeta): MajorsIndex => {
  const all: MajorCandidate[] = [];
  const byCode = new Map<string, MajorCandidate>();

  const pushEntries = (entries: Record<string, string>, level: MajorLevel) => {
    for (const [code, raw] of Object.entries(entries || {})) {
      const label = String(raw ?? "").trim();
      const cleanCode = String(code ?? "").trim();
      if (!label || !cleanCode) continue;
      const candidate: MajorCandidate = { code: cleanCode, label, level };
      all.push(candidate);
      byCode.set(cleanCode, candidate);
    }
  };

  pushEntries(meta.two_digit || {}, "two");
  pushEntries(meta.four_digit || {}, "four");
  pushEntries(meta.six_digit || {}, "six");

  const tokenToCodes = new Map<string, string[]>();
  for (const cand of all) {
    const tokens = unique(tokenize(cand.label));
    for (const token of tokens) {
      const list = tokenToCodes.get(token) ?? [];
      list.push(cand.code);
      tokenToCodes.set(token, list);
    }
  }

  return { byCode, tokenToCodes, all };
};

const levelBoost: Record<MajorLevel, number> = {
  two: 0.0,
  four: 0.08,
  six: 0.15,
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
};

const COMMON_SYNONYM_CODES: Array<{ match: RegExp; code: string }> = [
  { match: /\bpsycholog(y|ist)\b/i, code: "42" },
  { match: /\bcomputer science\b|\bcomputer scientist\b|\bcs\b/i, code: "11" },
  { match: /\bengineering\b|\bengineer\b/i, code: "14" },
  { match: /\beconomics?\b|\beconomist\b/i, code: "45.06" },
  { match: /\bpolitical science\b|\bpolitical scientist\b/i, code: "45.10" },
  { match: /\bbiology\b|\bbiolog(ical|ist)\b/i, code: "26" },
  { match: /\bchemistry\b|\bchemist\b/i, code: "40.05" },
  { match: /\bphysics\b|\bphysicist\b/i, code: "40.08" },
  { match: /\bmathematics?\b|\bmath\b|\bmathematician\b/i, code: "27" },
  { match: /\bpublic health\b/i, code: "51.22" },
  { match: /\bneuroscience\b/i, code: "26.15" },
  { match: /\bbusiness\b|\bentrepreneur\b/i, code: "52" },
  { match: /\benglish\b|\bwriter\b/i, code: "23" },
  { match: /\bhistory\b|\bhistorian\b/i, code: "54" },
  { match: /\bart\b|\bartist\b|\bmusic\b|\bmusician\b/i, code: "50" },
  { match: /\blinguistics?\b|\blinguist\b/i, code: "16.01" },
  { match: /\benvironment\b|\benvironmentalist\b/i, code: "03" },
];

export const bestMatchMajor = (
  query: string,
  index: MajorsIndex,
  options?: { preferLevels?: MajorLevel[]; minScore?: number }
): MajorCandidate | null => {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return null;

  const preferLevels = options?.preferLevels ?? ["six", "four", "two"];
  const minScore = options?.minScore ?? 0.22;

  const normalizedQuery = normalize(trimmed);

  for (const rule of COMMON_SYNONYM_CODES) {
    if (rule.match.test(trimmed)) {
      const exact = index.byCode.get(rule.code);
      if (exact) return exact;
      const asTwo = index.byCode.get(rule.code.slice(0, 2));
      if (asTwo) return asTwo;
    }
  }

  // Try exact label match first.
  const exactLabel = index.all.find(
    (c) => normalize(c.label) === normalizedQuery
  );
  if (exactLabel) return exactLabel;

  const queryTokens = unique(tokenize(trimmed));
  const querySet = new Set(queryTokens);
  if (!querySet.size) return null;

  const candidateCodes = new Set<string>();
  for (const token of queryTokens) {
    const codes = index.tokenToCodes.get(token);
    if (!codes) continue;
    for (const code of codes) candidateCodes.add(code);
  }
  if (!candidateCodes.size) return null;

  const allowedLevels = new Set(preferLevels);
  let best: { cand: MajorCandidate; score: number } | null = null;

  for (const code of candidateCodes) {
    const cand = index.byCode.get(code);
    if (!cand) continue;
    if (!allowedLevels.has(cand.level)) continue;
    const candSet = new Set(unique(tokenize(cand.label)));
    const score = jaccard(querySet, candSet) + levelBoost[cand.level];
    if (!best || score > best.score) {
      best = { cand, score };
    }
  }

  if (!best || best.score < minScore) return null;
  return best.cand;
};

export const mapApplicationMajorFamily = (
  assignedCategory: string | null | undefined,
  majorsMeta: MajorsMeta,
  index: MajorsIndex
): MajorCandidate | null => {
  const raw = (assignedCategory ?? "").trim();
  if (!raw) return null;

  // Map the known 24 buckets to a 2-digit family when possible.
  const bucketToTwoDigit: Record<string, string> = {
    "Computer Scientist": "11",
    Engineer: "14",
    "Political Scientist": "45",
    Economist: "45",
    Biologist: "26",
    "Health Sciences": "51",
    Entrepreneur: "52",
    Mathematician: "27",
    Writer: "23",
    Physicist: "40",
    Environmentalist: "03",
    Chemist: "40",
    "Social Advocate": "44",
    "Student Leader": "24",
    Psychologist: "42",
    Artist: "50",
    Musician: "50",
    Linguist: "16",
    Historian: "54",
    "Community Service": "44",
  };

  const mapped = bucketToTwoDigit[raw];
  if (mapped) {
    const label = (majorsMeta.two_digit || {})[mapped] ?? null;
    return label ? { code: mapped, label, level: "two" } : index.byCode.get(mapped) ?? null;
  }

  // Fallback: try matching into the 2-digit list.
  return bestMatchMajor(raw, index, { preferLevels: ["two"], minScore: 0.18 });
};

export const mapApplicationIntendedMajor = (
  intended: string | null | undefined,
  index: MajorsIndex
): MajorCandidate | null => {
  const raw = (intended ?? "").trim();
  if (!raw) return null;

  const parts = raw
    .split(/[,/;|]+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const candidates = parts.length ? parts : [raw];
  let best: MajorCandidate | null = null;
  for (const part of candidates) {
    const match = bestMatchMajor(part, index, { preferLevels: ["six", "four", "two"] });
    if (!match) continue;
    if (!best) {
      best = match;
      continue;
    }
    // Prefer more specific matches.
    const rank = { two: 0, four: 1, six: 2 } as const;
    if (rank[match.level] > rank[best.level]) best = match;
  }
  return best;
};

