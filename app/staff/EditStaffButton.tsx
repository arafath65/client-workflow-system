"use client";

import { FormEvent, useState } from "react";

type StaffData = {
  id: number;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  status: boolean;
};

type Props = {
  staff: StaffData;
};

export default function EditStaffButton({ staff }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    const formData = new FormData(e.currentTarget);

    const name = String(formData.get("name") ?? "").trim();
    const position = String(formData.get("position") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (!name) {
      alert("Staff name is required.");
      return;
    }

    if (!position) {
      alert("Position is required.");
      return;
    }

    if (!phone) {
      alert("Mobile number is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/staff/${staff.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          position,
          phone,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to update staff.");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Update staff error:", error);
      alert("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-black/40 transition hover:text-black"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  Edit Staff Member
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Update the staff member&apos;s details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-black/40 transition hover:bg-black/5 hover:text-black"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 px-6 py-6"
            >
              {/* Name */}
              <div>
                <label
                  htmlFor={`edit-staff-name-${staff.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Name <span className="text-red-500">*</span>
                </label>

                <input
                  id={`edit-staff-name-${staff.id}`}
                  name="name"
                  type="text"
                  defaultValue={staff.name}
                  required
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Position */}
              <div>
                <label
                  htmlFor={`edit-staff-position-${staff.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Position <span className="text-red-500">*</span>
                </label>

                <input
                  id={`edit-staff-position-${staff.id}`}
                  name="position"
                  type="text"
                  defaultValue={staff.position ?? ""}
                  required
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Mobile */}
              <div>
                <label
                  htmlFor={`edit-staff-phone-${staff.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Mobile <span className="text-red-500">*</span>
                </label>

                <input
                  id={`edit-staff-phone-${staff.id}`}
                  name="phone"
                  type="tel"
                  defaultValue={staff.phone ?? ""}
                  required
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor={`edit-staff-email-${staff.id}`}
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Email
                </label>

                <input
                  id={`edit-staff-email-${staff.id}`}
                  name="email"
                  type="email"
                  defaultValue={staff.email ?? ""}
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-black px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}