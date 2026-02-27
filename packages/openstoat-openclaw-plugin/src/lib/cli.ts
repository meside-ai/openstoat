/**
 * CLI runner for OpenStoat commands.
 * Spawns openstoat binary and returns stdout/stderr.
 */

import { spawnSync } from 'child_process';

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CliConfig {
  cliPath?: string;
  /** When set, use `bun run cliRunPath` instead of cliPath (for dev/monorepo) */
  cliRunPath?: string;
  dbPath?: string;
}

export function runOpenstoat(args: string[], config: CliConfig = {}): CliResult {
  const env = { ...process.env };
  if (config.dbPath) {
    env.OPENSTOAT_DB_PATH = config.dbPath;
  }

  const useBunRun = config.cliRunPath != null;
  const [cmd, cmdArgs] = useBunRun
    ? ['bun', ['run', config.cliRunPath!, ...args]]
    : [config.cliPath ?? 'openstoat', args];

  const result = spawnSync(cmd, cmdArgs, {
    encoding: 'utf-8',
    env,
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  };
}

export function runOpenstoatJson<T>(args: string[], config: CliConfig = {}): { data?: T; error?: string } {
  const r = runOpenstoat([...args, '--json'], config);
  if (r.exitCode !== 0) {
    return { error: r.stderr || r.stdout || `Exit code ${r.exitCode}` };
  }
  try {
    return { data: JSON.parse(r.stdout) as T };
  } catch {
    return { error: `Invalid JSON: ${r.stdout}` };
  }
}
