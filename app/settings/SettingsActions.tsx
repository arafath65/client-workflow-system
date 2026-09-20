"use client";

import { FormEvent, useState } from "react";

export default function SettingsActions({ username }: { username: string }) {
  const [backupLoading, setBackupLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleBackup = async () => {
    if (backupLoading) return;

    setBackupLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/settings/backup", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        let data: { message?: string } = {};
        try {
          data = await response.json();
        } catch {
          // Ignore non-JSON responses.
        }
        throw new Error(data.message || "Unable to create database backup.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || "client-workflow-backup.sql";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setMessage("Database backup created successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create database backup."
      );
    } finally {
      setBackupLoading(false);
    }
  };

  const handlePasswordChange = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (passwordLoading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const currentPassword = String(
      formData.get("currentPassword") ?? ""
    );
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(
      formData.get("confirmPassword") ?? ""
    );

    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to change password.");
      }

      form.reset();
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
              Database
            </p>
            <h2 className="mt-2 text-base font-semibold">
              SQL Database Backup
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-black/45">
              Create a complete MySQL .sql backup of the current client workflow database.
            </p>
          </div>

          <button
            type="button"
            onClick={handleBackup}
            disabled={backupLoading}
            className="h-10 shrink-0 rounded-lg bg-black px-4 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {backupLoading ? "Creating..." : "Create SQL Backup"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f9a800]">
            Security
          </p>
          <h2 className="mt-2 text-base font-semibold">
            Change Password
          </h2>
          <p className="mt-1 text-sm text-black/45">
            Change the password for the current login account: {username}
          </p>
        </div>

        <form
          onSubmit={handlePasswordChange}
          className="mt-6 max-w-md space-y-4"
        >
          <div>
            <label
              htmlFor="current-password"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              Current Password
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            />
          </div>

          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              New Password
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            />
            <p className="mt-1.5 text-[10px] text-black/35">
              Use at least 8 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-xs font-medium text-black/60"
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
            />
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="h-10 rounded-lg border border-black/10 bg-white px-4 text-xs font-semibold text-black transition hover:border-[#f9a800] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordLoading ? "Saving..." : "Change Password"}
          </button>
        </form>

        {(message || error) && (
          <p
            className={`mt-4 text-xs font-medium ${
              error ? "text-red-600" : "text-green-700"
            }`}
          >
            {error || message}
          </p>
        )}
      </div>
    </div>
  );
}
