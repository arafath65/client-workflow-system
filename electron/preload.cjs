const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getDatabaseConfig: () =>
    ipcRenderer.invoke("database:get-config"),

  testDatabaseConnection: (config) =>
    ipcRenderer.invoke(
      "database:test-connection",
      config
    ),

  saveDatabaseConfigAndStart: (config) =>
    ipcRenderer.invoke(
      "database:save-and-start",
      config
    ),

  exitApplication: () =>
    ipcRenderer.invoke(
      "application:exit"
    ),
});