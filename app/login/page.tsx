"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  const formData = new FormData(e.currentTarget);

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Login failed.");
      return;
    }

    window.location.href = "/dashboard";
  } catch (error) {
    console.error(error);
    alert("Unable to connect to the server.");
  }
};

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080808] text-white">

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/login-background.jpg')",
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Orange glow */}
      <div className="absolute -left-40 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-[#f9a800]/10 blur-[110px]" />

      <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-[#f9a800]/10 blur-[130px]" />

      {/* CONTENT */}
      <div className="relative z-10 flex min-h-screen items-center px-6 py-5">

        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_400px]">

          {/* LEFT */}
          <section className="hidden lg:block">

            <div className="max-w-lg">

              {/* Logo */}
              <img
                src="/ai-global-logo.png"
                alt="A&I Global"
                className="mb-5 h-20 w-20 object-contain"
              />

              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#f9a800]">
                Client Workflow System
              </p>

              <h1 className="mt-3 text-4xl font-semibold leading-tight xl:text-5xl">
                Organize your work.
                <span className="block text-[#f9a800]">
                  Serve your clients better.
                </span>
              </h1>

              <p className="mt-4 max-w-md text-sm leading-6 text-white/55">
                Manage clients, files, staff tasks, payments and appointments
                from one simple workspace.
              </p>

              {/* Features */}
              <div className="mt-7 flex gap-2">
                <Feature number="01" title="Clients" />
                <Feature number="02" title="Files" />
                <Feature number="03" title="Tasks" />
                <Feature number="04" title="Calendar" />
              </div>

            </div>

          </section>

          {/* LOGIN */}
          <section className="w-full">

            <div className="rounded-2xl border border-white/10 bg-[#101010]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-7">

              {/* Mobile logo */}
              <div className="mb-5 flex items-center gap-3 lg:hidden">

                <img
                  src="/ai-global-logo.png"
                  alt="A&I Global"
                  className="h-14 w-14 object-contain"
                />

                <div>
                  <p className="text-sm font-semibold">
                    A&I Global
                  </p>

                  <p className="text-[11px] text-white/40">
                    Client Workflow System
                  </p>
                </div>

              </div>

              {/* Header */}
              <div>

                <p className="text-xs font-medium text-[#f9a800]">
                  Welcome back
                </p>

                <h2 className="mt-1 text-2xl font-semibold">
                  Sign in
                </h2>

                <p className="mt-1 text-xs text-white/40">
                  Sign in to access your workspace.
                </p>

              </div>

              {/* FORM */}
              <form
                onSubmit={handleSubmit}
                className="mt-6 space-y-4"
              >

                {/* Username */}
                <div>

                  <label
                    htmlFor="username"
                    className="mb-1.5 block text-xs font-medium text-white/65"
                  >
                    Username
                  </label>

                  <div className="relative">

                    <UserIcon />

                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter username"
                      required
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.045] pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#f9a800]/60 focus:ring-2 focus:ring-[#f9a800]/10"
                    />

                  </div>

                </div>

                {/* Password */}
                <div>

                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-xs font-medium text-white/65"
                  >
                    Password
                  </label>

                  <div className="relative">

                    <LockIcon />

                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter password"
                      required
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.045] pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#f9a800]/60 focus:ring-2 focus:ring-[#f9a800]/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      className="absolute right-0 top-0 flex h-11 w-10 items-center justify-center text-white/30 transition hover:text-[#f9a800]"
                    >
                      {showPassword ? (
                        <EyeOffIcon />
                      ) : (
                        <EyeIcon />
                      )}
                    </button>

                  </div>

                </div>

                {/* Remember */}
                <div className="flex items-center justify-between">

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/45">

                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) =>
                        setRememberMe(e.target.checked)
                      }
                      className="h-3.5 w-3.5 accent-[#f9a800]"
                    />

                    Remember me

                  </label>

                  <span className="text-[10px] uppercase tracking-wider text-white/20">
                    Admin
                  </span>

                </div>

                {/* Sign in */}
                <button
                  type="submit"
                  className="group flex h-11 w-full items-center justify-center rounded-lg bg-[#f9a800] text-sm font-semibold text-black transition hover:bg-[#ffb51b] active:scale-[0.99]"
                >
                  Sign In
                  <span className="ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>

              </form>

              {/* Security */}
              <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.025] px-3 py-2.5">

                <ShieldIcon />

                <div>
                  <p className="text-[11px] font-medium text-white/55">
                    Secure workspace
                  </p>

                  <p className="text-[10px] text-white/25">
                    Authorized personnel only
                  </p>
                </div>

              </div>

              <p className="mt-4 text-center text-[9px] text-white/20">
                © 2026 A&I Global
              </p>

            </div>

          </section>

        </div>

      </div>

    </main>
  );
}

function Feature({
  number,
  title,
}: {
  number: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
      <p className="text-[10px] font-semibold text-[#f9a800]">
        {number}
      </p>

      <p className="mt-0.5 text-xs text-white/60">
        {title}
      </p>
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15.5 15.5 0 0 1-3.1 3.8" />
      <path d="M6.2 6.2C3.6 8 2.5 12 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[#f9a800]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M12 3l7 3v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}