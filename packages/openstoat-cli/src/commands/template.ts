import type { ArgumentsCamelCase } from 'yargs';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from '@openstoat/core';
import { readFileSync } from 'fs';

export const templateCmd = {
  command: 'template <action> [id..]',
  describe: 'Template management',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['ls', 'show', 'add', 'rm', 'set-default'],
      })
      .option('f', {
        alias: 'file',
        type: 'string',
        describe: 'Template JSON file path',
      }),
  handler: (argv: ArgumentsCamelCase<{ action: string; id?: string[]; f?: string }>) => {
    const ids = argv.id ?? [];
    const id = ids[0];

    switch (argv.action) {
      case 'ls': {
        const templates = listTemplates();
        if (templates.length === 0) {
          console.log('No templates');
          return;
        }
        for (const t of templates) {
          const def = t.is_default ? ' (default)' : '';
          console.log(`${t.id}\t${t.name}${def}`);
        }
        break;
      }
      case 'show': {
        if (!id) {
          console.error('Please provide template_id');
          process.exit(1);
        }
        const template = getTemplate(id);
        if (!template) {
          console.error(`Template not found: ${id}`);
          process.exit(1);
        }
        console.log(JSON.stringify(template, null, 2));
        break;
      }
      case 'add': {
        if (!argv.f) {
          console.error('template add requires -f <file>');
          process.exit(1);
        }
        const content = JSON.parse(readFileSync(argv.f, 'utf-8'));
        const template = createTemplate({
          name: content.name ?? 'Unnamed',
          version: content.version ?? '1.0',
          rules: content.rules ?? [],
          keywords: content.keywords ?? {},
          isDefault: content.is_default ?? false,
        });
        console.log(`Template added: ${template.id}`);
        break;
      }
      case 'rm': {
        if (!id) {
          console.error('Please provide template_id');
          process.exit(1);
        }
        const ok = deleteTemplate(id);
        if (!ok) {
          console.error(`Template not found: ${id}`);
          process.exit(1);
        }
        console.log(`Template deleted: ${id}`);
        break;
      }
      case 'set-default': {
        if (!id) {
          console.error('Please provide template_id');
          process.exit(1);
        }
        const ok = setDefaultTemplate(id);
        if (!ok) {
          console.error(`Template not found: ${id}`);
          process.exit(1);
        }
        console.log(`Default template set: ${id}`);
        break;
      }
      default:
        console.error('Unknown action');
        process.exit(1);
    }
  },
};
