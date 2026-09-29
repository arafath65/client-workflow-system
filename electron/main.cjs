const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
} = require("electron");

const {
  spawn,
} = require("node:child_process");

const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const APP_URL =
  "http://127.0.0.1:3000";

const PORT = 3000;

let mainWindow = null;
let setupWindow = null;
let nextProcess = null;
let logStream = null;

const gotTheLock =
  app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on(
    "second-instance",
    () => {
      if (setupWindow) {
        if (setupWindow.isMinimized()) {
          setupWindow.restore();
        }

        setupWindow.focus();
        return;
      }

      if (!mainWindow) {
        return;
      }

      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  );

  app.whenReady().then(
    async () => {
      app.setAppUserModelId(
        "com.aiglobal.clientworkflow"
      );

      setupLogging();

      registerIpcHandlers();

      try {
        await startApplication();
      } catch (error) {
        logError(error);

        dialog.showErrorBox(
          "A&I Global Workflow System",
          `The application could not start.\n\n${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );

        app.quit();
      }
    }
  );
}

function registerIpcHandlers() {
  ipcMain.handle(
    "database:get-config",
    () => {
      return readDatabaseConfig();
    }
  );

  ipcMain.handle(
    "database:test-connection",
    async (_event, config) => {
      let serverStarted = false;

      try {
        const normalized =
          normalizeDatabaseConfig(
            config
          );

        if (nextProcess) {
          stopNextServer();
        }

        applyDatabaseConfig(
          normalized
        );

        await startNextServer();

        serverStarted = true;

        await waitForServer();

        const result =
          await testRunningDatabase();

        return result;
      } catch (error) {
        logError(error);

        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              error
            ),
        };
      } finally {
        if (serverStarted) {
          stopNextServer();
        }
      }
    }
  );

  ipcMain.handle(
    "database:save-and-start",
    async (_event, config) => {
      try {
        const normalized =
          normalizeDatabaseConfig(
            config
          );

        if (nextProcess) {
          stopNextServer();
        }

        applyDatabaseConfig(
          normalized
        );

        await startNextServer();

        await waitForServer();

        const result =
          await testRunningDatabase();

        if (!result.success) {
          stopNextServer();

          return result;
        }

        saveDatabaseConfig(
          normalized
        );

        //
        // IMPORTANT:
        // Create the main window BEFORE
        // closing the setup window.
        //
        // This prevents the setup window's
        // "closed" event from calling app.quit().
        //

        createMainWindow();

        if (
          setupWindow &&
          !setupWindow.isDestroyed()
        ) {
          setupWindow.close();
        }

        return {
          success: true,
          message:
            "Database connected successfully.",
        };
      } catch (error) {
        logError(error);

        stopNextServer();

        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              error
            ),
        };
      }
    }
  );

  ipcMain.handle(
    "application:exit",
    () => {
      app.quit();
    }
  );
}

function getNextRoot() {
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      "next"
    );
  }

  return path.join(
    __dirname,
    "..",
    ".next",
    "standalone"
  );
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

function getConfigDirectory() {
  return path.join(
    app.getPath("userData"),
    "config"
  );
}

function getConfigFilePath() {
  return path.join(
    getConfigDirectory(),
    "app.env"
  );
}

function setupLogging() {
  try {
    const logDirectory =
      path.join(
        app.getPath("userData"),
        "logs"
      );

    fs.mkdirSync(
      logDirectory,
      {
        recursive: true,
      }
    );

    const logFile =
      path.join(
        logDirectory,
        "server.log"
      );

    logStream =
      fs.createWriteStream(
        logFile,
        {
          flags: "a",
        }
      );

    logStream.write(
      `\n===== Application started ${new Date().toISOString()} =====\n`
    );
  } catch {
    logStream = null;
  }
}

function logMessage(message) {
  const text =
    `[${new Date().toISOString()}] ${message}\n`;

  console.log(
    text.trim()
  );

  if (logStream) {
    logStream.write(text);
  }
}

function logError(error) {
  const message =
    error instanceof Error
      ? error.stack ||
        error.message
      : String(error);

  logMessage(
    `ERROR: ${message}`
  );
}

function parseEnvFile(content) {
  const result = {};

  const lines =
    content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed =
      line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#")
    ) {
      continue;
    }

    const separatorIndex =
      trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key =
      trimmed
        .slice(
          0,
          separatorIndex
        )
        .trim();

    let value =
      trimmed
        .slice(
          separatorIndex + 1
        )
        .trim();

    if (
      value.length >= 2 &&
      (
        (
          value.startsWith('"') &&
          value.endsWith('"')
        ) ||
        (
          value.startsWith("'") &&
          value.endsWith("'")
        )
      )
    ) {
      value =
        value.slice(
          1,
          -1
        );
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

function normalizeDatabaseConfig(
  config
) {
  if (
    !config ||
    typeof config !== "object"
  ) {
    throw new Error(
      "Invalid database configuration."
    );
  }

  const host =
    String(
      config.host || ""
    ).trim();

  const port =
    String(
      config.port || ""
    ).trim();

  const username =
    String(
      config.username || ""
    ).trim();

  const password =
    String(
      config.password || ""
    );

  const database =
    String(
      config.database || ""
    ).trim();

  if (!host) {
    throw new Error(
      "Database host is required."
    );
  }

  if (
    !/^\d+$/.test(port)
  ) {
    throw new Error(
      "Database port is invalid."
    );
  }

  const numericPort =
    Number(port);

  if (
    numericPort < 1 ||
    numericPort > 65535
  ) {
    throw new Error(
      "Database port must be between 1 and 65535."
    );
  }

  if (!username) {
    throw new Error(
      "Database username is required."
    );
  }

  if (!database) {
    throw new Error(
      "Database name is required."
    );
  }

  return {
    host,
    port: String(
      numericPort
    ),
    username,
    password,
    database,
  };
}

function applyDatabaseConfig(
  config
) {
  process.env.DATABASE_URL =
    buildDatabaseUrl(
      config
    );

  process.env.DB_HOST =
    config.host;

  process.env.DB_PORT =
    config.port;

  process.env.DB_USER =
    config.username;

  process.env.DB_PASSWORD =
    config.password;

  process.env.DB_NAME =
    config.database;

  logMessage(
    "Database configuration applied to the application process."
  );
}

async function testRunningDatabase() {
  const response =
    await fetch(
      `${APP_URL}/api/test-db`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

  let payload = null;

  try {
    payload =
      await response.json();
  } catch {
    payload = null;
  }

  if (
    response.ok &&
    payload?.success !== false
  ) {
    return {
      success: true,
      message:
        "Database connection successful.",
    };
  }

  const rawMessage =
    payload &&
    typeof payload.message ===
      "string"
      ? payload.message
      : "";

  const lowerMessage =
    rawMessage.toLowerCase();

  if (
    lowerMessage.includes(
      "access denied"
    ) ||
    lowerMessage.includes(
      "authentication"
    ) ||
    lowerMessage.includes(
      "password"
    ) ||
    lowerMessage.includes(
      "credential"
    )
  ) {
    return {
      success: false,
      message:
        "Incorrect database username or password.",
    };
  }

  if (
    lowerMessage.includes(
      "unknown database"
    )
  ) {
    return {
      success: false,
      message:
        "Database does not exist. Please check the database name.",
    };
  }

  return {
    success: false,
    message:
      "Unable to connect to the database. Please check the host, port, username, password, and database name.",
  };
}

function getDatabaseErrorMessage(
  error
) {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const lower =
    message.toLowerCase();

  if (
    lower.includes(
      "access denied"
    ) ||
    lower.includes(
      "authentication"
    ) ||
    lower.includes(
      "password"
    ) ||
    lower.includes(
      "credential"
    )
  ) {
    return (
      "Incorrect database username or password."
    );
  }

  if (
    lower.includes(
      "unknown database"
    )
  ) {
    return (
      "Database does not exist. Please check the database name."
    );
  }

  if (
    lower.includes(
      "econnrefused"
    ) ||
    lower.includes(
      "connect"
    )
  ) {
    return (
      "Unable to connect to the database. Please check the host and port."
    );
  }

  return (
    message ||
    "Unable to connect to the database."
  );
}

function readDatabaseConfig() {
  const defaults = {
    host: "127.0.0.1",
    port: "3306",
    username: "root",
    password: "",
    database:
      "client_workflow_db",
  };

  const configFile =
    getConfigFilePath();

  if (
    !fs.existsSync(configFile)
  ) {
    return defaults;
  }

  try {
    const content =
      fs.readFileSync(
        configFile,
        "utf8"
      );

    const parsed =
      parseEnvFile(
        content
      );

    return {
      host:
        parsed.DB_HOST ||
        defaults.host,

      port:
        parsed.DB_PORT ||
        defaults.port,

      username:
        parsed.DB_USER ||
        defaults.username,

      password:
        parsed.DB_PASSWORD || "",

      database:
        parsed.DB_NAME ||
        defaults.database,
    };
  } catch (error) {
    logError(error);

    return defaults;
  }
}

function isDatabaseConfigValid() {
  const configFile =
    getConfigFilePath();

  if (
    !fs.existsSync(configFile)
  ) {
    return false;
  }

  try {
    const content =
      fs.readFileSync(
        configFile,
        "utf8"
      );

    const parsed =
      parseEnvFile(
        content
      );

    const hasDatabaseUrl =
      Boolean(
        parsed.DATABASE_URL
      );

    const hasDatabaseSettings =
      Boolean(
        parsed.DB_HOST &&
        parsed.DB_PORT &&
        parsed.DB_USER &&
        parsed.DB_NAME
      );

    return (
      hasDatabaseUrl ||
      hasDatabaseSettings
    );
  } catch (error) {
    logError(error);

    return false;
  }
}

function quoteEnvValue(value) {
  return JSON.stringify(
    String(value ?? "")
  );
}

function buildDatabaseUrl({
  host,
  port,
  username,
  password,
  database,
}) {
  const encodedUsername =
    encodeURIComponent(
      username
    );

  const encodedDatabase =
    encodeURIComponent(
      database
    );

  const encodedHost =
    host.includes(":") &&
    !host.startsWith("[")
      ? `[${host}]`
      : host;

  if (password) {
    return (
      `mysql://${encodedUsername}:` +
      `${encodeURIComponent(
        password
      )}` +
      `@${encodedHost}:${port}/` +
      encodedDatabase
    );
  }

  return (
    `mysql://${encodedUsername}` +
    `@${encodedHost}:${port}/` +
    encodedDatabase
  );
}
function saveDatabaseConfig(
  config
) {
  const normalized =
    normalizeDatabaseConfig(
      config
    );

  const configDirectory =
    getConfigDirectory();

  fs.mkdirSync(
    configDirectory,
    {
      recursive: true,
    }
  );

  const databaseUrl =
    buildDatabaseUrl(
      normalized
    );

  const content =
    `# A&I Global Workflow System\n` +
    `# Client database configuration\n\n` +
    `DATABASE_URL=${quoteEnvValue(
      databaseUrl
    )}\n\n` +
    `DB_HOST=${quoteEnvValue(
      normalized.host
    )}\n` +
    `DB_PORT=${quoteEnvValue(
      normalized.port
    )}\n` +
    `DB_USER=${quoteEnvValue(
      normalized.username
    )}\n` +
    `DB_PASSWORD=${quoteEnvValue(
      normalized.password
    )}\n` +
    `DB_NAME=${quoteEnvValue(
      normalized.database
    )}\n`;

  fs.writeFileSync(
    getConfigFilePath(),
    content,
    "utf8"
  );

  logMessage(
    `Database configuration saved to ${getConfigFilePath()}`
  );
}

function loadDevelopmentEnvironment() {
  if (app.isPackaged) {
    return;
  }

  const projectEnvPath = path.join(
    __dirname,
    "..",
    ".env"
  );

  if (!fs.existsSync(projectEnvPath)) {
    throw new Error(
      `Development database configuration not found:\n\n${projectEnvPath}`
    );
  }

  const content = fs.readFileSync(
    projectEnvPath,
    "utf8"
  );

  const config = parseEnvFile(content);

  Object.assign(
    process.env,
    config
  );

  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL
  );

  const hasDatabaseSettings = Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );

  if (
    !hasDatabaseUrl &&
    !hasDatabaseSettings
  ) {
    throw new Error(
      `Development database configuration is incomplete:\n\n${projectEnvPath}`
    );
  }

  logMessage(
    `Development database configuration loaded from: ${projectEnvPath}`
  );
}

