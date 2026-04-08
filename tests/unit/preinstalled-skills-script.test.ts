import { describe, expect, it } from 'vitest';

import { getSparseCheckoutGitCommands } from '../../scripts/bundle-preinstalled-skills.mjs';

describe('bundle preinstalled skills script', () => {
  it('expands sparse checkout into direct git commands', () => {
    const commands = getSparseCheckoutGitCommands({
      repo: 'anthropics/skills',
      ref: 'main',
      paths: ['skills/a', 'skills/b'],
      checkoutDir: 'C:\\tmp\\repo',
    });

    expect(commands).toEqual([
      ['git', ['init', 'C:\\tmp\\repo']],
      ['git', ['-C', 'C:\\tmp\\repo', 'remote', 'add', 'origin', 'https://github.com/anthropics/skills.git']],
      ['git', ['-C', 'C:\\tmp\\repo', 'sparse-checkout', 'init', '--cone']],
      ['git', ['-C', 'C:\\tmp\\repo', 'sparse-checkout', 'set', 'skills/a', 'skills/b']],
      ['git', ['-C', 'C:\\tmp\\repo', 'fetch', '--depth', '1', 'origin', 'main']],
      ['git', ['-C', 'C:\\tmp\\repo', 'checkout', 'FETCH_HEAD']],
      ['git', ['-C', 'C:\\tmp\\repo', 'rev-parse', 'HEAD']],
    ]);
  });
});
