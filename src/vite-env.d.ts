/// <reference types="vite/client" />

export interface ElectronAPI {
  appVersion: string
  platform: string
  ping: () => string
  onMainProcessMessage: (callback: (message: string) => void) => void
  minimize: () => void
  close: () => void
  setAlwaysOnTop: (flag: boolean) => void
  setExpanded: (isExpanded: boolean) => void
  showContextMenu: () => void
  onSetMood: (callback: (mood: string) => void) => void
  onAlwaysOnTopChanged: (callback: (flag: boolean) => void) => void
  captureScreen: () => Promise<string | null>
  getDesktopIdleSeconds?: () => Promise<number>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
