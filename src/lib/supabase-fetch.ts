/**
 * fetch for the Supabase clients: a REST or auth call that hasn't answered in
 * `ms` aborts, so a busy db fails a request fast instead of holding it for
 * minutes (2026-10-18: requests queued 30-300s and the whole site hung).
 * Postgres already stops a statement at 8s (authenticator's statement_timeout),
 * so nothing legitimate runs past these limits; storage and realtime calls
 * (uploads can be slow) pass through untouched.
 */
export function timedFetch(ms: number): typeof fetch {
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!/\/(rest|auth)\/v1\//.test(url)) return fetch(input, init);
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}
