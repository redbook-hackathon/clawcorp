/**
 * Shared error response helper for API routes.
 * Returns a consistent JSON shape: { error: string }
 * so clients can distinguish "no data" from "server error".
 */
export function apiErrorResponse(
  err: unknown,
  fallbackMessage = 'Internal server error',
  status = 500
): Response {
  const message = err instanceof Error ? err.message : fallbackMessage
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
