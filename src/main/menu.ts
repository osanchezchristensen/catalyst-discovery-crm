import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { Actions, Ctx } from './ipc'

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function buildMenu(ctx: Ctx, actions: Actions, isDev: boolean): Menu {
  const isMac = process.platform === 'darwin'
  // Menu actions report back through the renderer's status region.
  const run = async (fn: () => Promise<string | null> | string | null) => {
    try {
      const message = await fn()
      if (message) ctx.send({ type: 'status', tone: 'success', message })
    } catch (err) {
      ctx.send({ type: 'status', tone: 'error', message: errorText(err) })
    }
  }

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Log Interview', accelerator: 'CmdOrCtrl+N', click: () => ctx.send({ type: 'log-interview' }) },
        { type: 'separator' },
        {
          label: 'Export Workspace…',
          accelerator: 'CmdOrCtrl+E',
          click: () =>
            run(async () => {
              const r = await actions.exportWorkspace(undefined)
              return 'path' in r ? `Workspace exported to ${r.path}` : null
            })
        },
        {
          label: 'Import Workspace…',
          accelerator: 'CmdOrCtrl+O',
          click: () =>
            run(async () => {
              const r = await actions.pickImport(undefined)
              if ('token' in r) ctx.send({ type: 'import-preview', preview: r })
              return null
            })
        },
        { type: 'separator' },
        { label: 'Back Up Now', click: () => run(() => (actions.backupNow(undefined), 'Backup saved')) },
        { label: 'Open Data Folder', click: () => run(async () => (await actions.openDataFolder(undefined), null)) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }] : [])
      ]
    },
    {
      role: 'help',
      submenu: [{ label: `About ${app.getName()}`, click: () => ctx.send({ type: 'about' }) }]
    }
  ]
  return Menu.buildFromTemplate(template)
}
