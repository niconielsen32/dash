import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { Skill } from '@shared/types';

const execFileAsync = promisify(execFile);
const AGR_TIMEOUT_MS = 30_000;

export class SkillsService {
  static globalSkillsPath(): string {
    return path.join(os.homedir(), '.claude', 'skills');
  }

  static projectSkillsPath(projectPath: string): string {
    return path.join(projectPath, '.claude', 'skills');
  }

  static getSkillsDir(scope: 'global' | 'project', projectPath?: string): string {
    if (scope === 'project' && projectPath) {
      return this.projectSkillsPath(projectPath);
    }
    return this.globalSkillsPath();
  }

  static parseSkillMd(content: string): { name: string; description: string } {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return { name: '', description: '' };

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch?.[1]?.trim() ?? '',
      description: descMatch?.[1]?.trim() ?? '',
    };
  }

  static async listSkillFiles(skillDir: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string, prefix: string): Promise<void> {
      let entries: Awaited<ReturnType<typeof fs.readdir>>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), rel);
        } else {
          files.push(rel);
        }
      }
    }

    await walk(skillDir, '');
    return files.sort();
  }

  static async listSkillsInDir(
    skillsDir: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<Skill[]> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(skillsDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const skills: Skill[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      let content = '';
      try {
        content = await fs.readFile(skillMdPath, 'utf-8');
      } catch {
        // No SKILL.md — skip
        continue;
      }

      const { name, description } = this.parseSkillMd(content);
      const files = await this.listSkillFiles(skillDir);

      skills.push({
        id: entry.name,
        name: name || entry.name,
        description,
        scope,
        projectPath: scope === 'project' ? projectPath : undefined,
        path: skillDir,
        files,
      });
    }

    return skills;
  }

  static async listSkills(projectPath?: string): Promise<Skill[]> {
    const globalSkills = await this.listSkillsInDir(this.globalSkillsPath(), 'global');

    let projectSkills: Skill[] = [];
    if (projectPath) {
      projectSkills = await this.listSkillsInDir(
        this.projectSkillsPath(projectPath),
        'project',
        projectPath,
      );
    }

    return [...globalSkills, ...projectSkills];
  }

  static async getSkillFile(skillDir: string, fileName: string): Promise<string> {
    const filePath = path.join(skillDir, fileName);
    return fs.readFile(filePath, 'utf-8');
  }

  static async writeSkillFile(skillDir: string, fileName: string, content: string): Promise<void> {
    const filePath = path.join(skillDir, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  static async createSkill(
    skillId: string,
    name: string,
    description: string,
    content: string,
    skillsDir: string,
  ): Promise<Skill> {
    const skillDir = path.join(skillsDir, skillId);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
    const files = await this.listSkillFiles(skillDir);

    return {
      id: skillId,
      name,
      description,
      scope: skillsDir === this.globalSkillsPath() ? 'global' : 'project',
      path: skillDir,
      files,
    };
  }

  static async deleteSkill(skillDir: string): Promise<void> {
    await fs.rm(skillDir, { recursive: true, force: true });
  }

  static async deleteSkillFile(skillDir: string, fileName: string): Promise<void> {
    const filePath = path.join(skillDir, fileName);
    await fs.unlink(filePath);
  }

  static async isAgrAvailable(): Promise<boolean> {
    try {
      await execFileAsync('agr', ['--version'], {
        timeout: 5_000,
        env: process.env as Record<string, string>,
      });
      return true;
    } catch {
      return false;
    }
  }

  static async agrInstall(
    handle: string,
    scope: 'global' | 'project',
    projectPath?: string,
  ): Promise<void> {
    const args = ['add'];
    if (scope === 'global') {
      args.push('-g');
    }
    args.push(handle);

    const cwd = scope === 'project' && projectPath ? projectPath : os.homedir();

    await execFileAsync('agr', args, {
      cwd,
      timeout: AGR_TIMEOUT_MS,
      env: process.env as Record<string, string>,
    });
  }
}
