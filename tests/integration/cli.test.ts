/**
 * Integration tests for OpenStoat CLI
 * Covers Use Cases 1-7 from openstoat-usecases.md
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';

const CLI_PATH = join(import.meta.dir, '../../packages/openstoat-cli/dist/index.js');

let testDbDir: string;

function runOpenstoat(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', ['run', CLI_PATH, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, OPENSTOAT_DB_PATH: join(testDbDir, 'openstoat.db') },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? -1,
  };
}

describe('OpenStoat Integration', () => {
  beforeEach(() => {
    testDbDir = mkdtempSync(join(tmpdir(), 'openstoat-test-'));
  });

  afterEach(() => {
    try {
      rmSync(testDbDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  describe('Use Case 1: Agent Planner Creates Tasks, Agent Worker Executes', () => {
    test('project init, task create, claim, start, done flow', () => {
      // 1) Init project
      let r = runOpenstoat([
        'project', 'init',
        '--id', 'project_checkout_rebuild',
        '--name', 'Checkout Rebuild',
        '--template', 'checkout-default-v1',
      ]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toContain('project_checkout_rebuild');

      // 2) List unfinished tasks (empty)
      r = runOpenstoat([
        'task', 'ls',
        '--project', 'project_checkout_rebuild',
        '--status', 'ready,in_progress',
      ]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toContain('No tasks found');

      // 3) Create Task A
      r = runOpenstoat([
        'task', 'create',
        '--project', 'project_checkout_rebuild',
        '--title', 'Add provider mapping for Paddle',
        '--description', 'Implement mapping in payment module',
        '--acceptance-criteria', 'Mapping works in checkout paths',
        '--acceptance-criteria', 'Unit tests pass',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe('task_001');

      // 4) Claim and execute
      r = runOpenstoat([
        'task', 'claim', 'task_001',
        '--as', 'agent_worker',
        '--logs-append', 'Claimed, starting work',
      ]);
      expect(r.exitCode).toBe(0);

      r = runOpenstoat([
        'task', 'start', 'task_001',
        '--as', 'agent_worker',
        '--logs-append', 'Started implementation',
      ]);
      expect(r.exitCode).toBe(0);

      const handoffSummary = 'Implemented provider mapping for Paddle in checkout and recurring billing paths, added integration coverage, and validated compatibility with existing provider selection logic. Main changes are in src/payments/provider-map.ts. No migration needed.';
      r = runOpenstoat([
        'task', 'done', 'task_001',
        '--output', 'Implemented and tested',
        '--handoff-summary', handoffSummary,
        '--logs-append', 'Completed implementation and tests',
        '--as', 'agent_worker',
      ]);
      expect(r.exitCode).toBe(0);

      // 5) Verify task is done
      r = runOpenstoat(['task', 'show', 'task_001', '--json']);
      expect(r.exitCode).toBe(0);
      const task = JSON.parse(r.stdout);
      expect(task.status).toBe('done');
      expect(task.logs.length).toBe(3);
    });
  });

  describe('Use Case 2: Human Planner Inserts Human-Owned Tasks', () => {
    test('dependency chain: A -> B (human) -> C', () => {
      runOpenstoat(['project', 'init', '--id', 'proj2', '--name', 'Proj2', '--template', 'default-v1']);

      // Create A (agent)
      runOpenstoat([
        'task', 'create',
        '--project', 'proj2',
        '--title', 'Task A',
        '--description', 'Agent task',
        '--acceptance-criteria', 'Done',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      expect(runOpenstoat(['task', 'ls', '--project', 'proj2']).stdout).toContain('task_001');

      // Create B (human, depends on A)
      runOpenstoat([
        'task', 'create',
        '--project', 'proj2',
        '--title', 'Provide Paddle API key',
        '--description', 'Credentials',
        '--acceptance-criteria', 'Key delivered',
        '--depends-on', 'task_001',
        '--status', 'ready',
        '--owner', 'human_worker',
        '--task-type', 'credentials',
      ]);

      // Create C (agent, depends on B)
      runOpenstoat([
        'task', 'create',
        '--project', 'proj2',
        '--title', 'Task C',
        '--description', 'After B',
        '--acceptance-criteria', 'Done',
        '--depends-on', 'task_002',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);

      // B should not be claimable until A is done (deps not satisfied - actually B depends on A, so B is not ready until A done)
      // Complete A first
      runOpenstoat(['task', 'claim', 'task_001', '--as', 'agent_worker', '--logs-append', 'Claimed']);
      runOpenstoat(['task', 'start', 'task_001', '--as', 'agent_worker', '--logs-append', 'Started']);
      const handoff = 'A is complete. Provider mapping done. Context for B: deliver key. ' + 'x'.repeat(150);
      runOpenstoat(['task', 'done', 'task_001', '--output', 'Done', '--handoff-summary', handoff, '--as', 'agent_worker']);

      // Now B becomes ready - Human claims and completes
      runOpenstoat(['task', 'claim', 'task_002', '--as', 'human_worker', '--logs-append', 'Human claimed']);
      runOpenstoat(['task', 'start', 'task_002', '--as', 'human_worker', '--logs-append', 'Providing key']);
      const handoffB = 'API key delivered via secure channel. Use sandbox. Key in .env as PADDLE_API_KEY. ' + 'x'.repeat(150);
      runOpenstoat(['task', 'done', 'task_002', '--output', 'Key delivered', '--handoff-summary', handoffB, '--as', 'human_worker']);

      // C should now be claimable
      const r = runOpenstoat(['task', 'claim', 'task_003', '--as', 'agent_worker', '--logs-append', 'Claimed C']);
      expect(r.exitCode).toBe(0);
    });
  });

  describe('Use Case 3: Worker Self-Unblock', () => {
    test('agent creates human task and self-unblocks', () => {
      runOpenstoat(['project', 'init', '--id', 'proj3', '--name', 'Proj3', '--template', 'default-v1']);

      runOpenstoat([
        'task', 'create',
        '--project', 'proj3',
        '--title', 'Task X',
        '--description', 'Agent task',
        '--acceptance-criteria', 'Done',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);

      runOpenstoat([
        'task', 'create',
        '--project', 'proj3',
        '--title', 'Provide Paddle API key',
        '--description', 'Unblock',
        '--acceptance-criteria', 'Key delivered',
        '--status', 'ready',
        '--owner', 'human_worker',
        '--task-type', 'credentials',
      ]);

      runOpenstoat(['task', 'claim', 'task_001', '--as', 'agent_worker', '--logs-append', 'Claimed']);
      runOpenstoat(['task', 'start', 'task_001', '--as', 'agent_worker', '--logs-append', 'Need API key']);

      // Self-unblock: task_001 depends on task_002
      const r = runOpenstoat([
        'task', 'self-unblock', 'task_001',
        '--depends-on', 'task_002',
        '--logs-append', 'Blocked: need API key. Created task_002 for human.',
      ]);
      expect(r.exitCode).toBe(0);

      const show = runOpenstoat(['task', 'show', 'task_001', '--json']);
      const task = JSON.parse(show.stdout);
      expect(task.status).toBe('ready');
      expect(task.depends_on).toContain('task_002');
    });
  });

  describe('Use Case 4: Parallel Execution with Dependencies', () => {
    test('A and B parallel, C depends on both', () => {
      runOpenstoat(['project', 'init', '--id', 'proj4', '--name', 'Proj4', '--template', 'default-v1']);

      runOpenstoat([
        'task', 'create',
        '--project', 'proj4',
        '--title', 'Task A',
        '--description', 'A',
        '--acceptance-criteria', 'A done',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      runOpenstoat([
        'task', 'create',
        '--project', 'proj4',
        '--title', 'Task B',
        '--description', 'B',
        '--acceptance-criteria', 'B done',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      runOpenstoat([
        'task', 'create',
        '--project', 'proj4',
        '--title', 'Task C',
        '--description', 'C',
        '--acceptance-criteria', 'C done',
        '--depends-on', 'task_001',
        '--depends-on', 'task_002',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'testing',
      ]);

      // C should not be claimable yet
      const claimC = runOpenstoat(['task', 'claim', 'task_003', '--as', 'agent_worker', '--logs-append', 'x']);
      expect(claimC.exitCode).not.toBe(0);
      expect(claimC.stderr).toContain('dependencies');

      // Complete A and B
      const handoff = 'Done. ' + 'x'.repeat(200);
      runOpenstoat(['task', 'claim', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'start', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'done', 'task_001', '--output', 'A', '--handoff-summary', handoff, '--as', 'agent_worker']);

      runOpenstoat(['task', 'claim', 'task_002', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'start', 'task_002', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'done', 'task_002', '--output', 'B', '--handoff-summary', handoff, '--as', 'agent_worker']);

      // Now C is claimable
      const r = runOpenstoat(['task', 'claim', 'task_003', '--as', 'agent_worker', '--logs-append', 'Claimed C']);
      expect(r.exitCode).toBe(0);
    });
  });

  describe('Use Case 6: Project and Template Binding', () => {
    test('project init and list', () => {
      runOpenstoat(['project', 'init', '--id', 'proj6', '--name', 'Proj6', '--template', 'checkout-default-v1']);
      const r = runOpenstoat(['project', 'ls']);
      expect(r.stdout).toContain('proj6');
      expect(r.stdout).toContain('Proj6');
    });
  });

  describe('Validation', () => {
    test('reject handoff < 200 chars', () => {
      runOpenstoat(['project', 'init', '--id', 'v', '--name', 'V', '--template', 't']);
      runOpenstoat([
        'task', 'create',
        '--project', 'v',
        '--title', 'T',
        '--description', 'D',
        '--acceptance-criteria', 'C',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      runOpenstoat(['task', 'claim', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'start', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);

      const r = runOpenstoat([
        'task', 'done', 'task_001',
        '--output', 'O',
        '--handoff-summary', 'Too short',
        '--as', 'agent_worker',
      ]);
      expect(r.exitCode).not.toBe(0);
      expect(r.stderr).toContain('200');
    });

    test('reject self-unblock without new depends_on', () => {
      runOpenstoat(['project', 'init', '--id', 'v2', '--name', 'V2', '--template', 't']);
      runOpenstoat([
        'task', 'create',
        '--project', 'v2',
        '--title', 'T',
        '--description', 'D',
        '--acceptance-criteria', 'C',
        '--status', 'ready',
        '--owner', 'agent_worker',
        '--task-type', 'implementation',
      ]);
      runOpenstoat(['task', 'claim', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);
      runOpenstoat(['task', 'start', 'task_001', '--as', 'agent_worker', '--logs-append', 'x']);

      // Self-unblock with no depends_on (missing)
      const r = runOpenstoat(['task', 'self-unblock', 'task_001', '--depends-on']);
      expect(r.exitCode).not.toBe(0);
    });
  });

  describe('install skill', () => {
    test('default: installs to .agent/skills and .claude/skills', () => {
      const installDir = mkdtempSync(join(tmpdir(), 'openstoat-install-'));
      try {
        const r = runOpenstoat(['install', 'skill', '--cwd', installDir]);
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain('Installed skills to:');
        expect(r.stdout).toContain('openstoat-planner');
        expect(r.stdout).toContain('openstoat-worker');

        expect(existsSync(join(installDir, '.agent/skills/openstoat-planner/SKILL.md'))).toBe(true);
        expect(existsSync(join(installDir, '.agent/skills/openstoat-worker/SKILL.md'))).toBe(true);
        expect(existsSync(join(installDir, '.claude/skills/openstoat-planner/SKILL.md'))).toBe(true);
        expect(existsSync(join(installDir, '.claude/skills/openstoat-worker/SKILL.md'))).toBe(true);
      } finally {
        rmSync(installDir, { recursive: true, force: true });
      }
    });

    test('--here: installs to current directory (no skills/, .agent, or .claude)', () => {
      const installDir = mkdtempSync(join(tmpdir(), 'openstoat-install-here-'));
      try {
        const r = runOpenstoat(['install', 'skill', '--here', '--cwd', installDir]);
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain('Installed skills to:');
        expect(r.stdout).toContain('openstoat-planner');
        expect(r.stdout).toContain('openstoat-worker');

        expect(existsSync(join(installDir, 'openstoat-planner/SKILL.md'))).toBe(true);
        expect(existsSync(join(installDir, 'openstoat-worker/SKILL.md'))).toBe(true);
        expect(existsSync(join(installDir, 'skills'))).toBe(false);
        expect(existsSync(join(installDir, '.agent'))).toBe(false);
        expect(existsSync(join(installDir, '.claude'))).toBe(false);
      } finally {
        rmSync(installDir, { recursive: true, force: true });
      }
    });
  });
});
