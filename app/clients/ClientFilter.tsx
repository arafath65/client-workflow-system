"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ClientFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") || "";

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim()) {
      params.set("search", value);
    } else {
      params.delete("search");
    }

    router.push(`/clients?${params.toString()}`);
  };

  return (
    <input
      type="text"
      defaultValue={currentSearch}
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search name or WhatsApp..."
      className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-[#f9a800] sm:w-64"
    />
  );
}