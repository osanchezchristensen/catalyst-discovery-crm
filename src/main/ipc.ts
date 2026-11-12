import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { z } from 'zod'
import type { AppEvent, InvokeApi } from '../shared/api'
import {
  confirmNameInput,
  contactImportRequest,
  exportOptions,
  thresholdsInput,
  contactInput,
  contactStageInput,
  decisionInput,
  guideInput,
  hypothesisInput,
  idInput,
  importToken,
  insightInput,
  interviewInput,
  tagRenameInput,
  profileInput,
  taskInput,
  ventureBundleInput,
  ventureCreateInput,
  versionInput,
  weeklyGoalInput,
  surveyImportRequest,
  trashRefInput,
  type WorkspaceFile
} from '../shared/schema'
import { backupNow } from './backup'
import { CsvError, decodeCsv, MAX_CSV_BYTES, parseCsv } from './csv'
import {
  addAttachment,
  applyContactImport,
  applySurveyImport,
  ATTACHMENT_TYPES,
  attachmentPath,
  deleteAttachment,
  exportCsv,
  listAttachments,
  planContactImport,
  planSurveyImport,
  qualtricsHeaders,
  removeInterviewFiles,
  resetWorkspace,
  suggestMapping,
  suggestSurveyMapping
} from './data-tools'
import { today } from '../shared/dates'
import * as repo from './db/repo'
import { ImportError, MAX_IMPORT_BYTES, applyImport, exportWorkspace, parseWorkspace, previewImport } from './workspace'

