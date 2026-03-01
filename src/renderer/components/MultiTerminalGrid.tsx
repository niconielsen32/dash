import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { TerminalPane } from './TerminalPane';
import { BrowserPane } from './BrowserPane';
import type { Task, Project } from '@shared/types';

interface MultiTerminalGridProps {
  tasks: Task[];
  projects: Project[];
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  groupByProject?: boolean;
  onRemoveTask?: (taskId: string) => void;
  browserPanes?: string[];
  browserTitles?: Record<string, string>;
  onRemoveBrowserPane?: (id: string) => void;
  onBrowserTitleChange?: (id: string, title: string) => void;
}

function gridColsCount(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function gridColsClass(count: number): string {
  const n = gridColsCount(count);
  if (n === 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-2';
  if (n === 3) return 'grid-cols-3';
  return 'grid-cols-4';
}

/**
 * Items in the last complete row that sit beyond the partial last row
 * should span down to fill the empty cells below them.
 */
function cellSpanStyle(index: number, total: number): React.CSSProperties | undefined {
  const cols = gridColsCount(total);
  const rows = Math.ceil(total / cols);
  const remainder = total % cols;
  if (remainder === 0 || rows < 2) return undefined;
  const rowIndex = Math.floor(index / cols);
  const colIndex = index % cols;
  if (rowIndex === rows - 2 && colIndex >= remainder) {
    return { gridRow: 'span 2' };
  }
  return undefined;
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

function GroupActivitySummary({
  tasks,
  taskActivity,
}: {
  tasks: Task[];
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
}) {
  const busy = tasks.filter((t) => taskActivity[t.id] === 'busy').length;
  const waiting = tasks.filter((t) => taskActivity[t.id] === 'waiting').length;
  const idle = tasks.filter((t) => taskActivity[t.id] === 'idle').length;

  if (busy + waiting + idle === 0) return null;

  return (
    <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
      {waiting > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
          {waiting > 1 && <span className="text-[9px] text-muted-foreground/50">{waiting}</span>}
        </span>
      )}
      {busy > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-pulse flex-shrink-0" />
          {busy > 1 && <span className="text-[9px] text-muted-foreground/50">{busy}</span>}
        </span>
      )}
      {idle > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          {idle > 1 && <span className="text-[9px] text-muted-foreground/50">{idle}</span>}
        </span>
      )}
    </div>
  );
}

