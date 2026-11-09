"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
let mainWindow = null;
const isDev = !electron_1.app.isPackaged;
function createWindow() { mainWindow = new electron_1.BrowserWindow({ width: 1280, height: 820, minWidth: 960, minHeight: 640, backgroundColor: '#f8f8fc', webPreferences: { preload: node_path_1.default.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } }); if (isDev)
    mainWindow.loadURL('http://localhost:3000');
else
    mainWindow.loadFile(node_path_1.default.join(__dirname, '../out/index.html')); mainWindow.on('closed', () => { mainWindow = null; }); }
electron_1.app.whenReady().then(() => { electron_1.ipcMain.handle('app:get-version', () => electron_1.app.getVersion()); createWindow(); electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
    createWindow(); }); });
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
