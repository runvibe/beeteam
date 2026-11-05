/** Existing transport tests target a v1 installation without discovery. */
export const legacyFetch =
  (fetcher: typeof fetch): typeof fetch =>
  (url, init) =>
    String(url).endsWith("/info")
      ? Promise.resolve(new Response("{}", { status: 404 }))
      : fetcher(url, init);
