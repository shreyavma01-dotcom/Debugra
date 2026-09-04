#!/usr/bin/env node
// Demo helper: ensures sample ZIP without node_modules exists and prints instructions
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const sampleDir = path.join(root, 'sample-projects', 'task-manager');
const zipPath = path.join(root, 'sample-projects', 'task-manager.zip');

console.log('=== Debugra Demo Preparation ===');

// Check sample dir
if (!fs.existsSync(sampleDir)) {
  console.error('Sample project not found at', sampleDir);
  process.exit(1);
}

// Recreate ZIP without node_modules using PowerShell/.NET if on Windows
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  console.log('Creating sample ZIP without node_modules...');

  // Use Node archiver if available, else fallback to powershell
  let created = false;
  try {
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(output);
    archive.directory(sampleDir, false, (entry) => {
      if (entry.name.includes('node_modules') || entry.name.includes('.git')) return false;
      return entry;
    });
    archive.finalize();
    // Wait a bit for finalize
    // This is async but for demo we use sync powershell fallback
    created = false; // force fallback for simplicity
  } catch {}

  if (!created) {
    // Use PowerShell .NET method
    const ps = `Add-Type -Assembly System.IO.Compression; Add-Type -Assembly System.IO.Compression.FileSystem; $src="${sampleDir.replace(/\\/g, '\\\\')}"; $dst="${zipPath.replace(/\\/g, '\\\\')}"; $zip=[System.IO.Compression.ZipFile]::Open($dst, [System.IO.Compression.ZipArchiveMode]::Create); Get-ChildItem -Path $src -Recurse -File | Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\\.git*" } | ForEach-Object { $rel=$_.FullName.Substring($src.Length+1); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null }; $zip.Dispose(); Write-Host "ZIP created"`;
    execSync(`powershell -Command "${ps}"`, { stdio: 'inherit' });
  }

  const stat = fs.statSync(zipPath);
  console.log(`ZIP ready: ${zipPath} (${Math.round(stat.size/1024)}KB)`);
} catch (e) {
  console.error('Failed to create ZIP:', e.message);
}

console.log(`
Demo steps:
1. Ensure server is running: node server/dist/server.js (or npm run dev)
   Health: http://localhost:4000/api/health
2. Open http://localhost:4000 (production) or http://localhost:5173 (vite dev)
3. Click New Run -> Upload ${zipPath} -> Project name: task-manager -> Goal: "Fix the authentication issue and make all authentication tests pass." -> Start
4. Watch timeline: baseline 5/12 -> first patch (secret) -> still failing -> replan -> second patch (header) -> 12/12 -> VERIFIED
5. View Diff and Download Patched ZIP

API alternative:
  curl -F "file=@sample-projects/task-manager.zip" http://localhost:4000/api/projects/upload
  curl -X POST http://localhost:4000/api/agent/runs -H "Content-Type: application/json" -d '{"projectId":"...","goal":"Fix authentication..."}'
  curl http://localhost:4000/api/agent/runs/<runId>/events

Current server status:
`);
try {
  const http = require('http');
  http.get('http://localhost:4000/api/health', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log(data));
  }).on('error', () => console.log('Server not running on :4000 — start it first.'));
} catch {}
