import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { TerminalPane } from './TerminalPane';
import type { Task, Project } from '@shared/types';

interface MultiTerminalGridProps {
  tasks: Task[];
  projects: Project[];
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  groupByProject?: boolean;
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

function TaskCell({
  task,
  project,
  showProject,
  taskActivity,
  isDragOver,
  onRemoveTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  task: Task;
  project: Project | undefined;
  showProject: boolean;
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  isDragOver: boolean;
  onRemoveTask?: (id: string) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="flex flex-col min-h-0 bg-background">
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className={`h-6 flex-shrink-0 flex items-center gap-1.5 px-2 border-b border-border/40 cursor-grab active:cursor-grabbing select-none transition-colors ${
          isDragOver ? 'bg-primary/15 border-primary/40' : ''
        }`}
        style={{ background: isDragOver ? undefined : 'hsl(var(--surface-1))' }}
      >
        <ActivityDot status={taskActivity[task.id]} />
        <span className="text-[11px] font-medium text-foreground truncate min-w-0">
          {task.name}
        </span>
        {showProject && project && (
          <>
            <span className="text-muted-foreground/30 text-[10px] flex-shrink-0">·</span>
            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 truncate max-w-[80px]">
              {project.name}
            </span>
          </>
        )}
        {onRemoveTask && (
          <button
            onClick={() => onRemoveTask(task.id)}
            className="flex-shrink-0 ml-auto p-px rounded hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-colors"
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
}

export function MultiTerminalGrid({
  tasks,
  projects,
  taskActivity,
  groupByProject = true,
  onRemoveTask,
}: MultiTerminalGridProps) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t.id));
  const draggedId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  function toggleProject(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

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

  function makeDragHandlers(taskId: string) {
    return {
      onDragStart: () => {
        draggedId.current = taskId;
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverId !== taskId) setDragOverId(taskId);
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = draggedId.current;
        const to = taskId;
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
      },
      onDragEnd: () => {
        draggedId.current = null;
        setDragOverId(null);
      },
    };
  }

  if (groupByProject) {
    // Build project groups in the order they first appear in orderedTasks
    const projectIdOrder: string[] = [];
    const tasksByProjectId: Record<string, Task[]> = {};
    for (const task of orderedTasks) {
      if (!tasksByProjectId[task.projectId]) {
        projectIdOrder.push(task.projectId);
        tasksByProjectId[task.projectId] = [];
      }
      tasksByProjectId[task.projectId].push(task);
    }

    return (
      <div className="h-full flex flex-col gap-[1px] bg-border/40 overflow-hidden">
        {projectIdOrder.map((projectId) => {
          const project = projects.find((p) => p.id === projectId);
          const groupTasks = tasksByProjectId[projectId];
          const collapsed = collapsedProjects.has(projectId);
          return (
            <div
              key={projectId}
              className={collapsed ? 'flex-shrink-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}
            >
              {/* Project section header */}
              <button
                onClick={() => toggleProject(projectId)}
                className="h-7 flex-shrink-0 flex items-center gap-2 px-3 border-b border-border/40 w-full text-left hover:bg-accent/30 transition-colors duration-100"
                style={{ background: 'hsl(var(--surface-2))' }}
              >
                {collapsed ? (
                  <ChevronRight
                    size={11}
                    strokeWidth={2}
                    className="text-muted-foreground/40 flex-shrink-0"
                  />
                ) : (
                  <ChevronDown
                    size={11}
                    strokeWidth={2}
                    className="text-muted-foreground/40 flex-shrink-0"
                  />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                  {project?.name ?? projectId}
                </span>
                <span className="text-[10px] text-muted-foreground/30">
                  {groupTasks.length} {groupTasks.length === 1 ? 'terminal' : 'terminals'}
                </span>
              </button>
              {/* Tasks grid within project */}
              {!collapsed && (
                <div
                  className={`flex-1 min-h-0 grid ${gridColsClass(groupTasks.length)} gap-[1px] bg-border/40`}
                >
                  {groupTasks.map((task) => (
                    <TaskCell
                      key={task.id}
                      task={task}
                      project={project}
                      showProject={false}
                      taskActivity={taskActivity}
                      isDragOver={dragOverId === task.id}
                      onRemoveTask={onRemoveTask}
                      {...makeDragHandlers(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Flat grid
  return (
    <div className={`h-full grid ${gridColsClass(orderedTasks.length)} gap-[1px] bg-border/40`}>
      {orderedTasks.map((task) => (
        <TaskCell
          key={task.id}
          task={task}
          project={projects.find((p) => p.id === task.projectId)}
          showProject
          taskActivity={taskActivity}
          isDragOver={dragOverId === task.id}
          onRemoveTask={onRemoveTask}
          {...makeDragHandlers(task.id)}
        />
      ))}
    </div>
  );
}
