/** DD/MM/YYYY, built by hand: Figma's plugin sandbox may ignore locales passed to toLocaleDateString. */
export function formatDate(date: Date): string {
  const pad = (n: number): string => (n < 10 ? '0' : '') + n;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Notes made before the DD/MM/YYYY fix carry a date written month-first (the sandbox ignored the locale).
 *  Returns the same date day-first, or null when the text isn't a date to convert: not a date at all, or
 *  already day-first (a first part above 12 can't be a month). When both parts are 12 or less the order
 *  can't be told from the text, so it is taken to be month-first, as every earlier stamp was. */
export function legacyToDayFirst(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const first = Number(m[1]);
  const second = Number(m[2]);
  if (first > 12 || second > 31 || second < 1 || first < 1) return null;
  const pad = (n: number): string => (n < 10 ? '0' : '') + n;
  return `${pad(second)}/${pad(first)}/${m[3]}`;
}
