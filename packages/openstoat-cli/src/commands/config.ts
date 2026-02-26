import type { ArgumentsCamelCase } from 'yargs';
import { getConfig, setConfig, getAllConfig } from '@openstoat/core';

const CONFIG_EPILOG = `
Config is stored in the SQLite database in the data directory, persisted with plans/tasks.

## Subcommands

show   Display all config (default)
set    Set config: config set <key> <value>

## Common keys

agent   External AI agent name or path, used by daemon when scheduling
        e.g. openclaw, /path/to/my-agent
`;

export const configCmd = {
  command: 'config [action] [key] [value]',
  describe: 'View or set OpenStoat config (agent, etc.); persisted in database',
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
