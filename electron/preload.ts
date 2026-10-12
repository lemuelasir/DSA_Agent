import { ipcRenderer, contextBridge } from 'electron'

// Securely expose APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  appVersion: '0.1.0',
  platform: process.platform,
  ping: () => 'pong',
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_event, value) => callback(value))
  },
  // Window management controls
  minimize: () => {
    ipcRenderer.send('window-minimize')
  },
  close: () => {
    ipcRenderer.send('window-close')
  },
  setAlwaysOnTop: (flag: boolean) => {
    ipcRenderer.send('window-set-always-on-top', flag)
  },
  showContextMenu: () => {
    ipcRenderer.send('show-context-menu')
  },
  onSetMood: (callback: (mood: string) => void) => {
    ipcRenderer.on('set-mood', (_event, mood) => callback(mood))
  },
  onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => {
    ipcRenderer.on('always-on-top-changed', (_event, flag) => callback(flag))
  },
})
