export const getBetaAllowlist = (): string[] => {
  const raw = ((import.meta as any).env?.VITE_BETA_EMAIL_ALLOWLIST as string | undefined) ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

export const isBetaUser = (email: string | null | undefined): boolean => {
  const allowlist = getBetaAllowlist();
  if (!allowlist.length) {
    return Boolean((import.meta as any).env?.DEV);
  }
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return allowlist.includes(normalized);
};

