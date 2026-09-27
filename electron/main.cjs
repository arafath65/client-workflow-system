const {
  app,
  BrowserWindow,
  dialog,
} = require("electron");

const {
  spawn,
} = require("node:child_process");

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const APP_URL = "http://127.0.0.1:3000";
const PORT = 3000;

let mainWindow = null;
let nextProcess = null;
let logStream = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId("com.aiglobal.clientworkflow");

    setupLogging();

    try {
      await startNextServer();
      await waitForServer();
      createMainWindow();
    } catch (error) {
      logError(error);

      dialog.showErrorBox(
        "A&I Global Workflow System",
        `The application could not start.\n\n${
          error instanceof Error ? error.message : String(error)
        }`
      );

      app.quit();
    }
  });
}

function getNextRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "next");
  }

  return path.join(__dirname, "..", ".next", "standalone");
}

function getNodeModulesPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "next",
      "modules"
    );
  }

  return path.join(
    getNextRoot(),
    "node_modules"
  );
}

function getIconPath() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "ai-global-logo.ico"
    );
  }

  return path.join(
    __dirname,
    "ai-global-logo.ico"
  );
}

function setupLogging() {
  try {
    const logDirectory = path.join(
      app.getPath("userData"),
      "logs"
    );

    fs.mkdirSync(logDirectory, {
      recursive: true,
    });

    const logFile = path.join(
      logDirectory,
      "server.log"
    );

    logStream = fs.createWriteStream(
      logFile,
      {
        flags: "a",
      }
    );

    logStream.write(
      `\n\n===== Application started ${new Date().toISOString()} =====\n`
    );
  } catch {
    logStream = null;
  }
}

function logMessage(message) {
  const text = `[${new Date().toISOString()}] ${message}\n`;

  console.log(text.trim());

  if (logStream) {
    logStream.write(text);
  }
}

function logError(error) {
  const message =
    error instanceof Error
      ? error.stack || error.message
      : String(error);

  logMessage(`ERROR: ${message}`);
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    const nextRoot = getNextRoot();

    const serverPath = path.join(
      nextRoot,
      "server.js"
    );

    if (!fs.existsSync(serverPath)) {
      reject(
        new Error(
          `Next.js standalone server not found:\n\n${serverPath}\n\nRun the desktop build again.`
        )
      );

      return;
    }

    logMessage(
      `Starting Next.js server: ${serverPath}`
    );

    logMessage(
      `Working directory: ${nextRoot}`
    );

    const nodeModulesPath = getNodeModulesPath();

const env = {
  ...process.env,

  NODE_ENV: "production",

  PORT: String(PORT),

  HOSTNAME: "127.0.0.1",

  ELECTRON_RUN_AS_NODE: "1",

  ELECTRON_NO_ATTACH_CONSOLE: "1",

  NODE_PATH:
    nodeModulesPath +
    path.delimiter +
    (process.env.NODE_PATH || ""),
};

    nextProcess = spawn(
      process.execPath,
      [serverPath],
      {
        cwd: nextRoot,
        env,
        windowsHide: true,
        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      }
    );

    nextProcess.stdout.on(
      "data",
      (data) => {
        logMessage(
          `[Next.js] ${data.toString().trim()}`
        );
      }
    );

    nextProcess.stderr.on(
      "data",
      (data) => {
        logMessage(
          `[Next.js ERROR] ${data.toString().trim()}`
        );
      }
    );

    nextProcess.once(
      "spawn",
      () => {
        logMessage(
          `Next.js child process started. PID: ${nextProcess.pid}`
        );

        resolve();
      }
    );

    nextProcess.once(
      "error",
      (error) => {
        logError(
          new Error(
            `Failed to start Next.js child process: ${
              error.message
            }`
          )
        );

        reject(error);
      }
    );

    nextProcess.once(
      "exit",
      (code, signal) => {
        logMessage(
          `Next.js process exited. Code: ${code}, Signal: ${
            signal || "none"
          }`
        );

        if (
          mainWindow &&
          !mainWindow.isDestroyed()
        ) {
          dialog.showErrorBox(
            "A&I Global Workflow System",
            `The application server stopped unexpectedly.\n\nExit code: ${
              code ?? "unknown"
            }\nSignal: ${signal || "none"}`
          );

          app.quit();
        }
      }
    );
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const maxAttempts = 60;

    let attempts = 0;

    function check() {
      attempts += 1;

      logMessage(
        `Checking Next.js server (${attempts}/${maxAttempts})...`
      );

      const request = http.get(
        `${APP_URL}/login`,
        (response) => {
          response.resume();

          logMessage(
            `Server responded with HTTP ${response.statusCode}.`
          );

          if (
            response.statusCode &&
            response.statusCode < 500
          ) {
            resolve();
            return;
          }

          retry();
        }
      );

      request.setTimeout(
        2000,
        () => {
          request.destroy();
          retry();
        }
      );

      request.on(
        "error",
        (error) => {
          logMessage(
            `Server check failed: ${error.message}`
          );

          retry();
        }
      );
    }

    function retry() {
      if (attempts >= maxAttempts) {
        reject(
          new Error(
            `The Next.js server did not respond at ${APP_URL} within the expected time.`
          )
        );

        return;
      }

      setTimeout(
        check,
        500
      );
    }

    check();
  });
}

function createMainWindow() {
  const iconPath = getIconPath();

  const windowOptions = {
    width: 1440,

    height: 900,

    minWidth: 1100,

    minHeight: 700,

    show: false,

    title: "A&I Global Workflow System",

    backgroundColor: "#ffffff",

    webPreferences: {
      contextIsolation: true,

      nodeIntegration: false,

      sandbox: true,
    },
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(
    windowOptions
  );

  mainWindow.removeMenu();

  mainWindow.loadURL(APP_URL);

  mainWindow.once(
    "ready-to-show",
    () => {
      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        mainWindow.show();
      }
    }
  );

  mainWindow.on(
    "closed",
    () => {
      mainWindow = null;
    }
  );
}

function stopNextServer() {
  if (!nextProcess) {
    return;
  }

  logMessage(
    "Stopping Next.js server..."
  );

  try {
    nextProcess.kill();
  } catch (error) {
    logError(error);
  }

  nextProcess = null;
}

app.on(
  "before-quit",
  () => {
    stopNextServer();

    if (logStream) {
      logStream.write(
        `===== Application closed ${new Date().toISOString()} =====\n`
      );

      logStream.end();

      logStream = null;
    }
  }
);

app.on(
  "window-all-closed",
  () => {
    app.quit();
  }
);