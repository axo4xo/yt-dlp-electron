import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import Store from 'electron-store';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

interface StoreSchema {
  ytdlpPath: string;
  downloadPath: string;
}

const store = new Store<StoreSchema>() as unknown as {
  get<K extends keyof StoreSchema>(key: K, defaultValue?: StoreSchema[K]): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
};

let currentProcess: ChildProcess | null = null;

function getDefaultYtDlpPath(): string {
  if (process.platform === 'win32') {
    const possiblePaths = [
      'C:\\Windows\\System32\\yt-dlp.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
      'yt-dlp.exe', // in PATH
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'yt-dlp.exe';
  } else if (process.platform === 'darwin') {
    const homebrewPath = '/opt/homebrew/bin/yt-dlp';
    const usrLocalPath = '/usr/local/bin/yt-dlp';
    if (fs.existsSync(homebrewPath)) return homebrewPath;
    if (fs.existsSync(usrLocalPath)) return usrLocalPath;
    return 'yt-dlp';
  } else {
    return '/usr/bin/yt-dlp';
  }
}

export function setupIpcHandlers() {
  ipcMain.handle('settings:get', () => {
    return {
      ytdlpPath: store.get('ytdlpPath', getDefaultYtDlpPath()),
      downloadPath: store.get('downloadPath', path.join(os.homedir(), 'Downloads')),
    };
  });

  ipcMain.handle('settings:set', (_event, settings: { ytdlpPath?: string; downloadPath?: string }) => {
    if (settings.ytdlpPath) store.set('ytdlpPath', settings.ytdlpPath);
    if (settings.downloadPath) store.set('downloadPath', settings.downloadPath);
    return true;
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: process.platform === 'win32' 
        ? [{ name: 'Executables', extensions: ['exe'] }]
        : [],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('download:start', async (event, options: {
    url: string;
    ytdlpPath: string;
    downloadPath: string;
    format: 'mp3' | 'mp4';
  }) => {
    const { url, ytdlpPath, downloadPath, format } = options;

    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
    }

    const args = format === 'mp3'
      ? ['-x', '--audio-format', 'mp3', '-o', path.join(downloadPath, '%(title)s.%(ext)s'), url]
      : ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', '-o', path.join(downloadPath, '%(title)s.%(ext)s'), url];

    return new Promise((resolve, reject) => {
      currentProcess = spawn(ytdlpPath, args, {
        shell: process.platform === 'win32',
      });

      let output = '';
      let errorOutput = '';

      currentProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        event.sender.send('download:progress', text);
      });

      currentProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        event.sender.send('download:progress', text);
      });

      currentProcess.on('close', (code) => {
        currentProcess = null;
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(errorOutput || `Process exited with code ${code}`));
        }
      });

      currentProcess.on('error', (err) => {
        currentProcess = null;
        reject(err);
      });
    });
  });

  ipcMain.handle('download:cancel', () => {
    if (currentProcess) {
      currentProcess.kill();
      currentProcess = null;
      return true;
    }
    return false;
  });

  ipcMain.handle('shell:openFolder', (_event, folderPath: string) => {
    shell.openPath(folderPath);
  });

  ipcMain.handle('clipboard:getText', () => {
    return clipboard.readText();
  });

  ipcMain.handle('platform:get', () => {
    return process.platform;
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
}
