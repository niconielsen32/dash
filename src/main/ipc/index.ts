import { registerAppIpc } from './appIpc';
import { registerDbIpc } from './dbIpc';
import { registerWorktreeIpc } from './worktreeIpc';
import { registerPtyIpc } from './ptyIpc';
import { registerGitIpc } from './gitIpc';
import { registerGithubIpc } from './githubIpc';
import { registerSkillsIpc } from './skillsIpc';
import { registerFsIpc } from './fsIpc';

export function registerAllIpc(): void {
  registerAppIpc();
  registerDbIpc();
  registerWorktreeIpc();
  registerPtyIpc();
  registerGitIpc();
  registerGithubIpc();
  registerSkillsIpc();
  registerFsIpc();
}
