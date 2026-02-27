/**
 * Project commands: init, ls, show, update
 */

import type { Argv } from 'yargs';
import {
  createProject,
  getProject,
  listProjects,
  updateProjectWorkflowInstructions,
} from 'openstoat-core';

export const projectCommands = {
  command: 'project <action>',
  describe: 'Manage projects. Each project is template-bound. Use project ID as --project in task commands.',
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: 'init',
        describe: 'Initialize project with bound template. Required before creating tasks.',
        builder: (y: Argv) =>
          y
            .option('id', {
              type: 'string',
              demandOption: true,
              describe: 'Project ID. Use this as --project in all task commands.',
            })
            .option('name', {
              type: 'string',
              demandOption: true,
              describe: 'Display name',
            })
            .option('template', {
              type: 'string',
              demandOption: true,
              describe: 'Template name (e.g. checkout-default-v1). Defines default owner per task_type.',
            })
            .option('workflow-instructions', {
              type: 'string',
              describe: 'Super prompt guiding task splitting, prerequisites, and finish steps.',
            }),
        handler: (argv: {
          id?: string;
          name?: string;
          template?: string;
          'workflow-instructions'?: string;
        }) => {
          const project = createProject(
            argv.id as string,
            argv.name as string,
            argv.template as string,
            {
              workflow_instructions: argv['workflow-instructions'],
            }
          );
          console.log(`Project initialized: ${project.id}`);
        },
      })
      .command({
        command: 'ls',
        describe: 'List projects. Output: id, name, status. Get --project for task commands.',
        handler: () => {
          const projects = listProjects();
          if (projects.length === 0) {
            console.log('No projects found.');
            return;
          }
          for (const p of projects) {
            console.log(`${p.id}\t${p.name}\t${p.status}`);
          }
        },
      })
      .command({
        command: 'show <project_id>',
        describe: 'Show project details (JSON). Includes template_context.',
        builder: (y: Argv) => y.positional('project_id', { type: 'string', demandOption: true }),
        handler: (argv: { project_id?: string }) => {
          const project = getProject(argv.project_id as string);
          if (!project) {
            console.error(`Project '${argv.project_id}' not found.`);
            process.exit(1);
          }
          console.log(JSON.stringify(project, null, 2));
        },
      })
      .command({
        command: 'update <project_id>',
        describe: 'Update project workflow instructions.',
        builder: (y: Argv) =>
          y
            .positional('project_id', { type: 'string', demandOption: true })
            .option('workflow-instructions', {
              type: 'string',
              demandOption: true,
              describe: 'Super prompt guiding task splitting, prerequisites, and finish steps.',
            }),
        handler: (argv: { project_id?: string; 'workflow-instructions'?: string }) => {
          const updated = updateProjectWorkflowInstructions(
            argv.project_id as string,
            argv['workflow-instructions'] as string
          );
          if (!updated) {
            console.error(`Project '${argv.project_id}' not found.`);
            process.exit(1);
          }
          console.log(`Project ${updated.id} workflow instructions updated.`);
        },
      })
      .demandCommand(1, 'Specify init, ls, show, or update'),
  handler: () => {},
};
