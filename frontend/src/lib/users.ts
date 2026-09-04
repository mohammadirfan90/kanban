// Users API — small surface, just the email lookup the share flow needs.

import { request } from './api';

export interface UserLookupResult {
  id: string;
  email: string;
  name: string;
}

/**
 * Resolve a user by email. Returns 404 (as `ApiClientError` with status 404)
 * when no user matches — the share dialog uses this to surface a "User not
 * found" error.
 */
export async function lookupUserByEmail(email: string): Promise<UserLookupResult> {
  return request<UserLookupResult>(`/users/lookup?email=${encodeURIComponent(email)}`);
}
