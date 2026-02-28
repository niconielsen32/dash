import React, { useRef, useEffect, useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { sessionRegistry } from '../terminal/SessionRegistry';

const TABS_KEY = 'shellDrawerTabs';
const ACTIVE_TAB_KEY = 'shellDrawerActiveTab';

function loadPersistedTabs(): string[] {
  try {
    const s = localStorage.getItem(TABS_KEY);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
  } catch {
    // ignore parse errors
  }
  return [`shell-global-${Date.now()}`];
}

function loadPersistedActiveTab(tabs: string[]): string {
  const stored = localStorage.getItem(ACTIVE_TAB_KEY);
  if (stored && tabs.includes(stored)) return stored;
  return tabs[0];
}

interface TerminalDrawerProps {
  cwd: string;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}

export function TerminalDrawer({ cwd, collapsed, onCollapse, onExpand }: TerminalDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [tabs, setTabs] = useState<string[]>(() => loadPersistedTabs());
  const [activeTab, setActiveTab] = useState<string>(() => {
    const t = loadPersistedTabs();
    return loadPersistedActiveTab(t);
  });

  // Attach the active tab's session to the shared container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const session = sessionRegistry.getOrCreate({ id: activeTab, cwd, shellOnly: true });
    session.attach(container);

    if (!collapsed) {
      requestAnimationFrame(() => session.focus());
    }

    return () => {
      sessionRegistry.detach(activeTab);
    };
  }, [activeTab, cwd]);

  // Focus when expanding
  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => sessionRegistry.get(activeTab)?.focus());
    }
  }, [collapsed, activeTab]);

  function saveTabs(newTabs: string[], newActive: string) {
    localStorage.setItem(TABS_KEY, JSON.stringify(newTabs));
    localStorage.setItem(ACTIVE_TAB_KEY, newActive);
  }

  function addTab() {
    const id = `shell-global-${Date.now()}`;
    const newTabs = [...tabs, id];
    setTabs(newTabs);
    setActiveTab(id);
    saveTabs(newTabs, id);
  }

  function removeTab(id: string) {
    if (tabs.length === 1) return;
    const idx = tabs.indexOf(id);
    const newTabs = tabs.filter((t) => t !== id);
    const newActive = id === activeTab ? newTabs[Math.max(0, idx - 1)] : activeTab;
    sessionRegistry.dispose(id);
    setTabs(newTabs);
    setActiveTab(newActive);
    saveTabs(newTabs, newActive);
  }

  function selectTab(id: string) {
    if (id === activeTab) return;
    setActiveTab(id);
    localStorage.setItem(ACTIVE_TAB_KEY, id);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — shown whether collapsed or expanded */}
      <div
        className="flex items-center h-8 flex-shrink-0 border-b border-border/40"
        style={{ background: 'hsl(var(--surface-1))' }}
      >
        {/* Tabs + add button */}
        <div className="flex items-center flex-1 min-w-0 h-full overflow-x-auto scrollbar-none">
          {tabs.map((tabId, i) => {
            const active = tabId === activeTab && !collapsed;
            return (
              <div
                key={tabId}
                className={`relative group/tab flex-shrink-0 flex items-center gap-1.5 h-full px-3 cursor-pointer select-none border-r border-border/30 transition-colors ${
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/10'
                }`}
                style={active ? { background: 'hsl(var(--background))' } : undefined}
                onClick={() => {
                  if (collapsed) {
                    onExpand();
                  }
                  selectTab(tabId);
                }}
              >
                {active && (
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-primary rounded-b-full" />
                )}
                <Terminal size={11} strokeWidth={1.8} className="flex-shrink-0" />
                <span className="text-[11px] font-medium">Shell {i + 1}</span>
                {tabs.length > 1 && (
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
          <button
            onClick={addTab}
            className="flex-shrink-0 flex items-center justify-center w-7 h-full text-muted-foreground/40 hover:text-foreground hover:bg-accent/10 transition-colors"
            title="New terminal"
          >
            <Plus size={12} strokeWidth={2} />
          </button>
        </div>

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

      {/* Single terminal container — active session is moved here on tab switch */}
      <div
        ref={containerRef}
        className="terminal-container flex-1 min-h-0"
        style={collapsed ? { height: 0, overflow: 'hidden' } : undefined}
      />
    </div>
  );
}
