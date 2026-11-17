/** One key for account lookup and lockout. Trim, then lowercase. */
export function canonicalUsername(username: string): string {
  return username.trim().toLowerCase();
}
