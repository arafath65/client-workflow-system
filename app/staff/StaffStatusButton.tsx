"use client";

import { useState } from "react";

type Props = {
  id: number;
  active: boolean;
};

export default function StaffStatusButton({
  id,
  active,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async () => {
    const action = active ? "deactivate" : "activate";

    const confirmed = window.confirm(
      active
        ? "Are you sure you want to deactivate this staff member?"
        : "Are you sure you want to activate this staff member?"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: !active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || `Unable to ${action} staff.`);
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Staff status error:", error);
      alert("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleStatusChange}
      disabled={loading}
      className={`text-xs font-medium transition disabled:opacity-50 ${
        active
          ? "text-black/40 hover:text-red-600"
          : "text-[#a66f00] hover:text-black"
      }`}
    >
      {loading
        ? "Updating..."
        : active
          ? "Deactivate"
          : "Activate"}
    </button>
  );
}