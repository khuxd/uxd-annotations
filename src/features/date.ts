/** DD/MM/YYYY, built by hand: Figma's plugin sandbox may ignore locales passed to toLocaleDateString. */
export function formatDate(date: Date): string {
  const pad = (n: number): string => (n < 10 ? '0' : '') + n;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
