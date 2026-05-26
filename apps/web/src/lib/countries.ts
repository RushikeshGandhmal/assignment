// Browser/Node-native ISO-3166 country code -> display name. Falls back to the
// code itself if the runtime can't resolve it.
const REGION_NAMES =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function formatCountry(code: string): string {
  if (!code) return '';
  try {
    return REGION_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
}
