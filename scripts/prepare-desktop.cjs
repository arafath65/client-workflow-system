const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const standaloneDir = path.join(
  projectRoot,
  ".next",
  "standalone"
);

const publicDir = path.join(
  projectRoot,
  "public"
);

const staticDir = path.join(
  projectRoot,
  ".next",
  "static"
);

const standalonePublicDir = path.join(
  standaloneDir,
  "public"
);

const standaloneStaticDir = path.join(
  standaloneDir,
  ".next",
  "static"
);

const desktopRuntimeDir = path.join(
  projectRoot,
  "desktop-runtime"
);

const desktopRuntimeModulesDir = path.join(
  desktopRuntimeDir,
  "modules"
);

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Source directory not found:\n${source}`);
  }

  fs.rmSync(destination, {
    recursive: true,
    force: true,
  });

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  });
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error(
    "Next.js standalone folder was not created. Run npm run build first."
  );
}

console.log("Preparing Next.js desktop package...");

//
// First prepare the normal Next.js standalone folder.
//

console.log("Copying public assets...");

copyDirectory(
  publicDir,
  standalonePublicDir
);

console.log("Copying Next.js static assets...");

copyDirectory(
  staticDir,
  standaloneStaticDir
);

//
// Create a separate desktop runtime folder.
//
// IMPORTANT:
// We deliberately rename node_modules -> modules.
// This prevents electron-builder from treating the
// Next.js standalone runtime as Electron app dependencies.
//

console.log("Creating desktop runtime...");

copyDirectory(
  standaloneDir,
  desktopRuntimeDir
);

const oldModulesDir = path.join(
  desktopRuntimeDir,
  "node_modules"
);

if (!fs.existsSync(oldModulesDir)) {
  throw new Error(
    `Standalone node_modules folder was not found:\n${oldModulesDir}`
  );
}

fs.rmSync(
  desktopRuntimeModulesDir,
  {
    recursive: true,
    force: true,
  }
);

fs.renameSync(
  oldModulesDir,
  desktopRuntimeModulesDir
);

console.log("");
console.log("Desktop package prepared successfully.");
console.log("");
console.log(`Desktop runtime: ${desktopRuntimeDir}`);
console.log(`Server:          ${path.join(desktopRuntimeDir, "server.js")}`);
console.log(`Modules:         ${desktopRuntimeModulesDir}`);
console.log(`Public:          ${path.join(desktopRuntimeDir, "public")}`);
console.log(
  `Static:          ${path.join(
    desktopRuntimeDir,
    ".next",
    "static"
  )}`
);