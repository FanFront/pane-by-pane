#!/usr/bin/env node
/**
 * Convert a locally cloned Betaller repository to a PRIVATE pane-by-pane JSON pack.
 * Does not download, vendor, or republish original game data.
 * Node >=22.18 supports importing our TypeScript converter and validator.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fromBetallerJSON } from '../src/importBetaller.ts';
import { parsePresetPack } from '../src/presets.ts';

function walk(dir) {
  const result = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) result.push(...walk(path));
    else if (item.isFile() && item.name.endsWith('.json')) result.push(path);
  }
  return result;
}

export function convertBetallerRepository(root, output, opts = {}) {
  const origin = resolve(root);
  const base = join(origin, 'puzzles', 'official');
  if (!statSync(base).isDirectory()) throw new Error('Expected a Betaller repository containing puzzles/official');
  const paths = walk(base).filter((p) => {
    const path = relative(base, p).replaceAll('\\', '/');
    return !path.includes('-answer/') && path !== '_index.json' &&
      (opts.includeSupplementary === true || path.startsWith('Zone'));
  }).sort();
  const levels = [], failures = [];
  for (const path of paths) {
    const rel = relative(base, path).replaceAll('\\', '/');
    const parts = rel.split('/');
    const group = parts[0];
    const answerPath = join(base, `${group}-answer`, ...parts.slice(1));
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      const answer = JSON.parse(readFileSync(answerPath, 'utf8'));
      const level = fromBetallerJSON(raw, answer, rel.slice(0, -5));
      // One invalid original level cannot make every other level unplayable.
      parsePresetPack({ version: 1, name: 'validate', levels: [level] });
      levels.push(level);
    } catch (err) {
      failures.push({ file: rel, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  const pack = parsePresetPack({ version: 1, name: 'Glimmith · 本地学习题库', levels });
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), JSON.stringify(pack, null, 2) + '\n');
  const report = { source: origin, total: paths.length, converted: levels.length, skipped: failures.length, failures };
  writeFileSync(resolve(output) + '.report.json', JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('convert-betaller.mjs')) {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--include-supplementary') args.includeSupplementary = true;
    else if (argv[i] === '--root' || argv[i] === '--output') args[argv[i].slice(2)] = argv[++i];
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!args.root || !args.output) {
    console.error('Usage: node scripts/convert-betaller.mjs --root <local Betaller repo> --output <private JSON pack>');
    process.exitCode = 1;
  } else {
    try {
      const result = convertBetallerRepository(args.root, args.output, args);
      console.log(`Scanned ${result.total}, converted ${result.converted}, skipped ${result.skipped}`);
      console.log(`Detailed report: ${resolve(args.output)}.report.json`);
      for (const item of result.failures.slice(0, 12)) console.log(`SKIP ${item.file}: ${item.reason}`);
      if (!result.converted) process.exitCode = 1;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  }
}
