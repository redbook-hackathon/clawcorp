/**
 * Use Electron's network stack when available so requests honor
 * session.defaultSession.setProxy(...). Fall back to the Node global fetch
 * for non-Electron test environments.
 */

export async function proxyAwareFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const inputUrl = typeof input === 'string' ? input : input.toString();

  if (process.versions.electron) {
    try {
      const { net } = await import('electron');
      return await net.fetch(inputUrl, init);
    } catch {
      // Fall through to the global fetch.
    }
  }

  return await fetch(input, init);
}
