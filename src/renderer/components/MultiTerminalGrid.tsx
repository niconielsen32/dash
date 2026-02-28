import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { TerminalPane } from './TerminalPane';
import type { Task, Project } from '@shared/types';

interface MultiTerminalGridProps {
  tasks: Task[];
  projects: Project[];
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  onRemoveTask?: (taskId: string) => void;
}

function gridColsClass(count: number): string {
  if (count <= 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

function ActivityDot({ status }: { status: 'busy' | 'idle' | 'waiting' | undefined }) {
  if (!status) return null;
  const cls =
    status === 'waiting'
      ? 'bg-orange-500'
      : status === 'busy'
        ? 'bg-amber-400 status-pulse'
        : 'bg-emerald-400';
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cls}`} />;
}

export function MultiTerminalGrid({
  tasks,
  projects,
  taskActivity,
  onRemoveTask,
}: MultiTerminalGridProps) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t.id));
  const draggedId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Sync order when tasks are added or removed
  useEffect(() => {
    setOrder((prev) => {
      const taskIds = new Set(tasks.map((t) => t.id));
      const kept = prev.filter((id) => taskIds.has(id));
      const added = tasks.map((t) => t.id).filter((id) => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground/50">
          No active sessions — open a task to see it here
        </p>
      </div>
    );
  }

  const orderedTasks = order.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[];

  const colsClass = gridColsClass(orderedTasks.length);

  return (
    <div className={`h-full grid ${colsClass} gap-[1px] bg-border/40`}>
      {orderedTasks.map((task) => {
        const project = projects.find((p) => p.id === task.projectId);
        const isDragOver = dragOverId === task.id;
        return (
          <div key={task.id} className="flex flex-col min-h-0 bg-background">
            <div
              draggable
              onDragStart={(e) => {
                draggedId.current = task.id;
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== task.id) setDragOverId(task.id);
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => {
                e.preventDefault();
                const from = draggedId.current;
                const to = task.id;
                if (from && from !== to) {
                  setOrder((prev) => {
                    const next = [...prev];
                    const fi = next.indexOf(from);
                    const ti = next.indexOf(to);
                    next.splice(fi, 1);
                    next.splice(ti, 0, from);
                    return next;
                  });
                }
                draggedId.current = null;
                setDragOverId(null);
              }}
              onDragEnd={() => {
                draggedId.current = null;
                setDragOverId(null);
              }}
              className={`h-6 flex-shrink-0 flex items-center gap-1.5 px-2 border-b border-border/40 cursor-grab active:cursor-grabbing select-none transition-colors ${
                isDragOver ? 'bg-primary/15 border-primary/40' : ''
              }`}
              style={{ background: isDragOver ? undefined : 'hsl(var(--surface-1))' }}
            >
              <ActivityDot status={taskActivity[task.id]} />
              <span className="text-[11px] font-medium text-foreground truncate flex-1 min-w-0">
                {task.name}
              </span>
              {project && (
                <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 truncate max-w-[80px]">
                  {project.name}
                </span>
              )}
              {onRemoveTask && (
                <button
                  onClick={() => onRemoveTask(task.id)}
                  className="flex-shrink-0 ml-1 p-px rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-colors"
                  title="Remove from grid"
                  draggable={false}
                >
                  <X size={11} strokeWidth={2} />
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <TerminalPane id={task.id} cwd={task.path} autoApprove={task.autoApprove} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
