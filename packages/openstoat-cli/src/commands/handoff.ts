import type { ArgumentsCamelCase } from 'yargs';
import { listHandoffsByTask, getHandoff } from '@openstoat/core';

const HANDOFF_EPILOG = `
Handoff is context passed from a completed task to downstream tasks (summary + artifacts).
Created when task done runs; downstream tasks can reference it.

## Subcommands

ls --task <task_id>  List handoffs related to a task (as from or to)
show <handoff_id>   Show handoff details (JSON)

## Use cases

- Inspect context passed from task A to task B
- Debug task dependencies and information flow
`;

export const handoffCmd = {
  command: 'handoff <action> [id..]',
  describe: 'Handoff records: context passed to downstream when tasks complete (summary, artifacts)',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['ls', 'show'],
        describe: 'ls/show',
      })
      .option('task', { type: 'string', describe: 'Required for ls; task ID to filter handoffs' })
      .example('$0 handoff ls --task task_xxx', 'List handoffs for task_xxx')
      .example('$0 handoff show handoff_xxx', 'Show handoff details')
      .epilog(HANDOFF_EPILOG),
  handler: (argv: ArgumentsCamelCase<{ action: string; id?: string[]; task?: string }>) => {
    const ids = argv.id ?? [];
    const id = ids[0];

    switch (argv.action) {
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
