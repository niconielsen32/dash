import React from 'react';
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
  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground/50">
          No active sessions — open a task to see it here
        </p>
      </div>
    );
  }

  const colsClass = gridColsClass(tasks.length);

  return (
    <div className={`h-full grid ${colsClass} gap-[1px] bg-border/40`}>
      {tasks.map((task) => {
        const project = projects.find((p) => p.id === task.projectId);
        return (
          <div key={task.id} className="flex flex-col min-h-0 bg-background">
            <div
              className="h-6 flex-shrink-0 flex items-center gap-1.5 px-2 border-b border-border/40"
              style={{ background: 'hsl(var(--surface-1))' }}
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
