import { app, BrowserWindow, ipcMain, screen, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'

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
let pythonProcess: ChildProcess | null = null

const appRoot = process.env.APP_ROOT || path.join(__dirname, '..')

function startPythonBackend() {
  const venvPythonWin = path.join(appRoot, '.venv', 'Scripts', 'python.exe')
  const venvPythonUnix = path.join(appRoot, '.venv', 'bin', 'python')
  const pythonPath = fs.existsSync(venvPythonWin)
    ? venvPythonWin
    : fs.existsSync(venvPythonUnix)
    ? venvPythonUnix
    : 'python'

  const backendDir = path.join(appRoot, 'backend')

  console.log(`[Main Process] Spawning Python FastAPI backend via: ${pythonPath}`)
  try {
    pythonProcess = spawn(
      pythonPath,
      ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'],
      {
        cwd: backendDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    pythonProcess.stdout?.on('data', (data) => {
      console.log(`[Python Backend]: ${data.toString().trim()}`)
    })

    pythonProcess.stderr?.on('data', (data) => {
      console.log(`[Python Backend Error]: ${data.toString().trim()}`)
    })

    pythonProcess.on('exit', (code) => {
      console.log(`[Python Backend] Exited with code ${code}`)
      pythonProcess = null
    })
  } catch (err) {
    console.error('[Main Process] Failed to spawn Python backend:', err)
  }
}

function stopPythonBackend() {
  if (pythonProcess) {
    console.log('[Main Process] Terminating Python backend...')
    pythonProcess.kill()
    pythonProcess = null
  }
}

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
  stopPythonBackend()
  if (mainWindow) {
    mainWindow.destroy()
  }
  app.quit()
})

ipcMain.on('window-set-always-on-top', (_event, flag: boolean) => {
  console.log(`[Main Process] Set always on top: ${flag}`)
  mainWindow?.setAlwaysOnTop(flag, flag ? 'screen-saver' : 'normal')
})

// Dynamic window resizing between compact Cat mode and expanded Assistant Panel (opens below cat)
ipcMain.on('window-set-expanded', (_event, isExpanded: boolean) => {
  if (!mainWindow) return
  const [currentX, currentY] = mainWindow.getPosition()
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const compactWidth = 220
  const compactHeight = 240
  const expandedWidth = 400
  const expandedHeight = 680

  const targetWidth = isExpanded ? expandedWidth : compactWidth
  const targetHeight = isExpanded ? expandedHeight : compactHeight

  let newX = currentX
  let newY = currentY

  if (isExpanded) {
    // When expanding, shift window upwards so panel opens cleanly below the cat without falling off-screen
    const heightDiff = expandedHeight - compactHeight
    newY = Math.max(10, currentY - heightDiff)
    const widthDiff = Math.round((expandedWidth - compactWidth) / 2)
    newX = Math.max(10, currentX - widthDiff)

    if (newX + targetWidth > screenWidth) {
      newX = Math.max(10, screenWidth - targetWidth - 20)
    }
    if (newY + targetHeight > screenHeight) {
      newY = Math.max(10, screenHeight - targetHeight - 20)
    }
  } else {
    // When collapsing, return downwards so the cat anchors back to its original desktop location
    const heightDiff = expandedHeight - compactHeight
    newY = Math.min(screenHeight - compactHeight - 20, currentY + heightDiff)
    const widthDiff = Math.round((expandedWidth - compactWidth) / 2)
    newX = Math.min(screenWidth - compactWidth - 20, currentX + widthDiff)
  }

  mainWindow.setBounds({
    x: Math.round(newX),
    y: Math.round(newY),
    width: targetWidth,
    height: targetHeight,
  })
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
        stopPythonBackend()
        if (mainWindow) mainWindow.destroy()
        app.quit()
      },
    },
  ])
  contextMenu.popup({ window: mainWindow })
})

// Clean up child processes on app quit
app.on('will-quit', () => {
  stopPythonBackend()
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  stopPythonBackend()
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

app.whenReady().then(() => {
  createWindow()
  startPythonBackend()
})
