#!/usr/bin/env node
/**
 * Bundle openstoat-cli with esbuild. Bundles openstoat-core, openstoat-daemon,
 * openstoat-types, openstoat-web into a single output. Skills are copied separately.
 */
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');

async function build() {
  const outDir = path.join(__dirname, 'dist');
  fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outdir: outDir,
    outbase: path.join(__dirname, 'src'),
    splitting: true,
    mainFields: ['module', 'main'],
    conditions: ['import', 'module', 'default'],
    sourcemap: true,
    minify: false,
    external: ['bun:sqlite'],
  });

  const skillsSrc = path.join(root, 'packages', 'openstoat-skills', 'skills');
  const skillsDest = path.join(__dirname, 'skills');
  if (fs.existsSync(skillsSrc)) {
    fs.cpSync(skillsSrc, skillsDest, { recursive: true });
    console.log('Copied skills to package/skills');
  }

  console.log('Build complete: dist/');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
