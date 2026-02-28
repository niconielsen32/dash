import { ipcMain, BrowserWindow } from 'electron';
import * as fs from 'fs';
import { SkillsService } from '../services/SkillsService';

// ── Skills directory watcher ─────────────────────────────────
const SKILLS_DEBOUNCE_MS = 600;
interface SkillWatchEntry { watcher: fs.FSWatcher; timer: ReturnType<typeof setTimeout> | null }
const skillWatchers = new Map<string, SkillWatchEntry>();

function watchSkillsDir(id: string, dir: string): void {
  if (skillWatchers.has(id)) return;
  try {
    const watcher = fs.watch(dir, { recursive: true }, () => {
      const entry = skillWatchers.get(id);
      if (!entry) return;
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(() => {
        entry.timer = null;
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) win.webContents.send('skills:changed');
        }
      }, SKILLS_DEBOUNCE_MS);
    });
    watcher.on('error', () => { unwatchSkillsDir(id); });
    skillWatchers.set(id, { watcher, timer: null });
  } catch { /* dir doesn't exist yet */ }
}

function unwatchSkillsDir(id: string): void {
  const entry = skillWatchers.get(id);
  if (!entry) return;
  if (entry.timer) clearTimeout(entry.timer);
  try { entry.watcher.close(); } catch { /* already closed */ }
  skillWatchers.delete(id);
}

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

  ipcMain.handle(
    'skills:moveSkill',
    async (_event, args: { oldDir: string; newDir: string }) => {
      try {
        await SkillsService.moveSkill(args.oldDir, args.newDir);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    'skills:watchDirs',
    async (_event, args: { globalDir: string; projectDir?: string }) => {
      try {
        watchSkillsDir('skills:global', args.globalDir);
        if (args.projectDir) watchSkillsDir('skills:project', args.projectDir);
        else unwatchSkillsDir('skills:project');
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  );
}
