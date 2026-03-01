import { BrowserWindow, shell } from 'electron';
import * as path from 'path';

const isDev = process.argv.includes('--dev');

export function createWindow(opts?: { isNew?: boolean }): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    title: 'Dash',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // Harden webview security — strip nodeIntegration and preload from any embedded webview
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  if (isDev) {
    const devPort = process.env.DEV_PORT || '3000';
    const url = `http://localhost:${devPort}${opts?.isNew ? '?new=1' : ''}`;
    mainWindow.loadURL(url);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', '..', 'renderer', 'index.html');
    if (opts?.isNew) {
      mainWindow.loadFile(indexPath, { query: { new: '1' } });
    } else {
      mainWindow.loadFile(indexPath);
    }
  }

  return mainWindow;
}
