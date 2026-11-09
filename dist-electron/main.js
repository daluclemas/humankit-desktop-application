"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const main_1 = require("@smartspectra/node-sdk/main");
let mainWindow = null;
const isDev = !electron_1.app.isPackaged;
const DEV_URL = "http://localhost:3000";
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: "#f8f8fc",
        webPreferences: {
            // Presage's own preload file. It is the bridge between the screen and Presage.
            preload: require.resolve("@smartspectra/node-sdk/preload"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    // Lets the screen talk to Presage running in the main process.
    (0, main_1.bindSmartSpectraIpc)(mainWindow);
    if (isDev)
        mainWindow.loadURL(DEV_URL);
    else
        mainWindow.loadFile(node_path_1.default.join(__dirname, "../out/index.html"));
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    // Camera and microphone only, and only for our own pages. Everything else is refused.
    electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const url = details?.requestingUrl || webContents.getURL() || "";
        const ourPage = url.startsWith("file://") || (isDev && url.startsWith(DEV_URL));
        const mediaTypes = details.mediaTypes ?? [];
        const cameraOrMic = mediaTypes.every((type) => type === "video" || type === "audio");
        callback(permission === "media" && cameraOrMic && ourPage);
    });
    electron_1.ipcMain.handle("app:get-version", () => electron_1.app.getVersion());
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
