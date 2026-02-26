/**
 * Project-local config from .openstoat.json in current directory.
 * Daemon reads agent path from here. Skills use project ID for task commands.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface OpenstoatConfig {
  /** Project ID. Use as --project in task commands. */
  project?: string;
  /** Path to external agent executable. Daemon invokes this for ready agent_worker tasks. */
  agent?: string;
}

const CONFIG_FILENAME = '.openstoat.json';

/**
 * Load .openstoat.json from the given directory (default: process.cwd()).
 * Returns null if file does not exist or is invalid.
 */
export function loadProjectConfig(cwd?: string): OpenstoatConfig | null {
  const dir = cwd ?? process.cwd();
  const path = join(dir, CONFIG_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const project = typeof parsed.project === 'string' ? parsed.project : undefined;
    const agent = typeof parsed.agent === 'string' ? parsed.agent : undefined;
    return { project, agent };
  } catch {
    return null;
  }
}

/**
 * Write .openstoat.json to the given directory (default: process.cwd()).
 */
export function saveProjectConfig(config: OpenstoatConfig, cwd?: string): void {
  const dir = cwd ?? process.cwd();
  const path = join(dir, CONFIG_FILENAME);
  const content = JSON.stringify(config, null, 2) + '\n';
  writeFileSync(path, content, 'utf-8');
}
