"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";

export default function AddStaffButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const positionRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleEnter = (
    e: KeyboardEvent<HTMLInputElement>,
    nextRef?: React.RefObject<HTMLInputElement | null>
  ) => {
    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();

    // Move to next field
    if (nextRef?.current) {
      nextRef.current.focus();
    }
  };

  const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();

    // First Enter: stay in email field
    // Second Enter: submit the form
    if (e.shiftKey) {
      return;
    }

    const now = Date.now();
    const lastEnter = Number(
      emailRef.current?.dataset.lastEnter ?? "0"
    );

    if (now - lastEnter < 1000) {
      const form = emailRef.current?.form;

      if (form) {
        form.requestSubmit();
      }

      if (emailRef.current) {
        delete emailRef.current.dataset.lastEnter;
      }
    } else {
      if (emailRef.current) {
        emailRef.current.dataset.lastEnter = String(now);
      }
    }
  };

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

    // Required fields
    if (!name) {
      alert("Staff name is required.");
      nameRef.current?.focus();
      return;
    }

    if (!position) {
      alert("Position is required.");
      positionRef.current?.focus();
      return;
    }

    if (!phone) {
      alert("Mobile number is required.");
      phoneRef.current?.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/staff", {
        method: "POST",
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
        alert(data.message || "Unable to create staff.");
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error("Create staff error:", error);
      alert("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);

          setTimeout(() => {
            nameRef.current?.focus();
          }, 100);
        }}
        className="rounded-lg bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#f9a800] hover:text-black"
      >
        + Add Staff
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-base font-semibold">
                  Add Staff Member
                </h2>

                <p className="mt-1 text-xs text-black/40">
                  Enter the staff member&apos;s details.
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
                  htmlFor="staff-name"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Name <span className="text-red-500">*</span>
                </label>

                <input
                  ref={nameRef}
                  id="staff-name"
                  name="name"
                  type="text"
                  placeholder="Enter staff name"
                  required
                  onKeyDown={(e) =>
                    handleEnter(e, positionRef)
                  }
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Position */}
              <div>
                <label
                  htmlFor="staff-position"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Position <span className="text-red-500">*</span>
                </label>

                <input
                  ref={positionRef}
                  id="staff-position"
                  name="position"
                  type="text"
                  placeholder="e.g. Visa Officer"
                  required
                  onKeyDown={(e) =>
                    handleEnter(e, phoneRef)
                  }
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Mobile */}
              <div>
                <label
                  htmlFor="staff-phone"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Mobile <span className="text-red-500">*</span>
                </label>

                <input
                  ref={phoneRef}
                  id="staff-phone"
                  name="phone"
                  type="tel"
                  placeholder="Enter mobile number"
                  required
                  onKeyDown={(e) =>
                    handleEnter(e, emailRef)
                  }
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="staff-email"
                  className="mb-1.5 block text-xs font-medium text-black/60"
                >
                  Email
                </label>

                <input
                  ref={emailRef}
                  id="staff-email"
                  name="email"
                  type="email"
                  placeholder="Enter email address"
                  onKeyDown={handleEmailKeyDown}
                  className="h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm outline-none transition placeholder:text-black/25 focus:border-[#f9a800] focus:ring-2 focus:ring-[#f9a800]/10"
                />

                <p className="mt-1.5 text-[10px] text-black/35">
                  Press Enter twice to save.
                </p>
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
                  {loading ? "Saving..." : "Save Staff"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}