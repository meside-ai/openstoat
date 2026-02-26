/**
 * Project commands: init, ls, show
 */

import type { Argv } from 'yargs';
import { createProject, getProject, listProjects } from 'openstoat-core';

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
            }),
        handler: (argv: { id?: string; name?: string; template?: string; project_id?: string }) => {
          const project = createProject(
            argv.id as string,
            argv.name as string,
            argv.template as string
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
        handler: (argv: { id?: string; name?: string; template?: string; project_id?: string }) => {
          const project = getProject(argv.project_id as string);
          if (!project) {
            console.error(`Project '${argv.project_id}' not found.`);
            process.exit(1);
          }
          console.log(JSON.stringify(project, null, 2));
        },
      })
      .demandCommand(1, 'Specify init, ls, or show'),
  handler: () => {},
};
