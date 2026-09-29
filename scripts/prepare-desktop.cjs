const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

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

const migrationRuntimeDir = path.join(
  desktopRuntimeDir,
  "migration-runtime"
);

const projectPrismaDir = path.join(
  projectRoot,
  "prisma"
);

const projectPrismaConfig = path.join(
  projectRoot,
  "prisma.config.ts"
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

function removeIfExists(target) {
  fs.rmSync(target, {
    recursive: true,
    force: true,
  });
}

function copyFile(source, destination) {
  if (!fs.existsSync(source)) {
    throw new Error(`Source file not found:\n${source}`);
  }

  fs.mkdirSync(path.dirname(destination), {
    recursive: true,
  });

  fs.copyFileSync(source, destination);
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error(
    "Next.js standalone folder was not created. Run npm run build first."
  );
}

if (!fs.existsSync(projectPrismaDir)) {
  throw new Error(
    `Prisma directory was not found:\n${projectPrismaDir}`
  );
}

if (!fs.existsSync(projectPrismaConfig)) {
  throw new Error(
    `Prisma configuration file was not found:\n${projectPrismaConfig}`
  );
}

console.log("Preparing Next.js desktop package...");

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

console.log("Creating desktop runtime...");

copyDirectory(
  standaloneDir,
  desktopRuntimeDir
);

console.log("Removing environment files from desktop runtime...");

removeIfExists(
  path.join(desktopRuntimeDir, ".env")
);

removeIfExists(
  path.join(desktopRuntimeDir, ".env.local")
);

removeIfExists(
  path.join(desktopRuntimeDir, ".env.production")
);

removeIfExists(
  path.join(desktopRuntimeDir, ".env.production.local")
);

console.log("Preparing standalone Node modules...");

const oldModulesDir = path.join(
  desktopRuntimeDir,
  "node_modules"
);

if (!fs.existsSync(oldModulesDir)) {
  throw new Error(
    `Standalone node_modules folder was not found:\n${oldModulesDir}`
  );
}

removeIfExists(
  desktopRuntimeModulesDir
);

fs.renameSync(
  oldModulesDir,
  desktopRuntimeModulesDir
);

console.log("Preparing Prisma migration runtime...");

removeIfExists(
  migrationRuntimeDir
);

fs.mkdirSync(
  migrationRuntimeDir,
  {
    recursive: true,
  }
);

const localPrismaPackagePath = path.join(
  projectRoot,
  "node_modules",
  "prisma",
  "package.json"
);

if (!fs.existsSync(localPrismaPackagePath)) {
  throw new Error(
    `Installed Prisma package was not found:\n${localPrismaPackagePath}\nRun npm install first.`
  );
}

const localPrismaPackage = JSON.parse(
  fs.readFileSync(
    localPrismaPackagePath,
    "utf8"
  )
);

if (!localPrismaPackage.version) {
  throw new Error(
    "Unable to determine the installed Prisma CLI version."
  );
}

const migrationPackageJson = {
  name: "aiglobal-migration-runtime",
  private: true,
  version: "1.0.0",
  dependencies: {
    prisma: localPrismaPackage.version,
  },
};

fs.writeFileSync(
  path.join(
    migrationRuntimeDir,
    "package.json"
  ),
  JSON.stringify(
    migrationPackageJson,
    null,
    2
  ) + "\n",
  "utf8"
);

copyDirectory(
  projectPrismaDir,
  path.join(
    migrationRuntimeDir,
    "prisma"
  )
);

copyFile(
  projectPrismaConfig,
  path.join(
    migrationRuntimeDir,
    "prisma.config.ts"
  )
);

const npmInstallCommand =
  "npm install --omit=dev --no-audit --no-fund";

console.log(
  `Installing Prisma CLI ${localPrismaPackage.version} for the packaged migration runtime...`
);

execSync(
  npmInstallCommand,
  {
    cwd: migrationRuntimeDir,
    stdio: "inherit",
    shell: true,
  }
);

const migrationCliPath = path.join(
  migrationRuntimeDir,
  "node_modules",
  "prisma",
  "build",
  "index.js"
);

if (!fs.existsSync(migrationCliPath)) {
  throw new Error(
    `Prisma migration CLI was not installed correctly:\n${migrationCliPath}`
  );
}

console.log("");
console.log("Desktop package prepared successfully.");
console.log("");
console.log(
  `Desktop runtime:   ${desktopRuntimeDir}`
);
console.log(
  `Server:            ${path.join(
    desktopRuntimeDir,
    "server.js"
  )}`
);
console.log(
  `Modules:           ${desktopRuntimeModulesDir}`
);
console.log(
  `Migration runtime: ${migrationRuntimeDir}`
);
console.log(
  `Migrations:        ${path.join(
    migrationRuntimeDir,
    "prisma",
    "migrations"
  )}`
);
console.log(
  `Public:             ${path.join(
    desktopRuntimeDir,
    "public"
  )}`
);
console.log(
  `Static:             ${path.join(
    desktopRuntimeDir,
    ".next",
    "static"
  )}`
);
