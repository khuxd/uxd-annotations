/** Stored value '0' leaves a note out of the summary table; anything else, including nothing, keeps it in.
 *  Notes made before this setting existed therefore stay in the table. */
export function parseInTable(stored: string): boolean {
  return stored !== '0';
}
