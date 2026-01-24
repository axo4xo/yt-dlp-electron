import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: { ytdlpPath?: string; downloadPath?: string }) => 
    ipcRenderer.invoke('settings:set', settings),

  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),

  download: (options: { url: string; ytdlpPath: string; downloadPath: string; format: 'mp3' | 'mp4' }) =>
    ipcRenderer.invoke('download:start', options),
  cancelDownload: () => ipcRenderer.invoke('download:cancel'),
  
  onProgress: (callback: (text: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },

  openFolder: (path: string) => ipcRenderer.invoke('shell:openFolder', path),
  getClipboardText: () => ipcRenderer.invoke('clipboard:getText'),
  getPlatform: () => ipcRenderer.invoke('platform:get'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
});

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<{ ytdlpPath: string; downloadPath: string }>;
      setSettings: (settings: { ytdlpPath?: string; downloadPath?: string }) => Promise<boolean>;
      selectFolder: () => Promise<string | null>;
      selectFile: () => Promise<string | null>;
      download: (options: { url: string; ytdlpPath: string; downloadPath: string; format: 'mp3' | 'mp4' }) => Promise<{ success: boolean; output: string }>;
      cancelDownload: () => Promise<boolean>;
      onProgress: (callback: (text: string) => void) => () => void;
      openFolder: (path: string) => Promise<void>;
      getClipboardText: () => Promise<string>;
      getPlatform: () => Promise<string>;
      windowMinimize: () => Promise<void>;
      windowMaximize: () => Promise<void>;
      windowClose: () => Promise<void>;
    };
  }
}
