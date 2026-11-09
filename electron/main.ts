import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "node:path";
import { bindSmartSpectraIpc } from "@smartspectra/node-sdk/main";

let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:3000";

function createWindow() {
  mainWindow = new BrowserWindow({
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
  bindSmartSpectraIpc(mainWindow);

  if (isDev) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, "../out/index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Camera only, and only for our own pages. Everything else is refused.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const url = details?.requestingUrl || webContents.getURL() || "";
      const ourPage =
        url.startsWith("file://") || (isDev && url.startsWith(DEV_URL));
      const mediaTypes =
        (details as { mediaTypes?: string[] }).mediaTypes ?? [];
      const cameraOnly = mediaTypes.length === 1 && mediaTypes[0] === "video";
      callback(permission === "media" && cameraOnly && ourPage);
    },
  );

  ipcMain.handle("app:get-version", () => app.getVersion());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