function loadPackagedEnvironment() {
  if (!app.isPackaged) {
    return;
  }

  const configFile =
    getConfigFilePath();

  if (
    !fs.existsSync(configFile)
  ) {
    throw new Error(
      `Database configuration file not found:\n\n${configFile}`
    );
  }

  const content =
    fs.readFileSync(
      configFile,
      "utf8"
    );

  const config =
    parseEnvFile(
      content
    );

  Object.assign(
    process.env,
    config
  );

  const hasDatabaseUrl =
    Boolean(
      process.env.DATABASE_URL
    );

  const hasDatabaseSettings =
    Boolean(
      process.env.DB_HOST &&
      process.env.DB_USER &&
      process.env.DB_NAME
    );

  if (
    !hasDatabaseUrl &&
    !hasDatabaseSettings
  ) {
    throw new Error(
      `Database configuration is incomplete:\n\n${configFile}`
    );
  }

  logMessage(
    "Packaged database configuration loaded."
  );
}

async function startApplication() {
  if (mainWindow) {
    if (
      mainWindow.isMinimized()
    ) {
      mainWindow.restore();
    }

    mainWindow.focus();

    return;
  }

  if (app.isPackaged) {
    const forceSetup =
      process.argv.includes(
        "--setup"
      );

    if (
      forceSetup ||
      !isDatabaseConfigValid()
    ) {
      createSetupWindow();
      return;
    }

    // Packaged application:
    // Load the customer's database configuration
    // from %APPDATA%/client-workflow-system/config/app.env
    loadPackagedEnvironment();
  } else {
    // Development application:
    // Use the project's local .env file.
    loadDevelopmentEnvironment();
  }

  await startNextServer();

  await waitForServer();

  createMainWindow();
}

