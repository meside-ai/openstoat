/**
 * Install OpenStoat skills to .agent/skills and .claude/skills in the target directory.
 * Used by `openstoat install skill` and when daemon starts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const SKILL_NAMES = ['openstoat-planner', 'openstoat-worker'];
const TARGET_DIRS_DEFAULT = ['.agent/skills', '.claude/skills'];
const TARGET_DIRS_HERE = ['skills'];

/**
 * Get the path to the openstoat-skills package skills directory.
 */
function getSkillsSourcePath(): string {
  try {
    // Resolve from openstoat-cli's node_modules (workspace or hoisted)
    const pkgPath = require.resolve('openstoat-skills/package.json', {
      paths: [path.dirname(fileURLToPath(import.meta.url))],
    });
    return path.join(path.dirname(pkgPath), 'skills');
  } catch {
    // Fallback: relative to this file (e.g. in monorepo packages/openstoat-cli)
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return path.join(dir, '../../openstoat-skills/skills');
  }
}

/**
 * Copy a skill directory recursively.
 */
function copySkill(source: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(source, dest, { recursive: true });
}

export interface InstallSkillsOptions {
  /** When true, install to ./skills only (no .agent or .claude parent dirs) */
  here?: boolean;
}

/**
 * Install OpenStoat skills to .agent/skills and .claude/skills, or ./skills when here=true.
 * @param targetRoot - Root directory (default: process.cwd())
 * @param options - { here: true } to install to ./skills in current directory
 * @returns Paths where skills were installed
 */
export function installSkills(
  targetRoot = process.cwd(),
  options?: InstallSkillsOptions
): string[] {
  const sourcePath = getSkillsSourcePath();
  const installed: string[] = [];
  const targetDirs = options?.here ? TARGET_DIRS_HERE : TARGET_DIRS_DEFAULT;

  for (const skillName of SKILL_NAMES) {
    const skillSource = path.join(sourcePath, skillName);
    if (!fs.existsSync(skillSource)) {
      console.warn(`Skill not found: ${skillName} at ${skillSource}`);
      continue;
    }

    for (const targetDir of targetDirs) {
      const dest = path.join(targetRoot, targetDir, skillName);
      copySkill(skillSource, dest);
      installed.push(dest);
    }
  }

  return installed;
}
