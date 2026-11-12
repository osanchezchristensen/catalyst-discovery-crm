// The typed IPC contract. Each invoke method's name is also its IPC channel.
import type {
  Attachment,
  ContactField,
  ContactImportRequest,
  SurveyImportRequest,
  SurveyMapping,
  Thresholds,
  TagRenameInput,
  Contact,
  ContactInput,
  ContactStage,
  Dashboard,
  Guide,
  GuideInput,
  Home,
  Insight,
  InsightInput,
  Task,
  TaskInput,
  Decision,
  DecisionInput,
  EvidenceLink,
  Hypothesis,
  HypothesisInput,
  Interview,
  InterviewInput,
  Profile,
  ProfileInput,
  VentureBundle,
  VentureBundleInput,
  VentureCreateInput,
  WorkspaceTable
} from './schema'

export type AppInfo = { version: string; dataDir: string; lastBackupAt: string | null }
export type Canceled = { canceled: true }
export type TableCounts = { added: number; updated: number; unchanged: number }
export type ImportPreview = {
  token: string
  fileName: string
  exportedBy: string
  exportedAt: string
  counts: Partial<Record<WorkspaceTable, TableCounts>>
}
export type ImportResult = { counts: Partial<Record<WorkspaceTable, TableCounts>> }

export type ContactCsvFile = {
  token: string
  fileName: string
  headers: string[]
  sample: string[][]
  rowCount: number
  mapping: Partial<Record<ContactField, number | null>>
}
export type ContactImportPreview = { add: number; duplicates: number; noName: number; invalid: { row: number; message: string }[] }

export type SurveyCsvFile = { token: string; fileName: string; headers: string[]; sample: string[][]; rowCount: number; mapping: SurveyMapping }
export type SurveyImportPreview = {
  interviews: number
  newContacts: number
  empty: number
  duplicates: number
  invalid: { row: number; message: string }[]
}

export type StatusTone = 'success' | 'error'
export type AppEvent =
  | { type: 'about' }
  | { type: 'import-preview'; preview: ImportPreview }
  | { type: 'status'; tone: StatusTone; message: string }
  | { type: 'data-changed' }
  | { type: 'log-interview' }
  | { type: 'import-contacts' }
  | { type: 'import-surveys' }
  | { type: 'search' }

