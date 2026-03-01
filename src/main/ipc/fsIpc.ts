import { ipcMain } from 'electron';
import { readdir, stat, copyFile, readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve, relative } from 'path';
import { existsSync } from 'fs';
import type { DirectoryEntry } from '@shared/types';

const IGNORED = new Set(['node_modules', '.git', '.DS_Store', '__pycache__', '.Trash']);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.svg',
  '.mp3',
  '.mp4',
  '.wav',
  '.ogg',
  '.webm',
  '.mov',
  '.avi',
  '.zip',
  '.tar',
  '.gz',
  '.bz2',
  '.7z',
  '.rar',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.o',
  '.a',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.sqlite',
  '.db',
]);

function isWithinCwd(cwd: string, target: string): boolean {
  const resolvedCwd = resolve(cwd);
  const resolvedTarget = resolve(target);
  return resolvedTarget === resolvedCwd || resolvedTarget.startsWith(resolvedCwd + '/');
}

function isBinaryExtension(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function registerFsIpc(): void {
  // Read one level of a directory
  ipcMain.handle('fs:readDir', async (_event, args: { cwd: string; relativePath?: string }) => {
    try {
      const targetDir = args.relativePath
        ? resolve(args.cwd, args.relativePath)
        : resolve(args.cwd);

      if (!isWithinCwd(args.cwd, targetDir)) {
        return { success: false, error: 'Path traversal denied' };
      }

      const entries = await readdir(targetDir, { withFileTypes: true });
      const results: DirectoryEntry[] = [];

      for (const entry of entries) {
        if (IGNORED.has(entry.name)) continue;

        const fullPath = join(targetDir, entry.name);
        const relPath = relative(resolve(args.cwd), fullPath);

        results.push({
          name: entry.name,
          path: relPath,
          isDirectory: entry.isDirectory(),
        });
      }

      // Directories first, then alphabetical (case-insensitive)
      results.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });

      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Read file contents
  ipcMain.handle('fs:readFile', async (_event, args: { cwd: string; relativePath: string }) => {
    try {
      const fullPath = resolve(args.cwd, args.relativePath);
      if (!isWithinCwd(args.cwd, fullPath)) {
        return { success: false, error: 'Path traversal denied' };
      }
      if (!existsSync(fullPath)) {
        return { success: false, error: 'File not found' };
      }

      if (isBinaryExtension(fullPath)) {
        return { success: false, error: 'Binary file — cannot edit' };
      }

      const s = await stat(fullPath);
      if (s.size > MAX_FILE_SIZE) {
        return { success: false, error: 'File too large (>2MB)' };
      }

      const content = await readFile(fullPath, 'utf-8');
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Write file contents
  ipcMain.handle(
    'fs:writeFile',
    async (_event, args: { cwd: string; relativePath: string; content: string }) => {
      try {
        const fullPath = resolve(args.cwd, args.relativePath);
        if (!isWithinCwd(args.cwd, fullPath)) {
          return { success: false, error: 'Path traversal denied' };
        }

        await writeFile(fullPath, args.content, 'utf-8');
        return { success: true, data: null };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  // Copy a file into a directory (drag-drop from Finder)
  ipcMain.handle(
    'fs:copyFile',
    async (
      _event,
      args: { cwd: string; sourcePath: string; destDir: string; fileName: string },
    ) => {
      try {
        const destPath = join(args.destDir, args.fileName);

        if (!isWithinCwd(args.cwd, destPath)) {
          return { success: false, error: 'Destination outside project' };
        }
        if (!existsSync(args.sourcePath)) {
          return { success: false, error: 'Source file not found' };
        }
        if (!existsSync(args.destDir)) {
          return { success: false, error: 'Destination directory does not exist' };
        }
        if (existsSync(destPath)) {
          return { success: false, error: 'File already exists at destination' };
        }

        await copyFile(args.sourcePath, destPath);
        return { success: true, data: null };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  // Create a new directory
  ipcMain.handle('fs:createDir', async (_event, args: { cwd: string; relativePath: string }) => {
    try {
      const fullPath = resolve(args.cwd, args.relativePath);
      if (!isWithinCwd(args.cwd, fullPath)) {
        return { success: false, error: 'Path traversal denied' };
      }
      if (existsSync(fullPath)) {
        return { success: false, error: 'Directory already exists' };
      }

      await mkdir(fullPath, { recursive: true });
      return { success: true, data: null };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
