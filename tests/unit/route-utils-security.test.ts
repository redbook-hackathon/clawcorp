import { describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { HOST_API_SESSION_HEADER, isAuthorizedHostApiRequest, applyCorsOrigin } from '@electron/api/route-utils';

function mockRes(): ServerResponse & { _headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    _headers: headers,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    getHeader(name: string) { return headers[name.toLowerCase()]; },
  } as unknown as ServerResponse & { _headers: Record<string, string> };
}

function mockReq(origin?: string): IncomingMessage {
  return { headers: origin ? { origin } : {} } as unknown as IncomingMessage;
}

describe('route-utils host api authorization', () => {
  it('rejects requests without the host session header', () => {
    expect(isAuthorizedHostApiRequest({ headers: {} } as IncomingMessage, 'session-token')).toBe(false);
  });

  it('rejects requests with the wrong host session header', () => {
    expect(
      isAuthorizedHostApiRequest(
        {
          headers: {
            [HOST_API_SESSION_HEADER]: 'wrong-token',
          },
        } as unknown as IncomingMessage,
        'session-token',
      ),
    ).toBe(false);
  });

  it('accepts requests with the matching host session header', () => {
    expect(
      isAuthorizedHostApiRequest(
        {
          headers: {
            [HOST_API_SESSION_HEADER]: 'session-token',
          },
        } as unknown as IncomingMessage,
        'session-token',
      ),
    ).toBe(true);
  });
});

describe('route-utils CORS origin restriction', () => {
  it('sets Access-Control-Allow-Origin for trusted Electron origin', () => {
    const res = mockRes();
    applyCorsOrigin(mockReq('app://.'), res);
    expect(res._headers['access-control-allow-origin']).toBe('app://.');
  });

  it('sets Access-Control-Allow-Origin for null origin (file://)', () => {
    const res = mockRes();
    applyCorsOrigin(mockReq('null'), res);
    expect(res._headers['access-control-allow-origin']).toBe('null');
  });

  it('does NOT set Access-Control-Allow-Origin for untrusted origins', () => {
    const res = mockRes();
    applyCorsOrigin(mockReq('https://evil.example.com'), res);
    expect(res._headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does NOT set Access-Control-Allow-Origin when no origin header is present', () => {
    const res = mockRes();
    applyCorsOrigin(mockReq(), res);
    expect(res._headers['access-control-allow-origin']).toBeUndefined();
  });
});