function createSetupWindow() {
  if (setupWindow) {
    if (
      setupWindow.isMinimized()
    ) {
      setupWindow.restore();
    }

    setupWindow.focus();

    return;
  }

  setupWindow =
    new BrowserWindow({
      width: 720,
      height: 720,
      minWidth: 640,
      minHeight: 620,
      resizable: false,
      show: false,
      title:
        "A&I Global Workflow System - Database Setup",
      backgroundColor:
        "#f6f6f4",
      autoHideMenuBar: true,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.cjs"
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false,

        sandbox:
          true,
      },
    });

  setupWindow.loadFile(
    path.join(
      __dirname,
      "setup.html"
    )
  );

  setupWindow.once(
    "ready-to-show",
    () => {
      if (
        setupWindow &&
        !setupWindow.isDestroyed()
      ) {
        setupWindow.show();
      }
    }
  );

  setupWindow.on(
    "closed",
    () => {
      setupWindow = null;

      if (!mainWindow) {
        app.quit();
      }
    }
  );
}

function startNextServer() {
  return new Promise(
    (resolve, reject) => {
      try {

        const nextRoot =
          getNextRoot();

        const serverPath =
          path.join(
            nextRoot,
            "server.js"
          );

        if (
          !fs.existsSync(
            serverPath
          )
        ) {
          reject(
            new Error(
              `Next.js standalone server not found:\n\n${serverPath}\n\nRun the desktop build again.`
            )
          );

          return;
        }

        const nodeModulesPath =
          getNodeModulesPath();

        logMessage(
          `Starting Next.js server: ${serverPath}`
        );

        logMessage(
          `Working directory: ${nextRoot}`
        );

        logMessage(
          `Node modules path: ${nodeModulesPath}`
        );

        const env = {
          ...process.env,

          NODE_ENV:
            "production",

          PORT:
            String(PORT),

          HOSTNAME:
            "127.0.0.1",

          ELECTRON_RUN_AS_NODE:
            "1",

          ELECTRON_NO_ATTACH_CONSOLE:
            "1",

          NODE_PATH:
            nodeModulesPath +
            path.delimiter +
            (
              process.env.NODE_PATH ||
              ""
            ),
        };

        nextProcess =
          spawn(
            process.execPath,
            [
              serverPath,
            ],
            {
              cwd:
                nextRoot,

              env,

              windowsHide:
                true,

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
              `[Next.js] ${data
                .toString()
                .trim()}`
            );
          }
        );

        nextProcess.stderr.on(
          "data",
          (data) => {
            logMessage(
              `[Next.js ERROR] ${data
                .toString()
                .trim()}`
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
            logError(error);
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
                }\nSignal: ${
                  signal || "none"
                }`
              );

              app.quit();
            }
          }
        );
      } catch (error) {
        logError(error);
        reject(error);
      }
    }
  );
}

function waitForServer() {
  return new Promise(
    (resolve, reject) => {
      const maxAttempts =
        60;

      let attempts = 0;

      function check() {
        attempts += 1;

        logMessage(
          `Checking Next.js server (${attempts}/${maxAttempts})...`
        );

        const request =
          http.get(
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
        if (
          attempts >=
          maxAttempts
        ) {
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
    }
  );
}

function createMainWindow() {
  const iconPath =
    getIconPath();

  const windowOptions = {
    width:
      1440,

    height:
      900,

    minWidth:
      1100,

    minHeight:
      700,

    show:
      false,

    title:
      "A&I Global Workflow System",

    backgroundColor:
      "#ffffff",

    webPreferences: {
      contextIsolation:
        true,

      nodeIntegration:
        false,

      sandbox:
        true,
    },
  };

  if (
    fs.existsSync(
      iconPath
    )
  ) {
    windowOptions.icon =
      iconPath;
  }

  mainWindow =
    new BrowserWindow(
      windowOptions
    );

  mainWindow.removeMenu();

  mainWindow.loadURL(
    APP_URL
  );

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