interface CellDragHandlers {
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function TaskCell({
  task,
  project,
  showProject,
  taskActivity,
  isDragOver,
  onRemoveTask,
  style,
  ...dragHandlers
}: {
  task: Task;
  project: Project | undefined;
  showProject: boolean;
  taskActivity: Record<string, 'busy' | 'idle' | 'waiting'>;
  isDragOver: boolean;
  onRemoveTask?: (id: string) => void;
  style?: React.CSSProperties;
} & CellDragHandlers) {
  return (
    <div className="group flex flex-col min-h-0 bg-background" style={style}>
      <div
        draggable
        onDragStart={dragHandlers.onDragStart}
        onDragOver={dragHandlers.onDragOver}
        onDragLeave={dragHandlers.onDragLeave}
        onDrop={dragHandlers.onDrop}
        onDragEnd={dragHandlers.onDragEnd}
        className="h-[26px] flex-shrink-0 flex items-center gap-1.5 px-2 border-b border-border/40 cursor-grab active:cursor-grabbing select-none transition-colors duration-100"
        style={{
          background: isDragOver ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--surface-1))',
          boxShadow: isDragOver ? 'inset 2px 0 0 hsl(var(--primary))' : undefined,
        }}
      >
        <ActivityDot status={taskActivity[task.id]} />
        <span className="text-[11px] font-medium text-foreground truncate min-w-0 flex-1">
          {task.name}
        </span>
        {showProject && project && (
          <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 truncate max-w-[80px]">
            {project.name}
          </span>
        )}
        {onRemoveTask && (
          <button
            onClick={() => onRemoveTask(task.id)}
            className="flex-shrink-0 p-px rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-all duration-100"
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

function BrowserCell({
  id,
  isDragOver,
  onRemove,
  onTitleChange,
  style,
  ...dragHandlers
}: {
  id: string;
  isDragOver: boolean;
  onRemove?: (id: string) => void;
  onTitleChange?: (id: string, title: string) => void;
  style?: React.CSSProperties;
} & CellDragHandlers) {
  return (
    <div
      className="group flex flex-col min-h-0 bg-background"
      style={style}
      draggable
      onDragStart={dragHandlers.onDragStart}
      onDragOver={dragHandlers.onDragOver}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop}
      onDragEnd={dragHandlers.onDragEnd}
    >
      <div className="flex-1 min-h-0">
        <BrowserPane
          id={id}
          onTitleChange={(t) => onTitleChange?.(id, t)}
          onClose={onRemove ? () => onRemove(id) : undefined}
        />
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
  browserPanes = [],
  browserTitles = {},
  onRemoveBrowserPane,
  onBrowserTitleChange,
}: MultiTerminalGridProps) {
  // Unified order: browser panes first, then task IDs
  const [order, setOrder] = useState<string[]>(() => [...browserPanes, ...tasks.map((t) => t.id)]);
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

  // Sync order with current tasks + browser panes (new browsers added at top)
  useEffect(() => {
    setOrder((prev) => {
      const allIds = new Set([...tasks.map((t) => t.id), ...browserPanes]);
      const kept = prev.filter((id) => allIds.has(id));
      const newBrowsers = browserPanes.filter((id) => !prev.includes(id));
      const newTasks = tasks.map((t) => t.id).filter((id) => !prev.includes(id));
      return [...newBrowsers, ...kept, ...newTasks];
    });
  }, [tasks, browserPanes]);

  const totalItems = tasks.length + browserPanes.length;

  if (totalItems === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground/50">
          No active sessions — open a task to see it here
        </p>
      </div>
    );
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const browserSet = new Set(browserPanes);
  const orderedItems = order.filter((id) => taskMap.has(id) || browserSet.has(id));

  function makeDragHandlers(itemId: string) {
    return {
      onDragStart: () => {
        draggedId.current = itemId;
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverId !== itemId) setDragOverId(itemId);
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = draggedId.current;
        const to = itemId;
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

  function renderCell(itemId: string, index: number, total: number, showProject: boolean) {
    const task = taskMap.get(itemId);
    if (task) {
      return (
        <TaskCell
          key={task.id}
          task={task}
          project={projects.find((p) => p.id === task.projectId)}
          showProject={showProject}
          taskActivity={taskActivity}
          isDragOver={dragOverId === task.id}
          onRemoveTask={onRemoveTask}
          style={cellSpanStyle(index, total)}
          {...makeDragHandlers(task.id)}
        />
      );
    }
    if (browserSet.has(itemId)) {
      return (
        <BrowserCell
          key={itemId}
          id={itemId}
          isDragOver={dragOverId === itemId}
          onRemove={onRemoveBrowserPane}
          onTitleChange={onBrowserTitleChange}
          style={cellSpanStyle(index, total)}
          {...makeDragHandlers(itemId)}
        />
      );
    }
    return null;
  }

  if (groupByProject) {
    const projectIdOrder: string[] = [];
    const tasksByProjectId: Record<string, Task[]> = {};
    const groupBrowserIds: string[] = [];

    for (const itemId of orderedItems) {
      const task = taskMap.get(itemId);
      if (task) {
        if (!tasksByProjectId[task.projectId]) {
          projectIdOrder.push(task.projectId);
          tasksByProjectId[task.projectId] = [];
        }
        tasksByProjectId[task.projectId].push(task);
      } else if (browserSet.has(itemId)) {
        groupBrowserIds.push(itemId);
      }
    }

    return (
      <div className="h-full flex flex-col gap-[1px] bg-border/40 overflow-hidden">
        {/* Browser panes — always at top, 16:9 aspect ratio, capped at 55% height */}
        {groupBrowserIds.length > 0 && (
          <div
            className="flex-shrink-0 w-full"
            style={{ aspectRatio: `${16 * groupBrowserIds.length} / 9`, maxHeight: '60%' }}
          >
            <div
              className={`h-full grid ${gridColsClass(groupBrowserIds.length)} gap-[1px] bg-border/40`}
              style={{ gridAutoRows: '1fr' }}
            >
              {groupBrowserIds.map((id, i) => (
                <BrowserCell
                  key={id}
                  id={id}
                  isDragOver={dragOverId === id}
                  onRemove={onRemoveBrowserPane}
                  onTitleChange={onBrowserTitleChange}
                  style={cellSpanStyle(i, groupBrowserIds.length)}
                  {...makeDragHandlers(id)}
                />
              ))}
            </div>
          </div>
        )}

        {projectIdOrder.map((projectId) => {
          const project = projects.find((p) => p.id === projectId);
          const groupTasks = tasksByProjectId[projectId];
          const collapsed = collapsedProjects.has(projectId);

          return (
            <div
              key={projectId}
              className={`flex flex-col ${collapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}
            >
              <button
                onClick={() => toggleProject(projectId)}
                className="h-7 flex-shrink-0 flex items-center gap-2 px-3 w-full text-left border-b border-border/40 hover:bg-accent/20 transition-colors duration-100 group/header"
                style={{ background: 'hsl(var(--surface-2))' }}
              >
                <span className="flex-shrink-0 text-muted-foreground/40 transition-transform duration-150 group-hover/header:text-muted-foreground/70">
                  {collapsed ? (
                    <ChevronRight size={11} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={11} strokeWidth={2} />
                  )}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {project?.name ?? projectId}
                </span>
                <span className="text-[10px] text-muted-foreground/30">{groupTasks.length}</span>
                <GroupActivitySummary tasks={groupTasks} taskActivity={taskActivity} />
              </button>

              {!collapsed && (
                <div className="flex-1 min-h-0">
                  <div
                    className={`h-full grid ${gridColsClass(groupTasks.length)} gap-[1px] bg-border/40`}
                    style={{ gridAutoRows: '1fr' }}
                  >
                    {groupTasks.map((task, i) => (
                      <TaskCell
                        key={task.id}
                        task={task}
                        project={project}
                        showProject={false}
                        taskActivity={taskActivity}
                        isDragOver={dragOverId === task.id}
                        onRemoveTask={onRemoveTask}
                        style={cellSpanStyle(i, groupTasks.length)}
                        {...makeDragHandlers(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Flat mode — all items in one grid
  return (
    <div
      className={`h-full grid ${gridColsClass(orderedItems.length)} gap-[1px] bg-border/40`}
      style={{ gridAutoRows: '1fr' }}
    >
      {orderedItems.map((itemId, i) => renderCell(itemId, i, orderedItems.length, true))}
    </div>
  );
}
