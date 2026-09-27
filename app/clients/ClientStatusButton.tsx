"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClientStatusButtonProps = {
  id: number;
  name: string;
  status: boolean;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

export default function ClientStatusButton({
  id,
  name,
  status,
}: ClientStatusButtonProps) {
  const router = useRouter();

  const [saving, setSaving] =
    useState(false);

  const handleToggle = async () => {
    if (saving) return;

    const nextStatus = !status;

    const confirmed =
      window.confirm(
        nextStatus
          ? `Activate "${name}"?`
          : `Deactivate "${name}"?\n\nExisting files, payments and history will be preserved.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/clients/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const text =
        await response.text();

      let data: ApiResponse = {};

      try {
        data = text
          ? (JSON.parse(text) as ApiResponse)
          : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        alert(
          data.message ||
            "Unable to update client status."
        );
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Update client status error:",
        error
      );

      alert(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className={
        status
          ? "text-xs font-medium text-red-500 transition hover:text-red-700 disabled:opacity-50"
          : "text-xs font-medium text-green-600 transition hover:text-green-700 disabled:opacity-50"
      }
    >
      {saving
        ? "Saving..."
        : status
          ? "Deactivate"
          : "Activate"}
    </button>
  );
}