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
Templates define the rules for splitting work between you (AI) and humans.
When "plan add" creates tasks, it uses the DEFAULT template's keywords to decide
each task's owner. You SHOULD read the template before creating plans.

## Agent Workflow

  BEFORE creating a plan, read the active template:
    openstoat template ls                     # Find the default template
    openstoat template show <template_id>     # Read its rules and keywords

  This tells you which keywords trigger human ownership:
    "api_key", "secret" → credentials → human
    "review", "code review" → code_review → human
    "deploy", "release" → deploy → human
    Everything else → implementation → ai

  Knowing this, you can write plan steps that correctly trigger the right owner.

## Subcommands

  ls                    List all templates; default is marked (default)
  show <template_id>    Show full template JSON (rules + keywords)
  add -f <file>         Add template from JSON file
  rm <template_id>      Delete template
  set-default <id>      Set as default template (used by plan add)

## Template JSON Format

  {
    "name": "My Workflow",
    "version": "1.0",
    "rules": [
      { "task_type": "credentials", "requires_human": true, "human_action": "provide_input" },
      { "task_type": "code_review", "requires_human": true },
      { "task_type": "deploy", "requires_human": true },
      { "task_type": "implementation", "requires_human": false },
      { "task_type": "testing", "requires_human": false }
    ],
    "keywords": {
      "credentials": ["api_key", "secret", "API Key", "password"],
      "code_review": ["review", "code review", "PR"],
      "deploy": ["deploy", "release", "staging", "production"]
    }
  }

  rules:    Defines whether each task_type requires human
  keywords: When a task title contains these words → mapped to that task_type
`;

export const templateCmd = {
  command: 'template <action> [id..]',
  describe: 'Read workflow rules: which task types need human (read BEFORE creating plans)',
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
