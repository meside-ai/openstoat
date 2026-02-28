/**
 * OpenStoat Core - storage, state machine, Kanban operations
 */

export { getDb, getDbPath, setDbPath, closeDb } from './db.js';
export { loadProjectConfig, saveProjectConfig, type OpenstoatConfig } from './projectConfig.js';
export {
  createProject,
  getProject,
  listProjects,
  updateProjectWorkflowInstructions,
} from './project.js';
export {
  createTask,
  getTask,
  listTasks,
  claimTask,
  startTask,
  completeTask,
  selfUnblockTask,
  cancelTask,
  areDependenciesSatisfied,
} from './task.js';
export { createHandoff, listHandoffs, getDownstreamTaskIds } from './handoff.js';
