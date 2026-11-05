/** Stored value '0' hides the avatar; anything else, including nothing, shows it. Files made before this
 *  setting existed therefore keep their avatars. */
export function parseShowAvatar(stored: string): boolean {
  return stored !== '0';
}
