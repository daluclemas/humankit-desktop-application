import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('humanKit', { getAppVersion: () => ipcRenderer.invoke('app:get-version') })
