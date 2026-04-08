$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $scriptDir 'ralph-codex.mjs'
$nodeBin = if ($env:RALPH_NODE_BIN) { $env:RALPH_NODE_BIN } else { 'node' }

& $nodeBin $runnerPath @args
exit $LASTEXITCODE
