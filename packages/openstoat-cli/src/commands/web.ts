import type { ArgumentsCamelCase } from 'yargs';
import { startServer } from '@openstoat/web';

const WEB_EPILOG = `
Start a small web server to view plans, tasks, templates, handoffs, and config.
All filter conditions are persisted in the URL for shareability and bookmarking.

  openstoat web              # Start on default port 3947
  openstoat web --port 8080  # Start on custom port
`;

export const webCmd = {
  command: 'web',
  describe: 'Start web UI server to view plans, tasks, templates, handoffs, config',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .option('port', {
        type: 'number',
        describe: 'Port to listen on (default: 3947)',
      })
      .example('$0 web', 'Start web UI on default port')
      .example('$0 web --port 8080', 'Start on port 8080')
      .epilog(WEB_EPILOG),
  handler: (argv: ArgumentsCamelCase<{ port?: number }>) => {
    startServer({ port: argv.port });
  },
};
