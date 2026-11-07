import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'

let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged
function createWindow() { mainWindow = new BrowserWindow({ width:1280, height:820, minWidth:960, minHeight:640, backgroundColor:'#f8f8fc', webPreferences:{ preload:path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:true } }); if(isDev) mainWindow.loadURL('http://localhost:3000'); else mainWindow.loadFile(path.join(__dirname,'../out/index.html')); mainWindow.on('closed',()=>{mainWindow=null}) }
app.whenReady().then(()=>{ ipcMain.handle('app:get-version',()=>app.getVersion()); createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()}) })
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})