export type Ctx = {
  db: Database.Database
  dataDir: string
  backupsDir: string
  attachmentsDir: string
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
  // One CSV waits for its preview and apply at a time; the renderer only ever holds the token.
  let pendingCsv: { token: string; headers: string[]; rows: string[][] } | null = null
  const csvFile = (token: string) => {
    if (!pendingCsv || pendingCsv.token !== token) throw new Error('That import expired. Choose the file again.')
    return pendingCsv
  }
  const csvRows = (token: string) => csvFile(token).rows
  /** Picks and parses a CSV, keeps it under a new token, and returns what the preview dialog needs. */
  const pickCsv = async (title: string, emptyMessage: string, adapt = (h: string[], r: string[][]) => ({ headers: h, rows: r })) => {
    const options = { title, properties: ['openFile' as const], filters: [{ name: 'CSV file', extensions: ['csv'] }] }
    const parent = ctx.getWindow() ?? undefined
    const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
    if (r.canceled || !r.filePaths[0]) return null
    const path = r.filePaths[0]
    if ((await stat(path)).size > MAX_CSV_BYTES) throw new CsvError('That file is larger than 5 MB.')
    const parsed = parseCsv(decodeCsv(await readFile(path)))
    const { headers, rows } = adapt(parsed.headers, parsed.rows)
    if (!rows.length) throw new CsvError(emptyMessage)
    pendingCsv = { token: randomUUID(), headers, rows }
    return { token: pendingCsv.token, fileName: basename(path), headers, sample: rows.slice(0, 3), rowCount: rows.length }
  }
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
    // Attachment files stay while the interview is in Trash; deleteForever and the startup purge remove them.
    deleteInterview: (arg) => repo.deleteInterview(db, parse(idInput, arg)),
    listTrash: () => repo.listTrash(db),
    restoreFromTrash: (arg) => repo.restoreFromTrash(db, parse(trashRefInput, arg)),
    deleteForever: async (arg) => {
      const ref = parse(trashRefInput, arg)
      repo.deleteForever(db, ref) // throws unless the row is in this venture's Trash, so files are only touched then
      if (ref.kind === 'interview') await removeInterviewFiles(ctx.attachmentsDir, ref.id)
    },
    listHypotheses: (arg) => repo.listHypotheses(db, parse(versionInput, arg)),
    listHypothesisVersions: () => repo.listHypothesisVersions(db),
    saveHypothesis: (arg) => repo.saveHypothesis(db, parse(hypothesisInput, arg)),
    deleteHypothesis: (arg) => repo.deleteHypothesis(db, parse(idInput, arg)),
    addStarterHypotheses: () => repo.addStarterHypotheses(db),
    listEvidence: (arg) => repo.listEvidence(db, parse(idInput, arg)),
    getDashboard: () => repo.getDashboard(db),
    listDecisions: () => repo.listDecisions(db),
    recordDecision: (arg) => repo.recordDecision(db, parse(decisionInput, arg)),
    deleteDecision: (arg) => repo.deleteDecision(db, parse(idInput, arg)),
    getHome: () => repo.getHome(db),
    setWeeklyGoal: (arg) => repo.setWeeklyGoal(db, parse(weeklyGoalInput, arg)),
    saveTask: (arg) => repo.saveTask(db, parse(taskInput, arg)),
    deleteTask: (arg) => repo.deleteTask(db, parse(idInput, arg)),
    listInsights: () => repo.listInsights(db),
    saveInsight: (arg) => repo.saveInsight(db, parse(insightInput, arg)),
    deleteInsight: (arg) => repo.deleteInsight(db, parse(idInput, arg)),
    renameTag: (arg) => repo.renameTag(db, parse(tagRenameInput, arg)),
    listGuides: () => repo.listGuides(db),
    saveGuide: (arg) => repo.saveGuide(db, parse(guideInput, arg)),
    deleteGuide: (arg) => repo.deleteGuide(db, parse(idInput, arg)),
    backupNow: () => {
      const at = new Date()
      backupNow(db, ctx.backupsDir, at, 'manual')
      return { at: at.toISOString() }
    },
    exportWorkspace: async (arg) => {
      const opts = parse(exportOptions, arg)
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
        exportedBy: repo.getProfile(db)?.full_name ?? '',
        includeContactDetails: opts?.includeContactDetails ?? false
      })
      await writeFile(r.filePath, JSON.stringify(file, null, 2), 'utf8')
      return { path: r.filePath }
    },
    exportCsv: async (arg) => {
      const opts = parse(exportOptions, arg)
      const options = { title: 'Export CSV files into a folder', properties: ['openDirectory' as const, 'createDirectory' as const] }
      const parent = dialogParent()
      const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
      if (r.canceled || !r.filePaths[0]) return { canceled: true }
      return { path: exportCsv(db, r.filePaths[0], { includeContactDetails: opts?.includeContactDetails ?? false, date: today() }) }
    },
    saveSummaryPdf: async () => {
      const win = ctx.getWindow()
      if (!win) throw new Error('Open the app window first.')
      const venture = repo.getActiveVenture(db)?.venture.name ?? 'venture'
      const options = {
        title: 'Save summary PDF',
        defaultPath: join(app.getPath('documents'), `${slug(venture)}-summary-${today()}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const r = await dialog.showSaveDialog(win, options)
      if (r.canceled || !r.filePath) return { canceled: true }
      // Print CSS shows only the renderer's summary sheet, which sets its own page margins.
      const pdf = await win.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
      await writeFile(r.filePath, pdf)
      return { path: r.filePath }
    },
    pickContactsCsv: async () => {
      const f = await pickCsv('Import contacts from CSV', 'That file has a header row but no contacts.')
      return f ? { ...f, mapping: suggestMapping(f.headers) } : { canceled: true }
    },
    pickSurveyCsv: async () => {
      const f = await pickCsv('Import survey answers from CSV', 'That file has a header row but no answers.', qualtricsHeaders)
      return f ? { ...f, mapping: suggestSurveyMapping(f.headers) } : { canceled: true }
    },
    previewSurveyImport: (arg) => {
      const req = parse(surveyImportRequest, arg)
      const plan = planSurveyImport(db, csvFile(req.token), req.mapping)
      return { interviews: plan.rows.length, newContacts: plan.contacts.length, empty: plan.empty, duplicates: plan.duplicates, invalid: plan.invalid.slice(0, 5) }
    },
    applySurveyImport: (arg) => {
      const req = parse(surveyImportRequest, arg)
      const plan = planSurveyImport(db, csvFile(req.token), req.mapping)
      backupNow(db, ctx.backupsDir, new Date(), 'pre-import')
      const result = applySurveyImport(db, plan)
      pendingCsv = null
      ctx.send({ type: 'data-changed' })
      return result
    },
    cancelSurveyImport: (arg) => {
      if (pendingCsv?.token === arg) pendingCsv = null
    },
    previewContactImport: (arg) => {
      const req = parse(contactImportRequest, arg)
      const plan = planContactImport(db, csvRows(req.token), req.mapping, req.segment_id)
      return { add: plan.add.length, duplicates: plan.duplicates, noName: plan.noName, invalid: plan.invalid.slice(0, 5) }
    },
    applyContactImport: (arg) => {
      const req = parse(contactImportRequest, arg)
      const plan = planContactImport(db, csvRows(req.token), req.mapping, req.segment_id)
      backupNow(db, ctx.backupsDir, new Date(), 'pre-import')
      const added = applyContactImport(db, plan)
      pendingCsv = null
      ctx.send({ type: 'data-changed' })
      return { added }
    },
    cancelContactImport: (arg) => {
      if (pendingCsv?.token === arg) pendingCsv = null
    },
    getThresholds: () => repo.getThresholds(db),
    saveThresholds: (arg) => repo.saveThresholds(db, parse(thresholdsInput, arg)),
    addAttachment: async (arg) => {
      const interviewId = parse(idInput, arg)
      const options = {
        title: 'Attach a photo, recording, video or PDF',
        properties: ['openFile' as const],
        filters: [{ name: 'Photos, audio, video, PDF', extensions: Object.keys(ATTACHMENT_TYPES) }]
      }
      const parent = dialogParent()
      const r = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
      if (r.canceled || !r.filePaths[0]) return { canceled: true }
      return addAttachment(db, ctx.attachmentsDir, interviewId, r.filePaths[0])
    },
    listAttachments: (arg) => listAttachments(db, parse(idInput, arg)),
    openAttachment: async (arg) => {
      const error = await shell.openPath(attachmentPath(db, ctx.attachmentsDir, parse(idInput, arg)))
      if (error) throw new Error(`Couldn't open that file: ${error}`)
    },
    showAttachment: (arg) => shell.showItemInFolder(attachmentPath(db, ctx.attachmentsDir, parse(idInput, arg))),
    deleteAttachment: (arg) => deleteAttachment(db, ctx.attachmentsDir, parse(idInput, arg)),
    resetWorkspace: async (arg) => {
      const backup = await resetWorkspace(db, ctx.attachmentsDir, ctx.backupsDir, parse(confirmNameInput, arg))
      ctx.send({ type: 'data-changed' })
      return { backup }
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
      // Only our own window's main frame may call the API.
      if (event.sender !== ctx.getWindow()?.webContents || event.senderFrame !== event.sender.mainFrame) {
        throw new Error('Blocked: unknown sender')
      }
      return handler(arg)
    })
  }
}
