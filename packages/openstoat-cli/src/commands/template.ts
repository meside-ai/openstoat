import type { ArgumentsCamelCase } from 'yargs';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from '@openstoat/core';
import { readFileSync } from 'fs';

const TEMPLATE_EPILOG = `
Template defines workflow rules: which task types require human input. plan add uses the default
template to match task types (via keywords) and assign owner (ai/human).

## Subcommands

ls                 List all templates; default is marked (default)

show <template_id> Show full template JSON (rules, keywords)

add                Add template from JSON file; requires -f <file>

rm <template_id>   Delete template

set-default <template_id>  Set as default; used by plan add

## Template JSON format

  {
    "name": "My Workflow",
    "version": "1.0",
    "rules": [
      { "task_type": "credentials", "requires_human": true, "human_action": "provide_input", "prompt": "Provide {field}" },
      { "task_type": "code_review", "requires_human": true },
      { "task_type": "implementation", "requires_human": false }
    ],
    "keywords": {
      "credentials": ["api_key", "secret", "API Key"],
      "code_review": ["review", "code review"]
    }
  }

  rules:    Whether each task_type requires human
  keywords: Task title/description matches keywords → maps to task_type
`;

export const templateCmd = {
  command: 'template <action> [id..]',
  describe: 'Workflow template management: define which task types need human; plan add uses default',
  builder: (yargs: ReturnType<typeof import('yargs')>) =>
    yargs
      .positional('action', {
        type: 'string',
        choices: ['ls', 'show', 'add', 'rm', 'set-default'],
        describe: 'ls/show/add/rm/set-default',
      })
      .option('f', {
        alias: 'file',
        type: 'string',
        describe: 'Required for add; path to template JSON file',
      })
      .example('$0 template ls', 'List all templates')
      .example('$0 template show template_default', 'Show default template')
      .example('$0 template add -f my-template.json', 'Add template from file')
      .example('$0 template set-default template_xxx', 'Set as default template')
      .epilog(TEMPLATE_EPILOG),
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
