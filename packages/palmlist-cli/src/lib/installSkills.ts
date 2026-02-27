/**
 * Install Palmlist skills to .agent/skills and .claude/skills in the target directory.
 * Used by `palmlist install skill` and when daemon starts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const SKILL_NAMES = ['palmlist-planner', 'palmlist-worker'];
const TARGET_DIRS_DEFAULT = ['.agent/skills', '.claude/skills'];
const TARGET_DIRS_HERE = [''];

/**
 * Get the path to the palmlist-skills package skills directory.
 */
function getSkillsSourcePath(): string {
  try {
    // Resolve from palmlist-cli's node_modules (workspace or hoisted)
    const pkgPath = require.resolve('palmlist-skills/package.json', {
      paths: [path.dirname(fileURLToPath(import.meta.url))],
    });
    return path.join(path.dirname(pkgPath), 'skills');
  } catch {
    // Fallback: relative to this file (e.g. in monorepo packages/palmlist-cli)
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return path.join(dir, '../../palmlist-skills/skills');
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
  /** When true, install to current directory (no skills/, .agent, or .claude) */
  here?: boolean;
}

/**
 * Install Palmlist skills to .agent/skills and .claude/skills, or current dir when here=true.
 * @param targetRoot - Root directory (default: process.cwd())
 * @param options - { here: true } to install to current directory (./palmlist-planner, ./palmlist-worker)
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
