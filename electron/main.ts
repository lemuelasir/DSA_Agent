import { app, BrowserWindow, ipcMain, screen, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
// ├─┬ dist-electron
// │ ├── main.js
// │ └── preload.js
// ├─┬ dist
// │ └── index.html

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const windowWidth = 220
  const windowHeight = 250

  // Position at bottom-right corner of the desktop
  const initialX = Math.max(0, screenWidth - windowWidth - 30)
  const initialY = Math.max(0, screenHeight - windowHeight - 30)

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: initialX,
    y: initialY,
    frame: false,                 // Frameless window: removes OS titlebar
    transparent: true,            // Transparent desktop overlay
    alwaysOnTop: true,            // Floats on top of other applications
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    backgroundColor: '#00000000', // Fully transparent background
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  // Ensure window stays above standard windows on Windows
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // Log renderer console messages to terminal for transparent debugging
  mainWindow.webContents.on('console-message', (_event, _level, message) => {
    console.log(`[Renderer Console]: ${message}`)
  })

  // Send an initialization message once the renderer has loaded
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send(
      'main-process-message',
      `Companion cat initialized at ${new Date().toLocaleTimeString()}`
    )
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// IPC Handlers for window management
ipcMain.on('window-minimize', () => {
  console.log('[Main Process] Received window-minimize IPC')
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.on('window-close', () => {
  console.log('[Main Process] Received window-close IPC - terminating app')
  if (mainWindow) {
    mainWindow.destroy()
  }
  app.quit()
})

ipcMain.on('window-set-always-on-top', (_event, flag: boolean) => {
  console.log(`[Main Process] Set always on top: ${flag}`)
  mainWindow?.setAlwaysOnTop(flag, flag ? 'screen-saver' : 'normal')
})

// Right-click context menu
ipcMain.on('show-context-menu', () => {
  if (!mainWindow) return
  const isTop = mainWindow.isAlwaysOnTop()
  const contextMenu = Menu.buildFromTemplate([
    { label: '🐱 DSA Companion Cat', enabled: false },
    { type: 'separator' },
    {
      label: '💤 Idle Mood',
      click: () => mainWindow?.webContents.send('set-mood', 'idle'),
    },
    {
      label: '💡 Thinking Mood',
      click: () => mainWindow?.webContents.send('set-mood', 'thinking'),
    },
    {
      label: '🐾 Helping Mood',
      click: () => mainWindow?.webContents.send('set-mood', 'helping'),
    },
    {
      label: '✨ Success Mood',
      click: () => mainWindow?.webContents.send('set-mood', 'success'),
    },
    { type: 'separator' },
    {
      label: '📌 Always On Top',
      type: 'checkbox',
      checked: isTop,
      click: (menuItem) => {
        mainWindow?.setAlwaysOnTop(menuItem.checked, menuItem.checked ? 'screen-saver' : 'normal')
        mainWindow?.webContents.send('always-on-top-changed', menuItem.checked)
      },
    },
    {
      label: '– Minimize',
      click: () => mainWindow?.minimize(),
    },
    { type: 'separator' },
    {
      label: '✕ Quit Companion',
      click: () => {
        if (mainWindow) mainWindow.destroy()
        app.quit()
      },
    },
  ])
  contextMenu.popup({ window: mainWindow })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    mainWindow = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
