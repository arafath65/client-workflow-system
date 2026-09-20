import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const execFileAsync = promisify(execFile);

function findDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);

    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port || "3306",
      user: decodeURIComponent(parsed.username || "root"),
      password: decodeURIComponent(parsed.password || ""),
      database: decodeURIComponent(
        parsed.pathname.replace(/^\//, "")
      ),
    };
  }

  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || "3306",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "client_workflow_db",
  };
}

async function findMysqldump() {
  const configured = process.env.MYSQLDUMP_PATH;

  if (configured) {
    try {
      await fs.access(configured);
      return configured;
    } catch {
      throw new Error(
        "MYSQLDUMP_PATH is configured, but the mysqldump executable was not found."
      );
    }
  }

  const candidates =
    process.platform === "win32"
      ? [
          "mysqldump.exe",
          "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe",
          "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
          "C:\\xampp\\mysql\\bin\\mysqldump.exe",
        ]
      : ["mysqldump"];

  for (const candidate of candidates) {
    if (
      candidate === "mysqldump.exe" ||
      candidate === "mysqldump"
    ) {
      try {
        await execFileAsync(candidate, ["--version"]);
        return candidate;
      } catch {
        continue;
      }
    }

    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "mysqldump was not found. Install MySQL client tools or set MYSQLDUMP_PATH in your environment."
  );
}

function getSafeBackupName() {
  const now = new Date();
  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return `client-workflow-backup-${now.getFullYear()}${pad(
    now.getMonth() + 1
  )}${pad(now.getDate())}-${pad(now.getHours())}${pad(
    now.getMinutes()
  )}${pad(now.getSeconds())}.sql`;
}

export async function GET() {
  let temporaryFile = "";

  try {
    // --------------------------------------------------
    // Authenticate user
    // --------------------------------------------------

    const sessionUser = (await cookies()).get("session_user");

    if (!sessionUser?.value) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const userId = Number(sessionUser.value);

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // Prepare database backup
    // --------------------------------------------------

    const config = findDatabaseConfig();
    const mysqldump = await findMysqldump();

    temporaryFile = path.join(
      os.tmpdir(),
      `client-workflow-backup-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}.sql`
    );

    await execFileAsync(
      mysqldump,
      [
        "--host",
        config.host,
        "--port",
        config.port,
        "--user",
        config.user,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--events",
        "--add-drop-table",
        "--result-file",
        temporaryFile,
        config.database,
      ],
      {
        env: {
          ...process.env,
          MYSQL_PWD: config.password,
        },
        windowsHide: true,
      }
    );

    // --------------------------------------------------
    // Read generated backup
    // --------------------------------------------------

    const file = await fs.readFile(temporaryFile);
    const backupName = getSafeBackupName();

    // --------------------------------------------------
    // Audit Log: Database backup generated
    // --------------------------------------------------

    await writeAuditLog({
      userId,
      module: "DATABASE",
      action: "BACKUP",
      entity: "DATABASE_BACKUP",
      description: `Generated database backup: ${backupName}`,
      metadata: {
        database: config.database,
        backupFilename: backupName,
        fileSizeBytes: file.length,
        generatedAt: new Date().toISOString(),
      },
    });

    // --------------------------------------------------
    // Return backup file
    // --------------------------------------------------

    return new NextResponse(
      new Uint8Array(file),
      {
        status: 200,
        headers: {
          "Content-Type": "application/sql; charset=utf-8",
          "Content-Disposition": `attachment; filename="${backupName}"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("Database backup error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unable to create database backup.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  } finally {
    if (temporaryFile) {
      await fs.rm(temporaryFile, {
        force: true,
      }).catch(() => undefined);
    }
  }
}