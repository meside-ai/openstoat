import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const TEST_DIR = mkdtempSync(join(tmpdir(), 'openstoat-test-'));
const CLI_PATH = join(import.meta.dir, '../src/index.ts');

function runOpenstoat(args: string[], cwd = process.cwd()): { stdout: string; stderr: string; code: number } {
  const result = spawnSync('bun', ['run', CLI_PATH, ...args], {
    cwd,
    env: { ...process.env, OPENSTOAT_DATA_DIR: TEST_DIR },
    encoding: 'utf-8',
  });
  return {
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    code: result.status ?? -1,
  };
}

beforeAll(() => {
  runOpenstoat(['init']);
});

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('init', () => {
  test('init 创建数据目录', () => {
    const { stdout, code } = runOpenstoat(['init']);
    expect(code).toBe(0);
    expect(stdout).toContain('OpenStoat');
  });

  test('init --project 创建项目配置', () => {
    const { stdout, code } = runOpenstoat(['init', '--project', 'test-proj']);
    expect(code).toBe(0);
    expect(stdout).toContain('test-proj');
  });
});

describe('config', () => {
  test('config show 显示配置', () => {
    const { stdout, code } = runOpenstoat(['config', 'show']);
    expect(code).toBe(0);
  });

  test('config set 和 show', () => {
    runOpenstoat(['config', 'set', 'agent', 'openclaw']);
    const { stdout, code } = runOpenstoat(['config', 'show']);
    expect(code).toBe(0);
    expect(stdout).toContain('agent');
    expect(stdout).toContain('openclaw');
  });
});

describe('plan', () => {
  test('plan add 创建计划和任务', () => {
    const planContent = `集成 Paddle 支付
1. 添加 Paddle 到枚举
2. 提供 Paddle API Key
3. 实现 PaddlePaymentService
4. 写单元测试
5. 代码审核
6. 部署到 staging`;
    const { stdout, code } = runOpenstoat(['plan', 'add', planContent]);
    expect(code).toBe(0);
    expect(stdout).toContain('Plan created');
    expect(stdout).toContain('Tasks: 6');
  });

  test('plan ls 列出计划', () => {
    const { stdout, code } = runOpenstoat(['plan', 'ls']);
    expect(code).toBe(0);
    expect(stdout).toContain('plan_');
  });

  test('plan show 显示计划详情', () => {
    const { stdout } = runOpenstoat(['plan', 'ls']);
    const planId = stdout.split('\n')[0]?.split('\t')[0];
    if (!planId) return;
    const { stdout: showOut, code } = runOpenstoat(['plan', 'show', planId]);
    expect(code).toBe(0);
    expect(showOut).toContain('Task');
  });

  test('plan status 显示计划状态', () => {
    const { stdout } = runOpenstoat(['plan', 'ls']);
    const planId = stdout.split('\n')[0]?.split('\t')[0];
    if (!planId) return;
    const { stdout: statusOut, code } = runOpenstoat(['plan', 'status', planId]);
    expect(code).toBe(0);
    expect(statusOut).toContain('Progress');
  });
});

