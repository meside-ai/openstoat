import type { ArgumentsCamelCase } from 'yargs';
import { getConfig, setConfig, getAllConfig } from '@openstoat/core';

const CONFIG_EPILOG = `
Config is stored in the SQLite database alongside plans and tasks.

## Subcommands

  show   Display all config key-value pairs (default action)
  set    Set a config value: config set <key> <value>

## Config Keys

  agent           Name or path of the AI agent invoked by the daemon scheduler.
                  e.g. "openclaw", "claude-code", "/path/to/my-agent"

  poll-interval   How often the daemon checks for ai_ready tasks (seconds, default: 60)

## Agent Note

  You typically don't need to modify config during normal task execution.
  Config is mainly used by the human to set up the daemon scheduler.
`;

export const configCmd = {
  command: 'config [action] [key] [value]',
  describe: 'View/set config (agent name, poll interval); managed by human',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['show', 'set'],
        default: 'show',
        describe: 'show: display all; set: set key=value',
      })
      .positional('key', { type: 'string', describe: 'Config key' })
      .positional('value', { type: 'string', describe: 'Config value' })
      .example('$0 config show', 'Display all config')
      .example('$0 config set agent openclaw', 'Set agent to openclaw')
      .epilog(CONFIG_EPILOG),
  handler: (argv: ArgumentsCamelCase<{ action: string; key?: string; value?: string }>) => {
    const action = argv.action ?? (argv.key ? 'set' : 'show');
    if (action === 'show') {
      const config = getAllConfig();
      if (Object.keys(config).length === 0) {
        console.log('No config');
        return;
      }
      for (const [k, v] of Object.entries(config)) {
        console.log(`${k}: ${v}`);
      }
    } else if (action === 'set') {
      const key = argv.key ?? argv._[1];
      const value = argv.value ?? argv._[2];
      if (!key || value === undefined) {
        console.error('config set requires key and value, e.g.: openstoat config set agent openclaw');
        process.exit(1);
      }
      setConfig(String(key), String(value));
      console.log(`Set ${key} = ${value}`);
    }
  },
};
