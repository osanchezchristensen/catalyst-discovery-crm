// The typed IPC contract. Each invoke method's name is also its IPC channel.
import type {
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

export type StatusTone = 'success' | 'error'
export type AppEvent =
  | { type: 'about' }
  | { type: 'import-preview'; preview: ImportPreview }
  | { type: 'status'; tone: StatusTone; message: string }
  | { type: 'data-changed' }
  | { type: 'log-interview' }

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
  listGuides(): Promise<Guide[]>
  saveGuide(input: GuideInput): Promise<Guide>
  deleteGuide(id: string): Promise<void>
  backupNow(): Promise<{ at: string }>
  exportWorkspace(): Promise<{ path: string } | Canceled>
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
  'listGuides',
  'saveGuide',
  'deleteGuide',
  'backupNow',
  'exportWorkspace',
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
