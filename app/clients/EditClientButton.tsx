
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApiResponse = {
  message?: string;
  success?: boolean;
};

type EditClientButtonProps = {
  id: number;
  name: string;
  whatsapp: string | null;
};

export default function EditClientButton({
  id,
  name: initialName,
  whatsapp: initialWhatsapp,
}: EditClientButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = () => {
    setName(initialName);
    setWhatsapp(initialWhatsapp || "");
    setError("");
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;

    setOpen(false);
    setError("");
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanWhatsapp = whatsapp.trim();

    if (!cleanName) {
      setError("Client name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          whatsapp: cleanWhatsapp || null,
        }),
      });

      const text = await response.text();

      let data: ApiResponse = {};

      try {
        data = text ? (JSON.parse(text) as ApiResponse) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        setError(data.message || "Unable to update client.");
        return;
      }

      setOpen(false);
      setError("");

      router.refresh();
    } catch (error) {
      console.error("Update client error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs font-medium text-black/50 hover:text-black"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Edit Client
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Update client information.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="text-lg text-black/30 hover:text-black"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  Full Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">
                  WhatsApp Number
                </label>

                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2.5 text-sm outline-none focus:border-[#f9a800]"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="rounded-lg border border-black/10 px-4 py-2.5 text-xs font-medium hover:bg-black/[0.03]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}