export interface InvokeApi {
  getAppInfo(): Promise<AppInfo>
  openDataFolder(): Promise<void>
  getProfile(): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<Profile>
  getActiveVenture(): Promise<VentureBundle | null>
  createVenture(input: VentureCreateInput): Promise<VentureBundle>
  saveVenture(input: VentureBundleInput): Promise<VentureBundle>
  listContacts(): Promise<Contact[]>
  saveContact(input: ContactInput): Promise<Contact>
  setContactStage(input: { id: string; stage: ContactStage }): Promise<void>
  deleteContact(id: string): Promise<void>
  listInterviews(): Promise<Interview[]>
  getInterview(id: string): Promise<Interview | null>
  saveInterview(input: InterviewInput): Promise<Interview>
  deleteInterview(id: string): Promise<void>
  listHypotheses(version?: number): Promise<Hypothesis[]>
  listHypothesisVersions(): Promise<number[]>
  saveHypothesis(input: HypothesisInput): Promise<Hypothesis>
  deleteHypothesis(id: string): Promise<void>
  addStarterHypotheses(): Promise<Hypothesis[]>
  listEvidence(hypothesisId: string): Promise<EvidenceLink[]>
  getDashboard(): Promise<Dashboard>
  listDecisions(): Promise<Decision[]>
  recordDecision(input: DecisionInput): Promise<Decision>
  deleteDecision(id: string): Promise<void>
  getHome(): Promise<Home>
  setWeeklyGoal(goal: number): Promise<void>
  saveTask(input: TaskInput): Promise<Task>
  deleteTask(id: string): Promise<void>
  listInsights(): Promise<Insight[]>
  saveInsight(input: InsightInput): Promise<Insight>
  deleteInsight(id: string): Promise<void>
  /** Rename, merge or delete (`to: null`) a tag on every insight; returns how many changed. */
  renameTag(input: TagRenameInput): Promise<number>
  listGuides(): Promise<Guide[]>
  saveGuide(input: GuideInput): Promise<Guide>
  deleteGuide(id: string): Promise<void>
  backupNow(): Promise<{ at: string }>
  exportWorkspace(opts?: { includeContactDetails: boolean }): Promise<{ path: string } | Canceled>
  exportCsv(opts: { includeContactDetails: boolean }): Promise<{ path: string } | Canceled>
  pickContactsCsv(): Promise<ContactCsvFile | Canceled>
  pickSurveyCsv(): Promise<SurveyCsvFile | Canceled>
  previewSurveyImport(req: SurveyImportRequest): Promise<SurveyImportPreview>
  applySurveyImport(req: SurveyImportRequest): Promise<{ interviews: number; contacts: number }>
  cancelSurveyImport(token: string): Promise<void>
  previewContactImport(req: ContactImportRequest): Promise<ContactImportPreview>
  applyContactImport(req: ContactImportRequest): Promise<{ added: number }>
  cancelContactImport(token: string): Promise<void>
  getThresholds(): Promise<Thresholds>
  saveThresholds(t: Thresholds): Promise<Thresholds>
  addAttachment(interviewId: string): Promise<Attachment | Canceled>
  listAttachments(interviewId: string): Promise<Attachment[]>
  openAttachment(id: string): Promise<void>
  showAttachment(id: string): Promise<void>
  deleteAttachment(id: string): Promise<void>
  resetWorkspace(confirmName: string): Promise<{ backup: string }>
  pickImport(): Promise<ImportPreview | Canceled>
  applyImport(token: string): Promise<ImportResult>
  cancelImport(token: string): Promise<void>
}

export const INVOKE_CHANNELS = [
  'getAppInfo',
  'openDataFolder',
  'getProfile',
  'saveProfile',
  'getActiveVenture',
  'createVenture',
  'saveVenture',
  'listContacts',
  'saveContact',
  'setContactStage',
  'deleteContact',
  'listInterviews',
  'getInterview',
  'saveInterview',
  'deleteInterview',
  'listHypotheses',
  'listHypothesisVersions',
  'saveHypothesis',
  'deleteHypothesis',
  'addStarterHypotheses',
  'listEvidence',
  'getDashboard',
  'listDecisions',
  'recordDecision',
  'deleteDecision',
  'getHome',
  'setWeeklyGoal',
  'saveTask',
  'deleteTask',
  'listInsights',
  'saveInsight',
  'deleteInsight',
  'renameTag',
  'listGuides',
  'saveGuide',
  'deleteGuide',
  'backupNow',
  'exportWorkspace',
  'exportCsv',
  'pickContactsCsv',
  'pickSurveyCsv',
  'previewSurveyImport',
  'applySurveyImport',
  'cancelSurveyImport',
  'previewContactImport',
  'applyContactImport',
  'cancelContactImport',
  'getThresholds',
  'saveThresholds',
  'addAttachment',
  'listAttachments',
  'openAttachment',
  'showAttachment',
  'deleteAttachment',
  'resetWorkspace',
  'pickImport',
  'applyImport',
  'cancelImport'
] as const satisfies readonly (keyof InvokeApi)[]
// Compile error here means a method is missing from INVOKE_CHANNELS.
export const channelsComplete: Exclude<keyof InvokeApi, (typeof INVOKE_CHANNELS)[number]> extends never
  ? true
  : never = true

export const EVENT_CHANNEL = 'app-event'

export interface Api extends InvokeApi {
  onEvent(listener: (event: AppEvent) => void): () => void
}
