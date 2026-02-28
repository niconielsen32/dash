import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { sessionRegistry } from '../terminal/SessionRegistry';

const USER_TABS_KEY = 'shellDrawerUserTabs';
const ACTIVE_TAB_KEY = 'shellDrawerActiveTab';
const TAB_CWDS_KEY = 'shellDrawerTabCwds';

// Sentinel value stored for "Shell 1 is active"
const TASK_TAB_SENTINEL = 'shell-task';

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
  projectPath: string;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function TerminalDrawer({
  taskId,
  cwd,
  projectPath,
  collapsed,
  onCollapse,
  onExpand,
}: TerminalDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Session ID for Shell 1 — always tied to current task
  const taskSessionId = `shell-task-${taskId}`;

  // User-added tabs (Shell 2, 3, …)
  const [userTabs, setUserTabs] = useState<string[]>(() => loadPersistedUserTabs());
  const [tabCwds, setTabCwds] = useState<Record<string, string>>(() => loadPersistedTabCwds());
  const [homeDir, setHomeDir] = useState<string>('');

  // Active tab: TASK_TAB_SENTINEL means Shell 1, otherwise a user tab ID
  const [activeTab, setActiveTab] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_TAB_KEY);
    const userTabs = loadPersistedUserTabs();
    if (stored === TASK_TAB_SENTINEL || stored == null) return TASK_TAB_SENTINEL;
    if (userTabs.includes(stored)) return stored;
    return TASK_TAB_SENTINEL;
  });

  // The actual session ID to attach: Shell 1 always resolves to current taskSessionId
  const effectiveSessionId = activeTab === TASK_TAB_SENTINEL ? taskSessionId : activeTab;

  useEffect(() => {
    window.electronAPI.getHomeDir().then((dir) => setHomeDir(dir));
  }, []);

  // Attach session whenever the effective session ID changes
  // (task switch or user tab switch both trigger this)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sessionCwd =
      activeTab === TASK_TAB_SENTINEL ? cwd : tabCwds[activeTab] || projectPath || homeDir || cwd;
    const session = sessionRegistry.getOrCreate({
      id: effectiveSessionId,
      cwd: sessionCwd,
      shellOnly: true,
    });
    session.attach(container);

    if (!collapsed) {
      requestAnimationFrame(() => session.focus());
    }

    return () => {
      sessionRegistry.detach(effectiveSessionId);
    };
  }, [effectiveSessionId]);

  // Focus when expanding
  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => sessionRegistry.get(effectiveSessionId)?.focus());
    }
  }, [collapsed, effectiveSessionId]);

  // Scroll active tab indicator into view
  useEffect(() => {
    const bar = tabBarRef.current;
    if (!bar) return;
    const el = bar.querySelector('[data-active="true"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  function saveUserTabs(tabs: string[]) {
    localStorage.setItem(USER_TABS_KEY, JSON.stringify(tabs));
  }

  function saveTabCwds(cwds: Record<string, string>) {
    localStorage.setItem(TAB_CWDS_KEY, JSON.stringify(cwds));
  }

  function addTab() {
    const id = `shell-global-${Date.now()}`;
    const newTabCwd = projectPath || homeDir || cwd;
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
    const idx = userTabs.indexOf(id);
    const newUserTabs = userTabs.filter((t) => t !== id);
    const newTabCwds = { ...tabCwds };
    delete newTabCwds[id];
    sessionRegistry.dispose(id);
    // If removing active tab, fall back to adjacent user tab or Shell 1
    const newActive =
      id === activeTab
        ? idx > 0
          ? userTabs[idx - 1]
          : (newUserTabs[0] ?? TASK_TAB_SENTINEL)
        : activeTab;
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

  // All displayed tabs: Shell 1 (sentinel) + user tabs
  const allDisplayTabs = [TASK_TAB_SENTINEL, ...userTabs];

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div
        className="flex items-center h-8 flex-shrink-0 border-b border-border/40"
        style={{ background: 'hsl(var(--surface-1))' }}
      >
        {/* Scrollable tab list */}
        <div
          ref={tabBarRef}
          className="flex items-center flex-1 min-w-0 h-full overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {allDisplayTabs.map((tabId, i) => {
            const isTaskTab = tabId === TASK_TAB_SENTINEL;
            const active = tabId === activeTab && !collapsed;
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

        {/* Add tab — always visible outside scroll area */}
        <button
          onClick={addTab}
          className="flex-shrink-0 flex items-center justify-center w-7 h-full text-muted-foreground/40 hover:text-foreground hover:bg-accent/10 transition-colors border-l border-border/30"
          title="New terminal"
        >
          <Plus size={12} strokeWidth={2} />
        </button>

        {/* Collapse / expand */}
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

      {/* Shared terminal container */}
      <div
        ref={containerRef}
        className="terminal-container flex-1 min-h-0"
        style={collapsed ? { height: 0, overflow: 'hidden' } : undefined}
      />
    </div>
  );
}
