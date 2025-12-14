import type { MajorsMeta } from "../types";

export type MajorOption = {
  code: string;
  label: string;
  level: "two" | "four" | "six";
};

const codeRegex = /^\d{2}(?:\.\d{2})?(?:\.\d{2})?$/;

export const cleanMajorLabel = (raw: unknown): string => {
  if (raw == null) return "";
  let value = String(raw).trim();
  if (!value) return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  } else {
    if (value.startsWith('"') || value.startsWith("'")) {
      value = value.slice(1).trim();
    }
    if (value.endsWith('"') || value.endsWith("'")) {
      value = value.slice(0, -1).trim();
    }
  }
  return value.replace(/\s{2,}/g, " ");
};

export const formatMajorSelection = (code: string, label: string): string => {
  const cleanCode = (code || "").trim();
  const cleanLabelValue = cleanMajorLabel(label);
  if (cleanCode && cleanLabelValue) {
    return `${cleanCode}|${cleanLabelValue}`;
  }
  return cleanLabelValue || cleanCode;
};

export const parseMajorSelection = (
  value: string | null | undefined
): { code: string | null; label: string } => {
  if (!value) return { code: null, label: "" };
  const trimmed = String(value).trim();
  if (!trimmed) return { code: null, label: "" };
  const pipeIdx = trimmed.indexOf("|");
  if (pipeIdx === -1) {
    return {
      code: codeRegex.test(trimmed) ? trimmed : null,
      label: pipeIdx === -1 ? trimmed : trimmed.slice(pipeIdx + 1),
    };
  }
  const code = trimmed.slice(0, pipeIdx).trim();
  const label = trimmed.slice(pipeIdx + 1).trim();
  return { code: code || null, label };
};

export const extractMajorCode = (
  value: string | null | undefined
): string | null => {
  const { code } = parseMajorSelection(value);
  return code && codeRegex.test(code) ? code : null;
};

export const extractMajorLabel = (
  value: string | null | undefined
): string => {
  const { label, code } = parseMajorSelection(value);
  if (label) return label;
  return code ?? "";
};

export const normalizeMajorSelectionList = (
  list: unknown
): string[] | undefined => {
  if (!Array.isArray(list)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const parsed = parseMajorSelection(trimmed);
    const key = parsed.code ? parsed.code : parsed.label.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (parsed.code && parsed.label) {
      result.push(formatMajorSelection(parsed.code, parsed.label));
    } else {
      result.push(parsed.label || parsed.code || "");
    }
    if (result.length >= 3) break;
  }
  return result.length ? result : undefined;
};

export const buildMajorAreaOptions = (meta: MajorsMeta | null): MajorOption[] => {
  if (!meta || !meta.two_digit) return [];
  const entries = Object.entries(meta.two_digit);
  return entries
    .map(([code, raw]) => {
      const label = cleanMajorLabel(raw);
      const normalizedCode = code.trim();
      if (!label || /^\d+$/.test(label) || !normalizedCode) return null;
      return { code: normalizedCode, label, level: "two" as const };
    })
    .filter((opt): opt is MajorOption => !!opt)
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const buildSpecificMajorOptions = (
  meta: MajorsMeta | null
): MajorOption[] => {
  if (!meta) return [];
  const fourEntries = Object.entries(meta.four_digit || {});
  const sixEntries = Object.entries(meta.six_digit || {});
  const allEntries: Array<{ code: string; label: string; level: MajorOption["level"] }> = [
    ...sixEntries.map(([code, raw]) => ({
      code: code.trim(),
      label: cleanMajorLabel(raw),
      level: "six" as const,
    })),
    ...fourEntries.map(([code, raw]) => ({
      code: code.trim(),
      label: cleanMajorLabel(raw),
      level: "four" as const,
    })),
  ];

  const seen = new Set<string>();
  const deduped: MajorOption[] = [];
  for (const entry of allEntries) {
    if (!entry.label || /^\d+$/.test(entry.label) || !entry.code) continue;
    const key = entry.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  deduped.sort((a, b) => {
    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) return labelCompare;
    return a.code.localeCompare(b.code);
  });

  return deduped;
};

export const getTwoDigitPrefix = (
  value: string | null | undefined
): string | null => {
  const code = extractMajorCode(value);
  if (!code) return null;
  const prefix = code.slice(0, 2);
  return /^\d{2}$/.test(prefix) ? prefix : null;
};
