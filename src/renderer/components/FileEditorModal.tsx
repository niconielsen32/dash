import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, Loader2, FileText } from 'lucide-react';

interface FileEditorModalProps {
  cwd: string;
  relativePath: string;
  onClose: () => void;
}

export function FileEditorModal({ cwd, relativePath, onClose }: FileEditorModalProps) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;
  const fileName = relativePath.split('/').pop() || relativePath;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await window.electronAPI.fsReadFile({ cwd, relativePath });
        if (resp.success && resp.data !== undefined) {
          setContent(resp.data);
          setSavedContent(resp.data);
        } else {
          setError(resp.error || 'Failed to read file');
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [cwd, relativePath]);

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await window.electronAPI.fsWriteFile({ cwd, relativePath, content });
      if (resp.success) {
        setSavedContent(content);
      } else {
        setError(resp.error || 'Failed to save file');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [cwd, relativePath, content, isDirty, saving]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 's' && e.metaKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border/60 rounded-xl shadow-2xl shadow-black/40 w-[92vw] max-w-5xl h-[85vh] flex flex-col animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-12 border-b border-border/60 flex-shrink-0"
          style={{ background: 'hsl(var(--surface-2))' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <FileText
              size={14}
              className="text-muted-foreground/50 flex-shrink-0"
              strokeWidth={1.8}
            />
            <span className="text-[13px] font-medium text-foreground truncate">{fileName}</span>
            <span className="text-[11px] text-muted-foreground/40 truncate">{relativePath}</span>
            {isDirty && (
              <span
                className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
                title="Unsaved changes"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-[11px] text-destructive truncate max-w-[300px]">{error}</span>
            )}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium transition-colors bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={11} strokeWidth={2} className="animate-spin" />
              ) : (
                <Save size={11} strokeWidth={2} />
              )}
              Save
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-all duration-150"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={16} className="animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="w-full h-full resize-none bg-transparent text-[13px] leading-[20px] font-mono px-5 py-4 focus:outline-none text-foreground/90"
              style={{ tabSize: 2 }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
