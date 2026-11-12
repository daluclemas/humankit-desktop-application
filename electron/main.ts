// import { app, BrowserWindow, ipcMain, session } from "electron";
// import path from "node:path";
// import { bindSmartSpectraIpc } from "@smartspectra/node-sdk/main";

// let mainWindow: BrowserWindow | null = null;
// const isDev = !app.isPackaged;
// const DEV_URL = "http://localhost:3000";

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1280,
//     height: 820,
//     minWidth: 960,
//     minHeight: 640,
//     backgroundColor: "#f8f8fc",
//     webPreferences: {
//       // Presage's own preload file. It is the bridge between the screen and Presage.
//       preload: require.resolve("@smartspectra/node-sdk/preload"),
//       contextIsolation: true,
//       nodeIntegration: false,
//       sandbox: true,
//     },
//   });

//   // Lets the screen talk to Presage running in the main process.
//   bindSmartSpectraIpc(mainWindow);

//   if (isDev) mainWindow.loadURL(DEV_URL);
//   else mainWindow.loadFile(path.join(__dirname, "../out/index.html"));

//   mainWindow.on("closed", () => {
//     mainWindow = null;
//   });
// }

// app.whenReady().then(() => {
//   // Camera and microphone only, and only for our own pages. Everything else is refused.
//   session.defaultSession.setPermissionRequestHandler(
//     (webContents, permission, callback, details) => {
//       const url = details?.requestingUrl || webContents.getURL() || "";
//       const ourPage =
//         url.startsWith("file://") || (isDev && url.startsWith(DEV_URL));
//       const mediaTypes =
//         (details as { mediaTypes?: string[] }).mediaTypes ?? [];
//       const cameraOrMic = mediaTypes.every(
//         (type) => type === "video" || type === "audio",
//       );
//       callback(permission === "media" && cameraOrMic && ourPage);
//     },
//   );

//   ipcMain.handle("app:get-version", () => app.getVersion());
//   createWindow();
//   app.on("activate", () => {
//     if (BrowserWindow.getAllWindows().length === 0) createWindow();
//   });
// });

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") app.quit();
// });

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
  // Grant media access only to this app window and only for explicit audio/video requests.
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl ?? webContents.getURL();
      const mediaTypes =
        (details as { mediaTypes?: string[] } | undefined)?.mediaTypes ?? [];

      let isOurPage = false;
      try {
        const requested = new URL(requestingUrl);
        const current = new URL(
          mainWindow?.webContents.getURL() ?? "about:blank",
        );
        const isSameDevOrigin =
          isDev &&
          requested.origin === new URL(DEV_URL).origin &&
          current.origin === new URL(DEV_URL).origin;
        const isSamePackagedPage =
          requested.protocol === "file:" &&
          current.protocol === "file:" &&
          requested.pathname === current.pathname;
        isOurPage =
          webContents === mainWindow?.webContents &&
          (isSameDevOrigin || isSamePackagedPage);
      } catch {
        isOurPage = false;
      }

      const validMediaRequest =
        mediaTypes.length > 0 &&
        mediaTypes.every((type) => type === "video" || type === "audio");

      callback(permission === "media" && validMediaRequest && isOurPage);
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
