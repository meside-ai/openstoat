import type { ArgumentsCamelCase } from 'yargs';
import { listHandoffsByTask, getHandoff, createHandoff } from '@openstoat/core';

const HANDOFF_EPILOG = `
Handoffs carry context (summary + artifacts) from completed upstream tasks to you.
They are your primary source of information when picking up a task.

## Agent Workflow: Getting Context Before You Start

  BEFORE executing any task, check for upstream handoffs:

    openstoat handoff ls --task <task_id>

  If handoffs exist, read them:

    openstoat handoff show <handoff_id>

  A handoff contains:
    summary    What the upstream task accomplished
    artifacts  Files created/modified, credentials provided, decisions made

  Example: If task B (human provides API key) → task C (you implement service),
  the handoff from B→C tells you the API key value and environment (sandbox/prod).

## Subcommands

  add --from <task_id> --to <task_id> --summary "..."  Create handoff (optional --artifacts JSON)
  ls --task <task_id>   List handoffs for a task (both incoming and outgoing)
  show <handoff_id>     Show full handoff details as JSON

## When handoffs are created

  Handoffs are created automatically when "task done --output" is called with output.
  You can also create handoffs manually with handoff add.
`;

export const handoffCmd = {
  command: 'handoff <action> [id..]',
  describe: 'Read upstream context: summaries and artifacts from completed tasks (check BEFORE starting work)',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['add', 'ls', 'show'],
        describe: 'add/ls/show',
      })
      .option('task', { type: 'string', describe: 'Required for ls; task ID to filter handoffs' })
      .option('from', { type: 'string', describe: 'Required for add; source task ID' })
      .option('to', { type: 'string', describe: 'Required for add; target task ID' })
      .option('summary', { type: 'string', describe: 'Required for add; handoff summary' })
      .option('artifacts', { type: 'string', describe: 'Optional for add; JSON array of artifacts' })
      .example('$0 handoff add --from task_a --to task_b --summary "API key provided"', 'Create handoff')
      .example('$0 handoff ls --task task_xxx', 'List handoffs for task_xxx')
      .example('$0 handoff show handoff_xxx', 'Show handoff details')
      .epilog(HANDOFF_EPILOG),
  handler: (argv: ArgumentsCamelCase<{
    action: string;
    id?: string[];
    task?: string;
    from?: string;
    to?: string;
    summary?: string;
    artifacts?: string;
  }>) => {
    const ids = argv.id ?? [];
    const id = ids[0];

    switch (argv.action) {
      case 'add': {
        if (!argv.from || !argv.to || !argv.summary) {
          console.error('handoff add requires --from, --to, --summary');
          process.exit(1);
        }
        let artifacts: { type: string; [key: string]: unknown }[] = [];
        if (argv.artifacts) {
          try {
            artifacts = JSON.parse(argv.artifacts) as { type: string; [key: string]: unknown }[];
          } catch {
            console.error('--artifacts must be valid JSON array');
            process.exit(1);
          }
        }
        const handoff = createHandoff({
          fromTaskId: argv.from,
          toTaskId: argv.to,
          summary: argv.summary,
          artifacts,
        });
        console.log(`Handoff created: ${handoff.id}`);
        break;
      }
      case 'ls': {
        if (!argv.task) {
          console.error('handoff ls requires --task <task_id>');
          process.exit(1);
        }
        const handoffs = listHandoffsByTask(argv.task);
        if (handoffs.length === 0) {
          console.log('No handoffs');
          return;
        }
        for (const h of handoffs) {
          console.log(`${h.id}\t${h.from_task_id} -> ${h.to_task_id}\t${h.summary}`);
        }
        break;
      }
      case 'show': {
        if (!id) {
          console.error('Please provide handoff_id');
          process.exit(1);
        }
        const handoff = getHandoff(id);
        if (!handoff) {
          console.error(`Handoff not found: ${id}`);
          process.exit(1);
        }
        console.log(JSON.stringify(handoff, null, 2));
        break;
      }
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  },
};
