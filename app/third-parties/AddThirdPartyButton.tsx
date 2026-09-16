"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddThirdPartyButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = () => {
    setName("");
    setWhatsapp("");
    setError("");
    setOpen(true);
  };

  const handleClose = () => {
    if (saving) return;

    setOpen(false);
    setName("");
    setWhatsapp("");
    setError("");
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanWhatsapp = whatsapp.trim();

    if (!cleanName) {
      setError("Third party name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        "/api/third-parties",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanName,
            whatsapp: cleanWhatsapp || null,
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
        setError(
          data.message ||
            "Unable to create third party."
        );
        return;
      }

      setOpen(false);
      setName("");
      setWhatsapp("");
      setError("");

      router.refresh();
    } catch (error) {
      console.error(
        "Create third party error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-[#f9a800] px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-[#e99b00]"
      >
        + Add Third Party
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-black">
                  Add Third Party
                </h2>

                <p className="mt-1 text-xs text-black/45">
                  Add a referral partner to the system.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-black/30 transition hover:bg-black/5 hover:text-black disabled:opacity-40"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-6 py-6">
                {/* Name */}
                <div>
                  <label
                    htmlFor="third-party-name"
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    Third Party Name
                  </label>

                  <input
                    id="third-party-name"
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="e.g. ABC Travels"
                    autoFocus
                    disabled={saving}
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label
                    htmlFor="third-party-whatsapp"
                    className="mb-2 block text-xs font-medium text-black/60"
                  >
                    WhatsApp Number
                    <span className="ml-1 text-black/30">
                      (Optional)
                    </span>
                  </label>

                  <input
                    id="third-party-whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) =>
                      setWhatsapp(e.target.value)
                    }
                    placeholder="e.g. 0712345678"
                    disabled={saving}
                    className="h-11 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10 disabled:bg-black/[0.02]"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-black/50 transition hover:bg-black/5 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-[#f9a800] px-5 py-2 text-xs font-semibold text-black transition hover:bg-[#e99b00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : "Add Third Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}