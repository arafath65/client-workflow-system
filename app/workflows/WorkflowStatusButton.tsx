
"use client";

import { useState } from "react";

type WorkflowData = {
  id: number;
  name: string;
  status: boolean;
};

type Props = {
  workflow: WorkflowData;
};

export default function WorkflowStatusButton({
  workflow,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async () => {
    if (loading) return;

    const nextStatus = !workflow.status;

    const confirmed = window.confirm(
      nextStatus
        ? `Are you sure you want to activate "${workflow.name}"?`
        : `Are you sure you want to deactivate "${workflow.name}"?`
    );

    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch(
        `/api/workflows/${workflow.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        window.alert(
          data?.message ||
            "Unable to update workflow status."
        );
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error(
        "Workflow status error:",
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
        workflow.status
          ? "text-black/40 hover:text-red-600"
          : "text-[#a66f00] hover:text-black"
      }`}
    >
      {loading
        ? "Saving..."
        : workflow.status
          ? "Deactivate"
          : "Activate"}
    </button>
  );
}