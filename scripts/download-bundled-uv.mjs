#!/usr/bin/env zx

import 'zx/globals';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(__dirname, '..');
const UV_VERSION = '0.10.0';
const BASE_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;
const OUTPUT_BASE = path.join(ROOT_DIR, 'resources', 'bin');

const TARGETS = {
  'darwin-arm64': {
    filename: 'uv-aarch64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'darwin-x64': {
    filename: 'uv-x86_64-apple-darwin.tar.gz',
    binName: 'uv',
  },
  'win32-arm64': {
    filename: 'uv-aarch64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'win32-x64': {
    filename: 'uv-x86_64-pc-windows-msvc.zip',
    binName: 'uv.exe',
  },
  'linux-arm64': {
    filename: 'uv-aarch64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  },
  'linux-x64': {
    filename: 'uv-x86_64-unknown-linux-gnu.tar.gz',
    binName: 'uv',
  },
};

const PLATFORM_GROUPS = {
  mac: ['darwin-x64', 'darwin-arm64'],
  win: ['win32-x64', 'win32-arm64'],
  linux: ['linux-x64', 'linux-arm64'],
};

export function getExtractionCommand({
  archivePath,
  filename,
  tempDir,
  hostPlatform = os.platform(),
}) {
  if (filename.endsWith('.zip')) {
    if (hostPlatform === 'win32') {
      const psCommand =
        `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
        `[System.IO.Compression.ZipFile]::ExtractToDirectory('${archivePath.replace(/'/g, "''")}', '${tempDir.replace(/'/g, "''")}', $true)`;

      return {
        command: 'powershell.exe',
        args: ['-NoProfile', '-Command', psCommand],
      };
    }

    return {
      command: 'unzip',
      args: ['-q', '-o', archivePath, '-d', tempDir],
    };
  }

  return {
    command: 'tar',
    args: ['-xzf', archivePath, '-C', tempDir],
  };
}

export function extractArchive({
  archivePath,
  filename,
  tempDir,
  hostPlatform = os.platform(),
}) {
  const { command, args } = getExtractionCommand({
    archivePath,
    filename,
    tempDir,
    hostPlatform,
  });

  execFileSync(command, args, { stdio: 'inherit' });
}

async function setupTarget(id) {
  const target = TARGETS[id];
  if (!target) {
    echo(chalk.yellow(`Target ${id} is not supported by this script.`));
    return;
  }

  const targetDir = path.join(OUTPUT_BASE, id);
  const tempDir = path.join(ROOT_DIR, 'temp_uv_extract');
  const archivePath = path.join(ROOT_DIR, target.filename);
  const downloadUrl = `${BASE_URL}/${target.filename}`;

  echo(chalk.blue(`\nSetting up uv for ${id}...`));

  await fs.remove(targetDir);
  await fs.remove(tempDir);
  await fs.ensureDir(targetDir);
  await fs.ensureDir(tempDir);

  try {
    echo(`Downloading: ${downloadUrl}`);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(archivePath, Buffer.from(buffer));

    echo('Extracting...');
    extractArchive({
      archivePath,
      filename: target.filename,
      tempDir,
      hostPlatform: os.platform(),
    });

    const folderName = target.filename.replace('.tar.gz', '').replace('.zip', '');
    const sourceBin = path.join(tempDir, folderName, target.binName);
    const destBin = path.join(targetDir, target.binName);

    if (await fs.pathExists(sourceBin)) {
      await fs.move(sourceBin, destBin, { overwrite: true });
    } else {
      echo(chalk.yellow('Binary not found in expected subfolder, searching...'));
      const files = await glob(`**/${target.binName}`, { cwd: tempDir, absolute: true });
      if (files.length > 0) {
        await fs.move(files[0], destBin, { overwrite: true });
      } else {
        throw new Error(`Could not find ${target.binName} in extracted files.`);
      }
    }

    if (os.platform() !== 'win32') {
      await fs.chmod(destBin, 0o755);
    }

    echo(chalk.green(`Success: ${destBin}`));
  } finally {
    await fs.remove(archivePath);
    await fs.remove(tempDir);
  }
}

export async function main() {
  const downloadAll = argv.all;
  const platform = argv.platform;

  if (downloadAll) {
    echo(chalk.cyan('Downloading uv binaries for ALL supported platforms...'));
    for (const id of Object.keys(TARGETS)) {
      await setupTarget(id);
    }
  } else if (platform) {
    const targets = PLATFORM_GROUPS[platform];
    if (!targets) {
      echo(chalk.red(`Unknown platform: ${platform}`));
      echo(`Available platforms: ${Object.keys(PLATFORM_GROUPS).join(', ')}`);
      process.exit(1);
    }

    echo(chalk.cyan(`Downloading uv binaries for platform: ${platform}`));
    echo(`Architectures: ${targets.join(', ')}`);
    for (const id of targets) {
      await setupTarget(id);
    }
  } else {
    const currentId = `${os.platform()}-${os.arch()}`;
    echo(chalk.cyan(`Detected system: ${currentId}`));

    if (TARGETS[currentId]) {
      await setupTarget(currentId);
    } else {
      echo(chalk.red(`Current system ${currentId} is not in the supported download list.`));
      echo(`Supported targets: ${Object.keys(TARGETS).join(', ')}`);
      echo('\nTip: Use --platform=<platform> to download for a specific platform');
      echo('     Use --all to download for all platforms');
      process.exit(1);
    }
  }

  echo(chalk.green('\nDone!'));
}

const scriptPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentModulePath = fileURLToPath(import.meta.url);

if (scriptPath === currentModulePath) {
  await main();
}
