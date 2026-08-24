"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();

    const name = username.trim();

    if (!name) {
      setError("Masukkan username.");
      return;
    }

    if (name.length < 2) {
      setError("Username minimal 2 karakter.");
      return;
    }

    setLoading(true);
    setError("");

    localStorage.setItem("chat_username", name);

    const roomId = crypto.randomUUID();

    localStorage.setItem("chat_room_id", roomId);

    router.push("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl">
        <div className="mb-7 text-center">
          <h1 className="text-3xl font-bold">Live Chat</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Masukkan username untuk mulai chat.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={30}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-white"
          />

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Memproses..." : "Masuk Chat"}
          </button>
        </form>

        <a
          href="/admin"
          className="mt-5 block text-center text-sm text-zinc-500 hover:text-white"
        >
          Admin / Operator
        </a>
      </div>
    </main>
  );
}
