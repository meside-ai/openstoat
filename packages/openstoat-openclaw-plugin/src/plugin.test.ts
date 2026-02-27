/**
 * Plugin tests: CLI runner and tool/command registration.
 * Uses temp DB; requires OpenStoat CLI in path (bun run from monorepo root).
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runOpenstoat, runOpenstoatJson } from './lib/cli.js';
import register from './index.js';

let testDbDir: string;

describe('openstoat-openclaw-plugin', () => {
  beforeEach(() => {
    testDbDir = mkdtempSync(join(tmpdir(), 'openstoat-plugin-test-'));
  });

  afterEach(() => {
    try {
      rmSync(testDbDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  const cliRunPath = join(import.meta.dir, '../../openstoat-cli/dist/index.js');
  const cfg = () => ({ dbPath: join(testDbDir, 'openstoat.db'), cliRunPath });

  describe('CLI runner', () => {
    test('project init and task create', () => {
      let r = runOpenstoat(
        ['project', 'init', '--id', 'p1', '--name', 'P1', '--template', 'default-v1'],
        cfg()
      );
      expect(r.exitCode).toBe(0);

      r = runOpenstoat(
        [
          'task', 'create',
          '--project', 'p1',
          '--title', 'Test task',
          '--description', 'Desc',
          '--acceptance-criteria', 'Done',
          '--status', 'ready',
          '--owner', 'agent_worker',
          '--task-type', 'implementation',
        ],
        cfg()
      );
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toBe('task_001');
    });

    test('task ls and show', () => {
      runOpenstoat(['project', 'init', '--id', 'p2', '--name', 'P2', '--template', 'default-v1'], cfg());
      runOpenstoat(
        [
          'task', 'create',
          '--project', 'p2', '--title', 'T', '--description', 'D',
          '--acceptance-criteria', 'C', '--status', 'ready',
          '--owner', 'agent_worker', '--task-type', 'implementation',
        ],
        cfg()
      );

      const { data, error } = runOpenstoatJson<unknown[]>(['task', 'ls', '--project', 'p2', '--json'], cfg());
      expect(error).toBeUndefined();
      expect(Array.isArray(data)).toBe(true);
      expect((data ?? []).length).toBe(1);

      const show = runOpenstoatJson<Record<string, unknown>>(['task', 'show', 'task_001'], cfg());
      expect(show.error).toBeUndefined();
      expect(show.data?.id).toBe('task_001');
    });
  });

  describe('Plugin registration', () => {
    test('register runs without error and registers tools', () => {
      const tools: unknown[] = [];
      const commands: unknown[] = [];
      const services: unknown[] = [];
      const hooks: Array<{ event: string }> = [];

      const api = {
        registerTool: (t: unknown) => tools.push(t),
        registerCommand: (c: unknown) => commands.push(c),
        registerService: (s: unknown) => services.push(s),
        registerHook: (event: string) => hooks.push({ event }),
        logger: { info: () => {}, warn: () => {} },
        config: { defaultProject: 'p1', cliPath: 'openstoat' },
      };

      expect(() => register(api)).not.toThrow();
      expect(tools.length).toBeGreaterThanOrEqual(6);
      expect(commands.length).toBe(5);
      expect(services.length).toBe(1);
      expect(hooks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
