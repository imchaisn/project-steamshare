"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Login failed");
      return;
    }

    router.push(searchParams.get("next") ?? "/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-dopamine text-ink p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Admin login</h1>
        <input
          type="password"
          className="w-full rounded border border-line bg-surface-1 px-3 py-2"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
        >
          Log in
        </button>
        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
