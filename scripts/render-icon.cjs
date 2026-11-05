// Renders build/icon.svg to build/icon.png (1024×1024) with Electron itself, so no image library is needed.
// Run: npx electron scripts/render-icon.cjs   (electron-builder makes the .ico and .icns from the PNG)
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 1024
const build = join(__dirname, '..', 'build')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = readFileSync(join(build, 'icon.svg'), 'utf8')
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  writeFileSync(join(build, 'icon.png'), image.resize({ width: SIZE, height: SIZE }).toPNG())
  console.log('wrote build/icon.png', image.getSize())
  app.quit()
})
