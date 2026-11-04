import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENT_CHANNEL, INVOKE_CHANNELS, type Api, type AppEvent } from '../shared/api'

// Expose named functions only; never ipcRenderer itself.
const invoke = Object.fromEntries(
  INVOKE_CHANNELS.map((channel) => [channel, (arg?: unknown) => ipcRenderer.invoke(channel, arg)])
)

const api = {
  ...invoke,
  onEvent(listener: (event: AppEvent) => void) {
    const handler = (_e: IpcRendererEvent, event: AppEvent) => listener(event)
    ipcRenderer.on(EVENT_CHANNEL, handler)
    return () => {
      ipcRenderer.removeListener(EVENT_CHANNEL, handler)
    }
  }
} as unknown as Api

contextBridge.exposeInMainWorld('api', api)