describe('task', () => {
  test('task ls 列出任务', () => {
    const { stdout, code } = runOpenstoat(['task', 'ls']);
    expect(code).toBe(0);
    expect(stdout).toContain('task_');
  });

  test('task ls --status ai_ready', () => {
    const { stdout, code } = runOpenstoat(['task', 'ls', '--status', 'ai_ready']);
    expect(code).toBe(0);
  });

  test('task ls --json 输出 JSON', () => {
    const { stdout, code } = runOpenstoat(['task', 'ls', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  test('task show 显示任务详情', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const taskId = stdout.split('\n')[0]?.split('\t')[0];
    if (!taskId) return;
    const { stdout: showOut, code } = runOpenstoat(['task', 'show', taskId]);
    expect(code).toBe(0);
    expect(showOut).toContain('Task');
  });

  test('task done 标记完成并触发下游', () => {
    const { stdout } = runOpenstoat(['task', 'ls', '--status', 'ai_ready']);
    const taskId = stdout.split('\n')[0]?.split('\t')[0];
    if (!taskId) return;
    const { stdout: doneOut, code } = runOpenstoat(['task', 'done', taskId]);
    expect(code).toBe(0);
    expect(doneOut).toContain('done');
  });

  test('task need-human 升级为需要人工', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const line = stdout.trim().split('\n').find((l) => l.startsWith('task_'));
    const taskId = line?.split('\t')[0]?.trim();
    if (!taskId) return;
    runOpenstoat(['task', 'update', taskId, '--status', 'in_progress']);
    const { code } = runOpenstoat(['task', 'need-human', taskId, '--reason', '测试原因']);
    expect(code).toBe(0);
  });
});

describe('template', () => {
  test('template ls 列出模板', () => {
    const { stdout, code } = runOpenstoat(['template', 'ls']);
    expect(code).toBe(0);
    expect(stdout).toContain('template');
  });

  test('template show 显示模板', () => {
    const { stdout } = runOpenstoat(['template', 'ls']);
    const templateId = stdout.split('\n')[0]?.split('\t')[0];
    if (!templateId) return;
    const { stdout: showOut, code } = runOpenstoat(['template', 'show', templateId]);
    expect(code).toBe(0);
    const parsed = JSON.parse(showOut);
    expect(parsed.rules).toBeDefined();
  });
});

describe('plan rm', () => {
  test('plan rm 删除计划', () => {
    const planContent = '临时计划\n1. 任务1';
    runOpenstoat(['plan', 'add', planContent]);
    const { stdout } = runOpenstoat(['plan', 'ls']);
    const lines = stdout.trim().split('\n');
    const planId = lines[lines.length - 1]?.split('\t')[0];
    if (!planId) return;
    const { stdout: rmOut, code } = runOpenstoat(['plan', 'rm', planId]);
    expect(code).toBe(0);
    expect(rmOut).toContain('deleted');
  });
});

describe('task add and depend', () => {
  test('task add 手动添加任务', () => {
    const { stdout } = runOpenstoat(['plan', 'ls']);
    const planId = stdout.trim().split('\n')[0]?.split('\t')[0];
    if (!planId?.startsWith('plan_')) return;
    const { stdout: addOut, code } = runOpenstoat([
      'task', 'add', '--plan', planId, '--title', '手动任务', '--owner', 'ai',
    ]);
    expect(code).toBe(0);
    expect(addOut).toContain('Task created');
  });

  test('task add with description and acceptance-criteria', () => {
    const { stdout } = runOpenstoat(['plan', 'ls']);
    const planId = stdout.trim().split('\n')[0]?.split('\t')[0];
    if (!planId?.startsWith('plan_')) return;
    const { stdout: addOut, code } = runOpenstoat([
      'task', 'add', '--plan', planId, '--title', 'Test task', '--owner', 'ai',
      '--description', 'Requirement desc', '--acceptance-criteria', 'AC: tests pass',
    ]);
    expect(code).toBe(0);
    expect(addOut).toContain('Task created');
    const taskId = addOut.match(/task_[a-z0-9]+/)?.[0];
    if (taskId) {
      const { stdout: showOut } = runOpenstoat(['task', 'show', taskId]);
      expect(showOut).toContain('Requirement desc');
      expect(showOut).toContain('AC: tests pass');
    }
  });

  test('task depend 添加依赖', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const lines = stdout.trim().split('\n').filter((l) => l.startsWith('task_'));
    const [task1, task2] = lines.map((l) => l.split('\t')[0]?.trim()).filter(Boolean);
    if (!task1 || !task2 || task1 === task2) return;
    const { code } = runOpenstoat(['task', 'depend', task1, '--on', task2]);
    expect(code).toBe(0);
  });

  test('task depend rejects cycle', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const lines = stdout.trim().split('\n').filter((l) => l.startsWith('task_'));
    const [task1, task2] = lines.map((l) => l.split('\t')[0]?.trim()).filter(Boolean);
    if (!task1 || !task2 || task1 === task2) return;
    runOpenstoat(['task', 'depend', task1, '--on', task2]);
    const { code, stderr } = runOpenstoat(['task', 'depend', task2, '--on', task1]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('cycle');
  });

  test('need-human reason is persisted', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const taskId = stdout.trim().split('\n').find((l) => l.startsWith('task_'))?.split('\t')[0]?.trim();
    if (!taskId) return;
    runOpenstoat(['task', 'update', taskId, '--status', 'in_progress']);
    runOpenstoat(['task', 'need-human', taskId, '--reason', '测试原因持久化']);
    const { stdout: showOut } = runOpenstoat(['task', 'show', taskId]);
    expect(showOut).toContain('测试原因持久化');
  });
});

describe('handoff', () => {
  test('handoff ls 列出交接记录', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const taskId = stdout.trim().split('\n').find((l) => l.startsWith('task_'))?.split('\t')[0]?.trim();
    if (!taskId) return;
    const { code } = runOpenstoat(['handoff', 'ls', '--task', taskId]);
    expect(code).toBe(0);
  });

  test('handoff add 创建交接', () => {
    const { stdout } = runOpenstoat(['task', 'ls']);
    const lines = stdout.trim().split('\n').filter((l) => l.startsWith('task_'));
    const [task1, task2] = lines.map((l) => l.split('\t')[0]?.trim()).filter(Boolean);
    if (!task1 || !task2 || task1 === task2) return;
    const { stdout: addOut, code } = runOpenstoat([
      'handoff', 'add', '--from', task1, '--to', task2, '--summary', 'Test handoff',
    ]);
    expect(code).toBe(0);
    expect(addOut).toContain('Handoff created');
  });
});

describe('template add and rm', () => {
  test('template add 从文件添加', () => {
    const tmpFile = join(TEST_DIR, 'custom-template.json');
    const { writeFileSync } = require('fs');
    writeFileSync(
      tmpFile,
      JSON.stringify({
        name: 'Custom',
        version: '1.0',
        rules: [
          { task_type: 'implementation', requires_human: false },
          { task_type: 'review', requires_human: true },
        ],
        keywords: { review: ['review', '审核'] },
      })
    );
    const { stdout, code } = runOpenstoat(['template', 'add', '-f', tmpFile]);
    expect(code).toBe(0);
    expect(stdout).toContain('Template added');
  });

  test('template set-default 和 rm', () => {
    const { stdout } = runOpenstoat(['template', 'ls']);
    const line = stdout.trim().split('\n').find((l) => l.includes('Custom'));
    const templateId = line?.split('\t')[0]?.trim();
    if (!templateId) return;
    runOpenstoat(['template', 'set-default', templateId]);
    const { code } = runOpenstoat(['template', 'rm', templateId]);
    expect(code).toBe(0);
  });
});

describe('daemon', () => {
  test(
    'daemon start stop status',
    () => {
      runOpenstoat(['daemon', 'start']);
      const { stdout: statusOut, code: statusCode } = runOpenstoat(['daemon', 'status']);
      expect(statusCode).toBe(0);
      expect(statusOut).toContain('running');
      runOpenstoat(['daemon', 'stop']);
      const { stdout: stopOut, code: stopCode } = runOpenstoat(['daemon', 'status']);
      expect(stopCode).toBe(0);
      expect(stopOut).toContain('not running');
    },
    { timeout: 5000 }
  );
});
