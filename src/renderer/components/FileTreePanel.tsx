import React, { useState, useEffect, useCallback, useRef } from 'react';
import { File, Folder, FolderOpen, FolderPlus, ChevronRight, ChevronDown } from 'lucide-react';
import type { DirectoryEntry } from '../../shared/types';

interface FileTreePanelProps {
  cwd: string;
  fileChangeVersion: number;
  onOpenFile: (relativePath: string) => void;
  createRootFolderTrigger?: number;
}

interface TreeNode {
  entry: DirectoryEntry;
  children: TreeNode[] | null;
  loading: boolean;
}

function TreeNodeRow({
  node,
  depth,
  cwd,
  expandedPaths,
  onToggle,
  onFileClick,
  onDrop,
  fetchChildren,
  onCreateFolder,
}: {
  node: TreeNode;
  depth: number;
  cwd: string;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
  onDrop: (e: React.DragEvent, targetDir: string) => void;
  fetchChildren: (relativePath: string) => Promise<TreeNode[]>;
  onCreateFolder: (parentPath: string) => void;
}) {
  const [children, setChildren] = useState<TreeNode[] | null>(node.children);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const isExpanded = expandedPaths.has(node.entry.path);

  useEffect(() => {
    if (isExpanded && node.entry.isDirectory && !children) {
      setLoading(true);
      fetchChildren(node.entry.path)
        .then((c) => {
          setChildren(c);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isExpanded]);

  // Re-fetch children when parent signals a refresh
  useEffect(() => {
    if (isExpanded && node.entry.isDirectory && children) {
      fetchChildren(node.entry.path)
        .then((c) => setChildren(c))
        .catch(() => {});
    }
  }, [node]);

  const paddingLeft = 8 + depth * 16;

  if (node.entry.isDirectory) {
    return (
      <>
        <div
          className={`group flex items-center gap-1.5 py-[4px] pr-1 rounded-md text-[13px] cursor-pointer hover:bg-accent/50 transition-colors duration-100 ${
            isDragOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''
          }`}
          style={{ paddingLeft }}
          onClick={() => onToggle(node.entry.path)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            setIsDragOver(false);
            onDrop(e, node.entry.path);
          }}
        >
          {isExpanded ? (
            <ChevronDown
              size={12}
              strokeWidth={2}
              className="text-muted-foreground/60 flex-shrink-0"
            />
          ) : (
            <ChevronRight
              size={12}
              strokeWidth={2}
              className="text-muted-foreground/60 flex-shrink-0"
            />
          )}
          {isExpanded ? (
            <FolderOpen size={14} strokeWidth={1.8} className="text-primary/70 flex-shrink-0" />
          ) : (
            <Folder size={14} strokeWidth={1.8} className="text-primary/70 flex-shrink-0" />
          )}
          <span className="truncate text-foreground/90 flex-1">{node.entry.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateFolder(node.entry.path);
            }}
            className="opacity-0 group-hover:opacity-100 p-[2px] rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-all duration-100 flex-shrink-0"
            title="New folder"
          >
            <FolderPlus size={11} strokeWidth={2} />
          </button>
        </div>
        {isExpanded &&
          children &&
          children.map((child) => (
            <TreeNodeRow
              key={child.entry.path}
              node={child}
              depth={depth + 1}
              cwd={cwd}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onFileClick={onFileClick}
              onDrop={onDrop}
              fetchChildren={fetchChildren}
              onCreateFolder={onCreateFolder}
            />
          ))}
        {isExpanded && loading && (
          <div style={{ paddingLeft: paddingLeft + 16 }} className="py-1">
            <span className="text-[11px] text-muted-foreground/40">Loading...</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="group flex items-center gap-1.5 py-[4px] rounded-md text-[13px] cursor-pointer hover:bg-accent/50 transition-colors duration-100"
      style={{ paddingLeft: paddingLeft + 14 }}
      onClick={() => onFileClick(node.entry.path)}
    >
      <File size={14} strokeWidth={1.8} className="text-muted-foreground/50 flex-shrink-0" />
      <span className="truncate text-foreground/90">{node.entry.name}</span>
    </div>
  );
}

export function FileTreePanel({
  cwd,
  fileChangeVersion,
  onOpenFile,
  createRootFolderTrigger,
}: FileTreePanelProps) {
  const [rootChildren, setRootChildren] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState<{
    parentPath: string;
    value: string;
  } | null>(null);
  const expandedPaths = useRef<Set<string>>(new Set());
  const versionRef = useRef(0);

  const fetchChildren = useCallback(
    async (relativePath: string): Promise<TreeNode[]> => {
      const resp = await window.electronAPI.fsReadDir({ cwd, relativePath });
      if (resp.success && resp.data) {
        return resp.data.map((entry) => ({
          entry,
          children: null,
          loading: false,
        }));
      }
      return [];
    },
    [cwd],
  );

  const loadRoot = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await window.electronAPI.fsReadDir({ cwd });
      if (resp.success && resp.data) {
        setRootChildren(
          resp.data.map((entry) => ({
            entry,
            children: null,
            loading: false,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [cwd]);

  useEffect(() => {
    expandedPaths.current.clear();
    loadRoot();
  }, [cwd, loadRoot]);

  useEffect(() => {
    if (fileChangeVersion > versionRef.current) {
      versionRef.current = fileChangeVersion;
      loadRoot();
    }
  }, [fileChangeVersion, loadRoot]);

  useEffect(() => {
    if (createRootFolderTrigger && createRootFolderTrigger > 0) {
      setNewFolderInput({ parentPath: '', value: '' });
    }
  }, [createRootFolderTrigger]);

  function toggleDirectory(path: string) {
    if (expandedPaths.current.has(path)) {
      expandedPaths.current.delete(path);
    } else {
      expandedPaths.current.add(path);
    }
    // Force re-render
    setRootChildren((prev) => (prev ? [...prev] : prev));
  }

  async function handleDrop(e: React.DragEvent, targetDirRelativePath: string) {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files) as (globalThis.File & { path: string })[];
    if (files.length === 0) return;

    const destDir = targetDirRelativePath ? `${cwd}/${targetDirRelativePath}` : cwd;

    for (const file of files) {
      if (file.path) {
        await window.electronAPI.fsCopyFile({
          cwd,
          sourcePath: file.path,
          destDir,
          fileName: file.name,
        });
      }
    }
  }

  function handleCreateFolder(parentPath: string) {
    setNewFolderInput({ parentPath, value: '' });
  }

  async function submitNewFolder() {
    if (!newFolderInput || !newFolderInput.value.trim()) {
      setNewFolderInput(null);
      return;
    }
    const relativePath = newFolderInput.parentPath
      ? `${newFolderInput.parentPath}/${newFolderInput.value.trim()}`
      : newFolderInput.value.trim();

    const resp = await window.electronAPI.fsCreateDir({ cwd, relativePath });
    if (resp.success) {
      // Expand the parent so the new folder is visible
      if (newFolderInput.parentPath) {
        expandedPaths.current.add(newFolderInput.parentPath);
      }
      loadRoot();
    }
    setNewFolderInput(null);
  }

  if (loading && !rootChildren) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[11px] text-muted-foreground/40">Loading...</p>
      </div>
    );
  }

  if (!rootChildren || rootChildren.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Folder size={14} className="text-foreground/50" strokeWidth={1.5} />
        <p className="text-[11px] text-foreground/60">Empty directory</p>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 overflow-y-auto px-1 py-1 ${isDragOverRoot ? 'bg-primary/5' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOverRoot(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragOverRoot(false);
      }}
      onDrop={(e) => {
        setIsDragOverRoot(false);
        handleDrop(e, '');
      }}
    >
      {rootChildren.map((node) => (
        <TreeNodeRow
          key={node.entry.path}
          node={node}
          depth={0}
          cwd={cwd}
          expandedPaths={expandedPaths.current}
          onToggle={toggleDirectory}
          onFileClick={onOpenFile}
          onDrop={handleDrop}
          fetchChildren={fetchChildren}
          onCreateFolder={handleCreateFolder}
        />
      ))}

      {/* Inline new folder input */}
      {newFolderInput && (
        <div className="flex items-center gap-1.5 px-2 py-1 mt-1">
          <FolderPlus size={12} strokeWidth={1.8} className="text-primary/70 flex-shrink-0" />
          <input
            autoFocus
            value={newFolderInput.value}
            onChange={(e) => setNewFolderInput({ ...newFolderInput, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNewFolder();
              if (e.key === 'Escape') setNewFolderInput(null);
            }}
            onBlur={submitNewFolder}
            placeholder="Folder name..."
            className="flex-1 text-[12px] bg-background/60 border border-border/60 rounded px-1.5 py-0.5 focus:outline-none focus:border-primary/40 placeholder:text-muted-foreground/30"
          />
        </div>
      )}
    </div>
  );
}
