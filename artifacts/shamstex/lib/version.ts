import Constants from "expo-constants";

export const APP_VERSION: string = (Constants?.expoConfig?.version as string) ?? "1.1.0";

/**
 * Normalizes a version string:
 * - Converts Arabic-Indic and Persian digits to standard ASCII digits.
 * - Trims whitespace.
 * - Strips leading "v" or "V".
 */
export function normalizeVersion(v: unknown): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  let s = String(v).trim();
  s = s
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
  s = s.replace(/^[vV]/, "").trim();
  return s;
}

export function isValidVersion(v: unknown): v is string {
  const norm = normalizeVersion(v);
  if (!norm) return false;
  return /^\d+(\.\d+)*$/.test(norm);
}

export function compareVersions(a: string, b: string): number {
  const na = normalizeVersion(a);
  const nb = normalizeVersion(b);
  if (!isValidVersion(na) || !isValidVersion(nb)) return 0;
  const pa = na.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = nb.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Determines whether a force update is required.
 * - If forceUpdateEnabled is explicitly false, returns false.
 * - If minVersion is not set or invalid, returns false.
 * - Returns true only if currentVersion < minVersion.
 */
export function isUpdateRequired(
  minVersion: string | undefined | null,
  forceUpdateEnabled?: boolean,
  currentVersion: string = APP_VERSION
): boolean {
  if (forceUpdateEnabled === false) return false;
  if (!minVersion || !isValidVersion(minVersion)) return false;
  return compareVersions(currentVersion, minVersion) < 0;
}

/**
 * Determines whether a flexible (optional) update prompt is available.
 * - If flexibleUpdateEnabled is explicitly false, returns false.
 * - If flexibleUpdateEnabled is true:
 *     - If latestVersion is valid and currentVersion < latestVersion -> true.
 *     - If latestVersion is not specified, but flexibleUpdateEnabled is true -> true (prompts all).
 * - If flexibleUpdateEnabled is undefined (legacy Firestore document):
 *     - If latestVersion is valid and currentVersion < latestVersion -> true.
 *     - Otherwise false.
 */
export function isFlexibleUpdateAvailable(
  latestVersion: string | undefined | null,
  flexibleUpdateEnabled?: boolean,
  currentVersion: string = APP_VERSION
): boolean {
  if (flexibleUpdateEnabled === false) return false;

  const hasValidLatest = isValidVersion(latestVersion);

  if (flexibleUpdateEnabled === true) {
    if (hasValidLatest) {
      return compareVersions(currentVersion, latestVersion) < 0;
    }
    return true;
  }

  if (hasValidLatest) {
    return compareVersions(currentVersion, latestVersion) < 0;
  }

  return false;
}
