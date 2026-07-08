"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="bg-error/10 border border-error/20 text-error px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-error/20 transition-colors disabled:opacity-50"
      disabled={loading}
      onClick={handleLogout}
      type="button"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
