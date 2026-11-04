import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { z } from 'zod'
import type { AppEvent, InvokeApi } from '../shared/api'
import {
  contactInput,
  contactStageInput,
  hypothesisInput,
  idInput,
  importToken,
  interviewInput,
  profileInput,
  ventureBundleInput,
  ventureCreateInput,
  type WorkspaceFile
} from '../shared/schema'
import { backupNow } from './backup'
import * as repo from './db/repo'
import { ImportError, MAX_IMPORT_BYTES, applyImport, exportWorkspace, parseWorkspace, previewImport } from './workspace'

export type Ctx = {
  db: Database.Database
  dataDir: string
  backupsDir: string
  getWindow: () => BrowserWindow | null
  send: (event: AppEvent) => void
}

type Handlers = {
  [K in keyof InvokeApi]: (arg: unknown) => Awaited<ReturnType<InvokeApi[K]>> | ReturnType<InvokeApi[K]>
}
export type Actions = Handlers

/** Validates input from the renderer; the message reaches the UI. */
function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const r = schema.safeParse(value)
  if (r.success) return r.data
  const issue = r.error.issues[0]
  throw new Error(issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message)
}

const FILTERS = [{ name: 'Workspace file', extensions: ['json'] }]
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'

export function createActions(ctx: Ctx): Actions {
  const { db } = ctx
  let pending: { token: string; file: WorkspaceFile } | null = null
  const dialogParent = () => ctx.getWindow() ?? undefined

  return {
    getAppInfo: () => ({
      version: app.getVersion(),
      dataDir: ctx.dataDir,
      lastBackupAt: repo.getMeta(db, 'last_backup_at')
    }),
    openDataFolder: async () => {
      const error = await shell.openPath(ctx.dataDir)
      if (error) throw new Error(`Couldn't open the data folder: ${error}`)
    },
    getProfile: () => repo.getProfile(db),
    saveProfile: (arg) => repo.saveProfile(db, parse(profileInput, arg)),
    getActiveVenture: () => repo.getActiveVenture(db),
    createVenture: (arg) =>
      repo.createVenture(db, parse(ventureCreateInput, arg), repo.getProfile(db)?.full_name ?? ''),
    saveVenture: (arg) => repo.saveVenture(db, parse(ventureBundleInput, arg)),
    listContacts: () => repo.listContacts(db),
    saveContact: (arg) => repo.saveContact(db, parse(contactInput, arg)),
    setContactStage: (arg) => repo.setContactStage(db, parse(contactStageInput, arg)),
    deleteContact: (arg) => repo.deleteContact(db, parse(idInput, arg)),
    listInterviews: () => repo.listInterviews(db),
    getInterview: (arg) => repo.getInterview(db, parse(idInput, arg)),
    saveInterview: (arg) => repo.saveInterview(db, parse(interviewInput, arg)),
    deleteInterview: (arg) => repo.deleteInterview(db, parse(idInput, arg)),
    listHypotheses: () => repo.listHypotheses(db),
    saveHypothesis: (arg) => repo.saveHypothesis(db, parse(hypothesisInput, arg)),
    deleteHypothesis: (arg) => repo.deleteHypothesis(db, parse(idInput, arg)),
    addStarterHypotheses: () => repo.addStarterHypotheses(db),
    listEvidence: (arg) => repo.listEvidence(db, parse(idInput, arg)),
    backupNow: () => {
      const at = new Date()
      backupNow(db, ctx.backupsDir, at, 'manual')
      return { at: at.toISOString() }
    },
    exportWorkspace: async () => {
      const venture = repo.getActiveVenture(db)?.venture.name ?? 'workspace'
      const day = new Date().toISOString().slice(0, 10)
      const options = {
        title: 'Export workspace',
        defaultPath: join(app.getPath('documents'), `${slug(venture)}-${day}.json`),
        filters: FILTERS
      }
      const parent = dialogParent()
      const r = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
      if (r.canceled || !r.filePath) return { canceled: true }
      const file = exportWorkspace(db, {
        appVersion: app.getVersion(),
        exportedBy: repo.getProfile(db)?.full_name ?? ''
      })
      await writeFile(r.filePath, JSON.stringify(file, null, 2), 'utf8')
      return { path: r.filePath }
    },
    pickImport: async () => {
      const options = { title: 'Import workspace', properties: ['openFile' as const], filters: FILTERS }
      const parent = dialogParent()
      const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
      if (r.canceled || !r.filePaths[0]) return { canceled: true }
      const path = r.filePaths[0]
      if ((await stat(path)).size > MAX_IMPORT_BYTES) throw new ImportError('That file is larger than 50 MB.')
      const file = parseWorkspace(await readFile(path, 'utf8'))
      pending = { token: randomUUID(), file }
      return {
        token: pending.token,
        fileName: basename(path),
        exportedBy: file.exported_by,
        exportedAt: file.exported_at,
        counts: previewImport(db, file)
      }
    },
    applyImport: (arg) => {
      const token = parse(importToken, arg)
      if (!pending || pending.token !== token) throw new Error('That import expired. Choose the file again.')
      const { file } = pending
      pending = null
      backupNow(db, ctx.backupsDir, new Date(), 'pre-import') // a restore point in case the merge isn't what the student expected
      const counts = applyImport(db, file)
      ctx.send({ type: 'data-changed' })
      return { counts }
    },
    cancelImport: (arg) => {
      if (pending?.token === arg) pending = null
    }
  }
}

export function registerIpc(ctx: Ctx, actions: Actions): void {
  for (const [channel, handler] of Object.entries(actions)) {
    ipcMain.handle(channel, (event, arg: unknown) => {
      // Only our own window may call the API.
      if (event.sender !== ctx.getWindow()?.webContents) throw new Error('Blocked: unknown sender')
      return handler(arg)
    })
  }
}
