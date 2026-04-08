/**
 * before-pack.cjs
 *
 * electron-builder runs an internal node_modules collector during app file
 * copying unless it believes dependencies are handled externally.
 *
 * In this project the packaged runtime does not need workspace root
 * node_modules:
 * - renderer/main output is bundled by Vite into dist/ and dist-electron/
 * - OpenClaw and channel plugins are copied separately via build/* resources
 *   and afterPack
 *
 * On Windows CI, traversing the pnpm workspace node_modules tree can fall back
 * to npm-style inspection and explode memory usage. Mark dependencies as
 * externally handled so electron-builder skips that collection step.
 */

exports.default = async function beforePack(context) {
  const info = context?.packager?.info;
  if (!info) {
    return;
  }

  info._nodeModulesHandledExternally = true;
  console.log('[before-pack] Marked node_modules as externally handled; skipping electron-builder dependency collection');
};
