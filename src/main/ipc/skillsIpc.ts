import { ipcMain } from 'electron';
import { SkillsService } from '../services/SkillsService';

export function registerSkillsIpc(): void {
  ipcMain.handle('skills:list', async (_event, args: { projectPath?: string }) => {
    try {
      const skills = await SkillsService.listSkills(args?.projectPath);
      return { success: true, data: skills };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(
    'skills:getFile',
    async (_event, args: { skillDir: string; fileName: string }) => {
      try {
        const content = await SkillsService.getSkillFile(args.skillDir, args.fileName);
        return { success: true, data: content };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'skills:create',
    async (
      _event,
      args: {
        skillId: string;
        name: string;
        description: string;
        content: string;
        scope: 'global' | 'project';
        projectPath?: string;
      },
    ) => {
      try {
        const skillsDir = SkillsService.getSkillsDir(args.scope, args.projectPath);
        const skill = await SkillsService.createSkill(
          args.skillId,
          args.name,
          args.description,
          args.content,
          skillsDir,
        );
        return { success: true, data: skill };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'skills:writeFile',
    async (_event, args: { skillDir: string; fileName: string; content: string }) => {
      try {
        await SkillsService.writeSkillFile(args.skillDir, args.fileName, args.content);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle('skills:delete', async (_event, args: { skillDir: string }) => {
    try {
      await SkillsService.deleteSkill(args.skillDir);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(
    'skills:deleteFile',
    async (_event, args: { skillDir: string; fileName: string }) => {
      try {
        await SkillsService.deleteSkillFile(args.skillDir, args.fileName);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'skills:getDir',
    async (_event, args: { scope: 'global' | 'project'; projectPath?: string }) => {
      try {
        const dir = SkillsService.getSkillsDir(args.scope, args.projectPath);
        return { success: true, data: dir };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle('skills:agrCheck', async () => {
    try {
      const available = await SkillsService.isAgrAvailable();
      return { success: true, data: available };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle(
    'skills:agrInstall',
    async (
      _event,
      args: { handle: string; scope: 'global' | 'project'; projectPath?: string },
    ) => {
      try {
        await SkillsService.agrInstall(args.handle, args.scope, args.projectPath);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );
}
