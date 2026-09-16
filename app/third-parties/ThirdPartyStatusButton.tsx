"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ThirdPartyStatusButtonProps = {
  thirdPartyId: number;
  active: boolean;
};

export default function ThirdPartyStatusButton({
  thirdPartyId,
  active,
}: ThirdPartyStatusButtonProps) {
  const router = useRouter();

  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async () => {
    const action = active
      ? "deactivate"
      : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this third party?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setUpdating(true);

      const response = await fetch(
        `/api/third-parties/${thirdPartyId}`,
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
            `Unable to ${action} third party.`
        );

        return;
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Update third party status error:",
        error
      );

      window.alert(
        `Something went wrong while trying to ${action} the third party.`
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleStatusChange}
      disabled={updating}
      className={`text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "text-red-500 hover:text-red-700"
          : "text-[#a66f00] hover:text-black"
      }`}
    >
      {updating
        ? "Saving..."
        : active
          ? "Deactivate"
          : "Activate"}
    </button>
  );
}