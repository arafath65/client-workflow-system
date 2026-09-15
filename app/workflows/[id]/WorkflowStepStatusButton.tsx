"use client";

import { useState } from "react";

type WorkflowStepStatusButtonProps = {
  stepId: number;
  active: boolean;
};

export default function WorkflowStepStatusButton({
  stepId,
  active,
}: WorkflowStepStatusButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async () => {
    const action = active ? "deactivate" : "activate";

    const confirmed = window.confirm(
      active
        ? "Are you sure you want to deactivate this workflow step?"
        : "Are you sure you want to activate this workflow step?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `/api/workflows/steps/${stepId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: !active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        window.alert(
          data?.message || "Unable to update step status."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Workflow step status error:",
        error
      );

      window.alert(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleStatusChange}
      disabled={loading}
      className={`text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "text-black/30 hover:text-red-600"
          : "text-[#a66f00] hover:text-black"
      }`}
    >
      {loading
        ? "Saving..."
        : active
          ? "Delete"
          : "Activate"}
    </button>
  );
}