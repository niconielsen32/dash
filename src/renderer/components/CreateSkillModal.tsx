import React, { useState, useEffect } from 'react';
import { X, Sparkles, Download, Loader2, AlertCircle, Globe, FolderOpen } from 'lucide-react';
import type { Skill } from '../../shared/types';

interface CreateSkillModalProps {
  activeProjectPath: string | null;
  agrAvailable: boolean;
  onClose: () => void;
  onCreated: (skill: Skill) => void;
  onAgrInstalled: () => void;
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDefaultContent(name: string, description: string): string {
  const title = name || 'My Skill';
  return `---
name: ${toKebabCase(name) || 'my-skill'}
description: ${description || 'Describe when Claude should use this skill'}
---

# ${title}

## Instructions

[Describe what Claude should do when this skill is triggered]

## Examples

[Add concrete usage examples here]
`;
}

type Tab = 'create' | 'agr';

export function CreateSkillModal({
  activeProjectPath,
  agrAvailable,
  onClose,
  onCreated,
  onAgrInstalled,
}: CreateSkillModalProps) {
  const [tab, setTab] = useState<Tab>('create');

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const [content, setContent] = useState(() => buildDefaultContent('', ''));
  const [contentExpanded, setContentExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // agr install state
  const [agrHandle, setAgrHandle] = useState('');
  const [agrScope, setAgrScope] = useState<'global' | 'project'>('global');
  const [agrInstalling, setAgrInstalling] = useState(false);
  const [agrError, setAgrError] = useState<string | null>(null);
  const [agrSuccess, setAgrSuccess] = useState(false);

  const skillId = toKebabCase(name);
  const savePath =
    scope === 'global'
      ? `~/.claude/skills/${skillId || '<name>'}`
      : activeProjectPath
        ? `.claude/skills/${skillId || '<name>'}`
        : null;

  useEffect(() => {
    setContent(buildDefaultContent(name, description));
  }, [name, description]);

  const handleCreate = async () => {
    if (!skillId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const resp = await window.electronAPI.skillsCreate({
        skillId,
        name: name.trim(),
        description: description.trim(),
        content,
        scope,
        projectPath: scope === 'project' ? (activeProjectPath ?? undefined) : undefined,
      });
      if (resp.success && resp.data) {
        onCreated(resp.data);
      } else {
        setCreateError(resp.error ?? 'Failed to create skill');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAgrInstall = async () => {
    if (!agrHandle.trim()) return;
    setAgrInstalling(true);
    setAgrError(null);
    setAgrSuccess(false);
    try {
      const resp = await window.electronAPI.skillsAgrInstall({
        handle: agrHandle.trim(),
        scope: agrScope,
        projectPath: agrScope === 'project' ? (activeProjectPath ?? undefined) : undefined,
      });
      if (resp.success) {
        setAgrSuccess(true);
        onAgrInstalled();
      } else {
        setAgrError(resp.error ?? 'Installation failed');
      }
    } finally {
      setAgrInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col rounded-xl border border-border/60 shadow-2xl shadow-black/50"
        style={{ background: 'hsl(var(--surface-1))', width: '520px', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/40">
          <Sparkles size={16} strokeWidth={1.8} className="text-primary/70" />
          <span className="text-[14px] font-medium text-foreground">Add Skill</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 rounded-md hover:bg-accent/60 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-5 pt-3 pb-0 border-b border-border/30">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
              tab === 'create'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground/50 hover:text-foreground'
            }`}
          >
            Create new
          </button>
          {agrAvailable && (
            <button
              type="button"
              onClick={() => setTab('agr')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                tab === 'agr'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground/50 hover:text-foreground'
              }`}
            >
              <Download size={12} strokeWidth={2} />
              Install from agr
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'create' ? (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground/60 mb-1.5">
                  Skill name
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !creating && skillId && handleCreate()}
                  placeholder="e.g. Commit Helper, Code Reviewer..."
                  className="w-full px-3 py-2 text-[13px] bg-background/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary/50 transition-colors"
                />
                {skillId && (
                  <p className="mt-1 text-[11px] text-muted-foreground/40 font-mono">
                    ID: {skillId}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground/60 mb-1.5">
                  Description{' '}
                  <span className="text-muted-foreground/30 font-normal">
                    (when should Claude use this?)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Use when creating git commits or writing commit messages..."
                  rows={2}
                  maxLength={1024}
                  className="w-full px-3 py-2 text-[13px] bg-background/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary/50 transition-colors resize-none"
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground/30 text-right">
                  {description.length}/1024
                </p>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-[12px] font-medium text-muted-foreground/60 mb-2">
                  Scope
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setScope('global')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-all duration-150 ${
                      scope === 'global'
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-foreground'
                    }`}
                  >
                    <Globe size={13} strokeWidth={1.8} />
                    Global
                    <span className="text-[10px] text-muted-foreground/40 font-mono">~/.claude/skills/</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => activeProjectPath && setScope('project')}
                    disabled={!activeProjectPath}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                      scope === 'project'
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-foreground'
                    }`}
                  >
                    <FolderOpen size={13} strokeWidth={1.8} />
                    Project
                    <span className="text-[10px] text-muted-foreground/40 font-mono">.claude/skills/</span>
                  </button>
                </div>
                {savePath && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground/30 font-mono">
                    {savePath}/SKILL.md
                  </p>
                )}
              </div>

              {/* Content (expandable) */}
              <div>
                <button
                  type="button"
                  onClick={() => setContentExpanded(!contentExpanded)}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <span>{contentExpanded ? '▾' : '▸'}</span>
                  Edit SKILL.md content
                </button>
                {contentExpanded && (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    className="mt-2 w-full px-3 py-2 text-[12px] font-mono bg-background/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary/50 transition-colors resize-y"
                    spellCheck={false}
                  />
                )}
              </div>

              {createError && (
                <div className="flex items-center gap-1.5 text-[12px] text-destructive/80">
                  <AlertCircle size={13} strokeWidth={2} />
                  {createError}
                </div>
              )}
            </div>
          ) : (
            /* agr install tab */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-accent/20 border border-border/30">
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                  Install community skills from GitHub using{' '}
                  <code className="font-mono text-foreground/70">agr</code>. Skills are installed
                  directly into your skills directory.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground/60 mb-1.5">
                  Handle
                </label>
                <input
                  autoFocus={tab === 'agr'}
                  type="text"
                  value={agrHandle}
                  onChange={(e) => setAgrHandle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !agrInstalling && handleAgrInstall()}
                  placeholder="username/skill-name"
                  className="w-full px-3 py-2 text-[13px] font-mono bg-background/50 border border-border/60 rounded-lg focus:outline-none focus:border-primary/50 transition-colors"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/30">
                  Formats: <code className="font-mono">username/skill</code> ·{' '}
                  <code className="font-mono">username/repo/skill</code>
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-muted-foreground/60 mb-2">
                  Install to
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAgrScope('global')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-all duration-150 ${
                      agrScope === 'global'
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-foreground'
                    }`}
                  >
                    <Globe size={13} strokeWidth={1.8} />
                    Global
                  </button>
                  <button
                    type="button"
                    onClick={() => activeProjectPath && setAgrScope('project')}
                    disabled={!activeProjectPath}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                      agrScope === 'project'
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-foreground'
                    }`}
                  >
                    <FolderOpen size={13} strokeWidth={1.8} />
                    Project
                  </button>
                </div>
              </div>

              {agrError && (
                <div className="flex items-center gap-1.5 text-[12px] text-destructive/80">
                  <AlertCircle size={13} strokeWidth={2} />
                  {agrError}
                </div>
              )}
              {agrSuccess && (
                <div className="flex items-center gap-1.5 text-[12px] text-green-400/80">
                  Skill installed successfully!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-all duration-150"
          >
            {agrSuccess ? 'Close' : 'Cancel'}
          </button>
          {tab === 'create' ? (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !skillId}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              {creating && <Loader2 size={13} className="animate-spin" />}
              Create Skill
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAgrInstall}
              disabled={agrInstalling || !agrHandle.trim() || agrSuccess}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              {agrInstalling ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Download size={13} strokeWidth={2} />
              )}
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
