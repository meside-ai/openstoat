import type { ArgumentsCamelCase } from 'yargs';
import { getConfig, setConfig, getAllConfig } from '@openstoat/core';

export const configCmd = {
  command: 'config [action] [key] [value]',
  describe: 'Config management',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['show', 'set'],
        default: 'show',
        describe: 'show: display config, set: set config',
      })
      .positional('key', { type: 'string', describe: 'Config key' })
      .positional('value', { type: 'string', describe: 'Config value' }),
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
