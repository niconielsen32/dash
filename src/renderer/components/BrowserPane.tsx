import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, X, ExternalLink } from 'lucide-react';

function looksLikeUrl(input: string): boolean {
  // Has a dot with no spaces → likely a URL (e.g. "google.com", "foo.bar/path")
  return /^[^\s]+\.[^\s]+$/.test(input);
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return 'about:blank';
  if (/^(about:|http:\/\/|https:\/\/)/.test(trimmed)) return trimmed;
  if (/^localhost(:|$)/.test(trimmed) || /^127\.\d+\.\d+\.\d+(:|$)/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  // If it doesn't look like a URL, treat as a Google search
  if (!looksLikeUrl(trimmed)) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  }
  return `https://${trimmed}`;
}

interface BrowserPaneProps {
  id: string;
  fill?: boolean;
  onTitleChange?: (title: string) => void;
  onClose?: () => void;
}

export function BrowserPane({ id, fill = false, onTitleChange, onClose }: BrowserPaneProps) {
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;

  const webviewRef = useRef<HTMLElement | null>(null);
  const [url, setUrl] = useState(() => {
    return localStorage.getItem(`browser:lastUrl:${id}`) || '';
  });
  const [inputValue, setInputValue] = useState(url || '');
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const getWebview = useCallback(() => {
    return webviewRef.current as
      | (HTMLElement & {
          loadURL: (url: string) => Promise<void>;
          goBack: () => void;
          goForward: () => void;
          reload: () => void;
          stop: () => void;
          canGoBack: () => boolean;
          canGoForward: () => boolean;
          getURL: () => string;
          setZoomFactor: (factor: number) => void;
        })
      | null;
  }, []);

  const navigate = useCallback(
    (rawUrl: string) => {
      const normalized = normalizeUrl(rawUrl);
      const wv = getWebview();
      if (wv) {
        wv.loadURL(normalized);
      }
      setUrl(normalized);
      setInputValue(normalized);
      localStorage.setItem(`browser:lastUrl:${id}`, normalized);
    },
    [id, getWebview],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate(inputValue);
    },
    [inputValue, navigate],
  );

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;

    const onDomReady = () => {
      const typedWv = getWebview();
      if (!typedWv) return;
      setCanGoBack(typedWv.canGoBack());
      setCanGoForward(typedWv.canGoForward());
    };

    const onDidNavigate = (e: Event & { url?: string }) => {
      const navUrl = e.url || '';
      setUrl(navUrl);
      setInputValue(navUrl);
      localStorage.setItem(`browser:lastUrl:${id}`, navUrl);
      const typedWv = getWebview();
      if (typedWv) {
        setCanGoBack(typedWv.canGoBack());
        setCanGoForward(typedWv.canGoForward());
      }
    };

    const onDidNavigateInPage = onDidNavigate;

    const onPageTitleUpdated = (e: Event & { title?: string }) => {
      if (e.title) {
        onTitleChangeRef.current?.(e.title);
      }
    };

    const onStartLoading = () => {
      setLoading(true);
      const typedWv = getWebview();
      if (typedWv) typedWv.setZoomFactor(0.8);
    };
    const onStopLoading = () => {
      setLoading(false);
      const typedWv = getWebview();
      if (typedWv) {
        setCanGoBack(typedWv.canGoBack());
        setCanGoForward(typedWv.canGoForward());
      }
    };

    const onNewWindow = (e: Event & { url?: string }) => {
      e.preventDefault();
      if (e.url) navigate(e.url);
    };

    wv.addEventListener('dom-ready', onDomReady);
    wv.addEventListener('did-navigate', onDidNavigate);
    wv.addEventListener('did-navigate-in-page', onDidNavigateInPage);
    wv.addEventListener('page-title-updated', onPageTitleUpdated);
    wv.addEventListener('did-start-loading', onStartLoading);
    wv.addEventListener('did-stop-loading', onStopLoading);
    wv.addEventListener('new-window', onNewWindow);

    return () => {
      wv.removeEventListener('dom-ready', onDomReady);
      wv.removeEventListener('did-navigate', onDidNavigate);
      wv.removeEventListener('did-navigate-in-page', onDidNavigateInPage);
      wv.removeEventListener('page-title-updated', onPageTitleUpdated);
      wv.removeEventListener('did-start-loading', onStartLoading);
      wv.removeEventListener('did-stop-loading', onStopLoading);
      wv.removeEventListener('new-window', onNewWindow);
    };
  }, [id, getWebview, navigate]);

  const handleBack = () => getWebview()?.goBack();
  const handleForward = () => getWebview()?.goForward();
  const handleReloadOrStop = () => {
    const wv = getWebview();
    if (!wv) return;
    if (loading) {
      wv.stop();
    } else {
      wv.reload();
    }
  };
  const handleOpenExternal = () => {
    if (url && url !== 'about:blank') {
      window.electronAPI?.openExternal(url);
    }
  };

  const initialSrc = url || 'https://www.google.com';

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Compact nav bar */}
      <div
        className="flex items-center gap-1 px-1.5 h-7 flex-shrink-0 border-b border-border/30"
        style={{ background: 'hsl(var(--surface-1))' }}
      >
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Back"
        >
          <ArrowLeft size={12} strokeWidth={1.8} />
        </button>
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Forward"
        >
          <ArrowRight size={12} strokeWidth={1.8} />
        </button>
        <button
          onClick={handleReloadOrStop}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          title={loading ? 'Stop' : 'Reload'}
        >
          {loading ? <X size={12} strokeWidth={1.8} /> : <RotateCw size={12} strokeWidth={1.8} />}
        </button>

        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="URL..."
            className="w-full h-5 px-2 rounded bg-background/80 border border-border/40 text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 transition-colors"
          />
        </form>

        <button
          onClick={handleOpenExternal}
          disabled={!url || url === 'about:blank'}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title="Open in browser"
        >
          <ExternalLink size={12} strokeWidth={1.8} />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            title="Close browser"
          >
            <X size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="h-[2px] flex-shrink-0 bg-primary/20 overflow-hidden">
          <div className="h-full w-1/3 bg-primary animate-[slide_1s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Webview — fills container in single view, 16:9 in grid view */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {fill ? (
          <webview
            ref={webviewRef as React.Ref<HTMLElement>}
            src={initialSrc}
            partition="persist:browser"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div
            className="relative"
            style={{
              aspectRatio: '16 / 9',
              maxWidth: '100%',
              maxHeight: '100%',
              width: '100%',
            }}
          >
            <webview
              ref={webviewRef as React.Ref<HTMLElement>}
              src={initialSrc}
              partition="persist:browser"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
