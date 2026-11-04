import { app, BrowserWindow, dialog, Menu, screen, session, shell } from 'electron'
import type Database from 'better-sqlite3'
import { join } from 'node:path'
import { EVENT_CHANNEL, type AppEvent } from '../shared/api'
import { backupNow, isBackupDue } from './backup'
import { openDatabase } from './db/connection'
import { createActions, registerIpc, type Ctx } from './ipc'
import { buildMenu } from './menu'
import { loadWindowState, MIN_HEIGHT, MIN_WIDTH, saveWindowState } from './window-state'

const isDev = !app.isPackaged
// Keep development data apart from a real installed copy.
if (isDev) app.setPath('userData', `${app.getPath('userData')} (dev)`)

const dataDir = app.getPath('userData')
const backupsDir = join(dataDir, 'backups')
const HOUR_MS = 60 * 60 * 1000
const PAGE_BACKGROUND = '#f2f5f8' // Steam lightest from docs/brand/tokens.css; shown before the page paints

let win: BrowserWindow | null = null
let db: Database.Database | null = null

const isSafeExternal = (url: string) => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

// No navigation, no new windows, no webviews. https links open in the default browser.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    event.preventDefault()
    if (isSafeExternal(url)) void shell.openExternal(url)
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
})

function createWindow(): BrowserWindow {
  const stateFile = join(dataDir, 'window-state.json')
  const state = loadWindowState(stateFile, screen.getAllDisplays().map((d) => d.workArea))
  const w = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Catalyst Discovery CRM',
    backgroundColor: PAGE_BACKGROUND,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false // Chromium downloads spellcheck dictionaries over the network
    }
  })
  w.once('ready-to-show', () => {
    if (state.maximized) w.maximize()
    w.show()
  })
  // The renderer blocks unload while the venture form has unsaved edits; let the user decide.
  w.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(w, {
      type: 'question',
      buttons: ['Leave without saving', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      message: 'You have unsaved changes to your venture.',
      detail: 'Leave without saving?'
    })
    if (choice === 0) event.preventDefault() // ignore the block and close
  })
  w.on('close', () => saveWindowState(stateFile, w.getNormalBounds(), w.isMaximized()))
  w.on('closed', () => {
    if (win === w) win = null
  })
  if (isDev && process.env.ELECTRON_RENDERER_URL) void w.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void w.loadFile(join(__dirname, '../renderer/index.html'))
  return w
}

function safeBackup(database: Database.Database) {
  try {
    backupNow(database, backupsDir)
  } catch (err) {
    console.error('Automatic backup failed', err)
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win?.isMinimized()) win.restore()
    win?.focus()
  })

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)

    try {
      db = openDatabase(dataDir, backupsDir)
    } catch (err) {
      dialog.showErrorBox(
        'Catalyst Discovery CRM could not open your data',
        `${err instanceof Error ? err.message : String(err)}\n\nYour data folder: ${dataDir}`
      )
      app.quit()
      return
    }
    const database = db
    safeBackup(database) // on every launch
    setInterval(() => {
      if (isBackupDue(database)) safeBackup(database)
    }, HOUR_MS)

    const send = (event: AppEvent) => win?.webContents.send(EVENT_CHANNEL, event)
    const ctx: Ctx = {
      db: database,
      dataDir,
      backupsDir,
      getWindow: () => win,
      send
    }
    const actions = createActions(ctx)
    registerIpc(ctx, actions)
    Menu.setApplicationMenu(buildMenu(ctx, actions, isDev))
    win = createWindow()

    app.on('activate', () => {
      if (!win) win = createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('will-quit', () => db?.close())
}
