import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronRight,
  Folder,
} from 'lucide-react';
import type { Skill } from '../../shared/types';

interface SkillEditorModalProps {
  skill: Skill;
  onClose: () => void;
  onDeleted: () => void;
  onSaved: () => void;
}

export function SkillEditorModal({ skill, onClose, onDeleted, onSaved }: SkillEditorModalProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    skill.files.includes('SKILL.md') ? 'SKILL.md' : (skill.files[0] ?? null),
  );
  const [content, setContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [files, setFiles] = useState<string[]>(skill.files);

  const loadFile = useCallback(
    async (fileName: string) => {
      setLoadingFile(true);
      setError(null);
      try {
        const resp = await window.electronAPI.skillsGetFile({ skillDir: skill.path, fileName });
        if (resp.success && resp.data !== undefined) {
          setContent(resp.data);
          setIsDirty(false);
        } else {
          setError(resp.error ?? 'Failed to load file');
        }
      } finally {
        setLoadingFile(false);
      }
    },
    [skill.path],
  );

  useEffect(() => {
    if (selectedFile) loadFile(selectedFile);
  }, [selectedFile, loadFile]);

  const handleSelectFile = (fileName: string) => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setSelectedFile(fileName);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await window.electronAPI.skillsWriteFile({
        skillDir: skill.path,
        fileName: selectedFile,
        content,
      });
      if (resp.success) {
        setIsDirty(false);
        onSaved();
      } else {
        setError(resp.error ?? 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const resp = await window.electronAPI.skillsDelete({ skillDir: skill.path });
      if (resp.success) {
        onDeleted();
      } else {
        setError(resp.error ?? 'Failed to delete skill');
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleAddFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    const resp = await window.electronAPI.skillsWriteFile({
      skillDir: skill.path,
      fileName: name,
      content: '',
    });
    if (resp.success) {
      const newFiles = [...files, name].sort();
      setFiles(newFiles);
      setNewFileName('');
      setShowAddFile(false);
      setSelectedFile(name);
      onSaved();
    } else {
      setError(resp.error ?? 'Failed to create file');
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;
    const resp = await window.electronAPI.skillsDeleteFile({
      skillDir: skill.path,
      fileName,
    });
    if (resp.success) {
      const newFiles = files.filter((f) => f !== fileName);
      setFiles(newFiles);
      if (selectedFile === fileName) {
        setSelectedFile(newFiles[0] ?? null);
      }
      onSaved();
    } else {
      setError(resp.error ?? 'Failed to delete file');
    }
  };

  // Build top-level items for the file tree
  const topLevelDirs = [
    ...new Set(files.filter((f) => f.includes('/')).map((f) => f.split('/')[0])),
  ];
  const topLevelFiles = files.filter((f) => !f.includes('/'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col rounded-xl border border-border/60 shadow-2xl shadow-black/50"
        style={{ background: 'hsl(var(--surface-1))', width: '780px', maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-border/40 flex-shrink-0">
          <Sparkles size={16} strokeWidth={1.8} className="text-primary/70" />
          <span className="text-[14px] font-medium text-foreground">{skill.name}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              skill.scope === 'global'
                ? 'bg-accent/60 text-muted-foreground/60'
                : 'bg-blue-500/10 text-blue-400/80'
            }`}
          >
            {skill.scope}
          </span>
          <span className="text-[11px] text-muted-foreground/30 font-mono truncate flex-1">
            {skill.path}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-1 rounded-md hover:bg-accent/60 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* File tree */}
          <div
            className="flex flex-col border-r border-border/40 flex-shrink-0"
            style={{ width: '200px' }}
          >
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
                Files
              </span>
              <button
                type="button"
                onClick={() => setShowAddFile(!showAddFile)}
                className="p-0.5 rounded hover:bg-accent/60 text-muted-foreground/40 hover:text-foreground transition-colors"
                title="Add file"
              >
                <Plus size={13} strokeWidth={2} />
              </button>
            </div>

            {showAddFile && (
              <div className="px-2 pb-2 flex gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddFile();
                    if (e.key === 'Escape') {
                      setShowAddFile(false);
                      setNewFileName('');
                    }
                  }}
                  placeholder="filename.md"
                  className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-background/50 border border-border/60 rounded focus:outline-none focus:border-primary/50"
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-1 px-1">
              {topLevelFiles.map((f) => (
                <div key={f} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => handleSelectFile(f)}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-0.5 text-left text-[12px] rounded transition-colors ${
                      selectedFile === f
                        ? 'bg-primary/15 text-foreground'
                        : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/40'
                    }`}
                  >
                    <FileText
                      size={12}
                      strokeWidth={1.8}
                      className="flex-shrink-0 text-muted-foreground/40"
                    />
                    <span className="truncate">{f}</span>
                  </button>
                  {f !== 'SKILL.md' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 rounded hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-all"
                    >
                      <Trash2 size={11} strokeWidth={2} />
                    </button>
                  )}
                </div>
              ))}
              {topLevelDirs.map((dir) => {
                const dirFiles = files.filter((f) => f.startsWith(dir + '/'));
                return (
                  <div key={dir}>
                    <div className="flex items-center gap-1 px-2 py-0.5 text-[12px] text-muted-foreground/50">
                      <ChevronRight size={11} strokeWidth={2} />
                      <Folder size={12} strokeWidth={1.8} className="text-muted-foreground/40" />
                      <span>{dir}</span>
                    </div>
                    {dirFiles.map((f) => {
                      const fname = f.split('/').pop()!;
                      return (
                        <div key={f} className="group flex items-center">
                          <button
                            type="button"
                            onClick={() => handleSelectFile(f)}
                            className={`flex-1 flex items-center gap-1.5 py-0.5 text-left text-[12px] rounded transition-colors ${
                              selectedFile === f
                                ? 'bg-primary/15 text-foreground'
                                : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/40'
                            }`}
                            style={{ paddingLeft: '20px' }}
                          >
                            <FileText
                              size={12}
                              strokeWidth={1.8}
                              className="flex-shrink-0 text-muted-foreground/40"
                            />
                            <span className="truncate">{fname}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(f)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 mr-1 rounded hover:bg-destructive/20 text-muted-foreground/30 hover:text-destructive transition-all"
                          >
                            <Trash2 size={11} strokeWidth={2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {files.length === 0 && (
                <p className="px-2 py-3 text-[11px] text-muted-foreground/30 text-center">
                  No files
                </p>
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col min-w-0">
            {loadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-muted-foreground/30" />
              </div>
            ) : selectedFile ? (
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setIsDirty(true);
                }}
                className="flex-1 p-4 text-[13px] font-mono bg-transparent text-foreground/90 resize-none focus:outline-none leading-relaxed"
                style={{ minHeight: 0 }}
                spellCheck={false}
                placeholder="Skill content..."
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[13px] text-muted-foreground/30">Select a file to edit</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border/40 flex-shrink-0">
          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-destructive/80 flex-1">
              <AlertCircle size={13} strokeWidth={2} />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-all duration-150 ${
              confirmDelete
                ? 'bg-destructive text-destructive-foreground hover:brightness-110'
                : 'text-destructive/60 hover:text-destructive hover:bg-destructive/10'
            }`}
          >
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} strokeWidth={2} />
            )}
            {confirmDelete ? 'Confirm Delete Skill' : 'Delete Skill'}
          </button>
          {confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-all duration-150"
            >
              Cancel
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-accent/60 transition-all duration-150"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedFile || !isDirty}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} strokeWidth={2} />
              )}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
