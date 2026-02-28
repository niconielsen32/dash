import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { sessionRegistry } from '../terminal/SessionRegistry';

const USER_TABS_KEY = 'shellDrawerUserTabs';
const ACTIVE_TAB_KEY = 'shellDrawerActiveTab';
const TAB_CWDS_KEY = 'shellDrawerTabCwds';

const TASK_TAB_PREFIX = 'shell-task-';

function loadPersistedUserTabs(): string[] {
  try {
    const s = localStorage.getItem(USER_TABS_KEY);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function loadPersistedTabCwds(): Record<string, string> {
  try {
    const s = localStorage.getItem(TAB_CWDS_KEY);
    if (s) return JSON.parse(s);
  } catch {
    // ignore parse errors
  }
  return {};
}

interface TerminalDrawerProps {
  taskId: string;
  cwd: string;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function TerminalDrawer({
  taskId,
  cwd,
  collapsed,
  onCollapse,
  onExpand,
}: TerminalDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Tab 0 is always the task shell (follows task selection)
  const taskTabId = `${TASK_TAB_PREFIX}${taskId}`;

  // User-added tabs (Shell 2, 3, …)
  const [userTabs, setUserTabs] = useState<string[]>(() => loadPersistedUserTabs());
  const [tabCwds, setTabCwds] = useState<Record<string, string>>(() => loadPersistedTabCwds());
  const [homeDir, setHomeDir] = useState<string>('');

  // All displayed tabs: task tab first, then user tabs
  const allTabs = [taskTabId, ...userTabs];

  // Active tab — default to task tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_TAB_KEY);
    const userTabs = loadPersistedUserTabs();
    const taskTab = `${TASK_TAB_PREFIX}${taskId}`;
    if (stored && (stored === taskTab || userTabs.includes(stored))) return stored;
    return taskTab;
  });

  // When task changes, if active was the old task tab, follow to new task tab
  const prevTaskIdRef = useRef<string>(taskId);
  useEffect(() => {
    const prevTaskTab = `${TASK_TAB_PREFIX}${prevTaskIdRef.current}`;
    prevTaskIdRef.current = taskId;
    if (activeTab === prevTaskTab) {
      setActiveTab(taskTabId);
      localStorage.setItem(ACTIVE_TAB_KEY, taskTabId);
    }
  }, [taskId]);

  // Fetch home directory once on mount
  useEffect(() => {
    window.electronAPI.getHomeDir().then((dir) => setHomeDir(dir));
  }, []);

  // Attach the active tab's session to the shared container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Task tab always uses the task's cwd; user tabs use their stored cwd
    const sessionCwd = activeTab === taskTabId ? cwd : tabCwds[activeTab] || homeDir || cwd;
    const session = sessionRegistry.getOrCreate({
      id: activeTab,
      cwd: sessionCwd,
      shellOnly: true,
    });
    session.attach(container);

    if (!collapsed) {
      requestAnimationFrame(() => session.focus());
    }

    return () => {
      sessionRegistry.detach(activeTab);
    };
  }, [activeTab, taskTabId]);

  // When task tab is active and cwd changes (task switches), re-attach with new session
  useEffect(() => {
    if (activeTab !== taskTabId) return;
    const container = containerRef.current;
    if (!container) return;

    const session = sessionRegistry.getOrCreate({ id: taskTabId, cwd, shellOnly: true });
    session.attach(container);
    if (!collapsed) {
      requestAnimationFrame(() => session.focus());
    }
    return () => {
      sessionRegistry.detach(taskTabId);
    };
  }, [taskTabId]);

  // Focus when expanding
  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => sessionRegistry.get(activeTab)?.focus());
    }
  }, [collapsed, activeTab]);

  // Scroll active tab into view when it changes
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const activeEl = bar.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  function saveUserTabs(tabs: string[]) {
    localStorage.setItem(USER_TABS_KEY, JSON.stringify(tabs));
  }

  function saveTabCwds(cwds: Record<string, string>) {
    localStorage.setItem(TAB_CWDS_KEY, JSON.stringify(cwds));
  }

  function addTab() {
    const id = `shell-global-${Date.now()}`;
    const newTabCwd = homeDir || cwd;
    const newUserTabs = [...userTabs, id];
    const newTabCwds = { ...tabCwds, [id]: newTabCwd };
    setUserTabs(newUserTabs);
    setTabCwds(newTabCwds);
    setActiveTab(id);
    localStorage.setItem(ACTIVE_TAB_KEY, id);
    saveUserTabs(newUserTabs);
    saveTabCwds(newTabCwds);
  }

  function removeTab(id: string) {
    if (id === taskTabId) return; // can't remove the task tab
    const idx = allTabs.indexOf(id);
    const newUserTabs = userTabs.filter((t) => t !== id);
    const newTabCwds = { ...tabCwds };
    delete newTabCwds[id];
    sessionRegistry.dispose(id);
    const newActive = id === activeTab ? allTabs[Math.max(0, idx - 1)] : activeTab;
    setUserTabs(newUserTabs);
    setTabCwds(newTabCwds);
    setActiveTab(newActive);
    localStorage.setItem(ACTIVE_TAB_KEY, newActive);
    saveUserTabs(newUserTabs);
    saveTabCwds(newTabCwds);
  }

  const selectTab = useCallback(
    (id: string) => {
      if (id === activeTab) return;
      setActiveTab(id);
      localStorage.setItem(ACTIVE_TAB_KEY, id);
    },
    [activeTab],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — shown whether collapsed or expanded */}
      <div
        className="flex items-center h-8 flex-shrink-0 border-b border-border/40"
        style={{ background: 'hsl(var(--surface-1))' }}
      >
        {/* Scrollable tabs list */}
        <div
          ref={tabBarRef}
          className="flex items-center flex-1 min-w-0 h-full overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {allTabs.map((tabId, i) => {
            const active = tabId === activeTab && !collapsed;
            const isTaskTab = tabId === taskTabId;
            return (
              <div
                key={tabId}
                data-active={active ? 'true' : undefined}
                className={`relative group/tab flex-shrink-0 flex items-center gap-1.5 h-full px-3 cursor-pointer select-none border-r border-border/30 transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/10'
                }`}
                style={active ? { background: 'hsl(var(--background))' } : undefined}
                onClick={() => {
                  if (collapsed) onExpand();
                  selectTab(tabId);
                }}
              >
                {active && (
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-primary rounded-b-full" />
                )}
                <Terminal size={11} strokeWidth={1.8} className="flex-shrink-0" />
                <span className="text-[11px] font-medium">Shell {i + 1}</span>
                {!isTaskTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tabId);
                    }}
                    className="flex-shrink-0 p-px rounded opacity-0 group-hover/tab:opacity-100 hover:bg-accent text-muted-foreground/40 hover:text-foreground transition-all"
                  >
                    <X size={10} strokeWidth={2} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add tab button — outside scroll area so always visible */}
        <button
          onClick={addTab}
          className="flex-shrink-0 flex items-center justify-center w-7 h-full text-muted-foreground/40 hover:text-foreground hover:bg-accent/10 transition-colors border-l border-border/30"
          title="New terminal"
        >
          <Plus size={12} strokeWidth={2} />
        </button>

        {/* Collapse / expand toggle */}
        <button
          onClick={collapsed ? onExpand : onCollapse}
          className="flex-shrink-0 flex items-center justify-center w-7 h-full text-muted-foreground/40 hover:text-foreground hover:bg-accent/10 transition-colors border-l border-border/30"
          title={collapsed ? 'Expand terminal' : 'Collapse terminal'}
        >
          {collapsed ? (
            <ChevronUp size={12} strokeWidth={2} />
          ) : (
            <ChevronDown size={12} strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Single shared container — active session is moved here on tab switch */}
      <div
        ref={containerRef}
        className="terminal-container flex-1 min-h-0"
        style={collapsed ? { height: 0, overflow: 'hidden' } : undefined}
      />
    </div>
  );
}
