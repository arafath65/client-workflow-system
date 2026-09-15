"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteWorkflowSubTaskButtonProps = {
  subTaskId: number;
};

export default function DeleteWorkflowSubTaskButton({
  subTaskId,
}: DeleteWorkflowSubTaskButtonProps) {
  const router = useRouter();

  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this sub task?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      const response = await fetch(
        `/api/workflows/subtasks/${subTaskId}`,
        {
          method: "DELETE",
        }
      );

      const text = await response.text();

      let data: {
        success?: boolean;
        message?: string;
      } = {};

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      if (!response.ok) {
        window.alert(
          data.message ||
            `Unable to delete sub task. (${response.status})`
        );

        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Delete sub task error:",
        error
      );

      window.alert(
        "Something went wrong while deleting the sub task."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-[10px] font-medium text-red-500 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {deleting ? "Deleting..." : "Delete"}
    </button>
  );
}