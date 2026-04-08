import { describe, expect, it } from 'vitest';

import { getExtractionCommand } from '../../scripts/download-bundled-uv.mjs';

describe('download bundled uv script', () => {
  it('uses direct tar extraction for linux archives on Windows hosts', () => {
    const result = getExtractionCommand({
      archivePath: 'C:\\tmp\\uv-linux.tar.gz',
      filename: 'uv-x86_64-unknown-linux-gnu.tar.gz',
      tempDir: 'C:\\tmp\\extract',
      hostPlatform: 'win32',
    });

    expect(result).toEqual({
      command: 'tar',
      args: ['-xzf', 'C:\\tmp\\uv-linux.tar.gz', '-C', 'C:\\tmp\\extract'],
    });
  });
});
