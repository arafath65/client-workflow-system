"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type WorkflowTaskCheckboxProps = {
  taskId: number;
  status:
    | "PENDING"
    | "ACTIVE"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
};

export default function WorkflowTaskCheckbox({
  taskId,
  status,
}: WorkflowTaskCheckboxProps) {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const checked = status === "COMPLETED";

  const handleChange = async () => {
    if (saving) return;

    try {
      setSaving(true);

      const response = await fetch(
        `/api/files/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            completed: !checked,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(
          data?.message ||
            "Unable to update workflow task."
        );
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Update workflow task error:",
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
      onClick={handleChange}
      disabled={saving}
      aria-label={
        checked
          ? "Mark task as incomplete"
          : "Mark task as completed"
      }
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
        checked
          ? "border-black bg-black text-[#f9a800]"
          : "border-black/20 bg-white hover:border-[#f9a800] hover:bg-[#fffaf0]"
      } ${
        saving
          ? "cursor-wait opacity-50"
          : "cursor-pointer"
      }`}
    >
      {checked && (
        <span className="text-xs font-bold">
          ✓
        </span>
      )}
    </button>
  );
}