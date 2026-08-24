"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RatingForm({
  username
}: {
  username: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  async function submit() {
    if (rating < 1) {
      alert("Pilih rating terlebih dahulu.");
      return;
    }

    const { error } = await supabase.from("ratings").insert({
      username,
      rating,
      comment: comment.trim() || null
    });

    if (error) {
      alert(error.message);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
        <div className="text-xl">Terima kasih!</div>
        <p className="mt-1 text-sm text-zinc-500">
          Rating kamu berhasil dikirim.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="font-bold">Beri Rating</h2>

      <div className="my-4 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={`text-3xl ${
              n <= rating ? "text-yellow-400" : "text-zinc-700"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Komentar..."
        className="min-h-24 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 outline-none"
      />

      <button
        onClick={submit}
        className="mt-3 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black"
      >
        Kirim Rating
      </button>
    </div>
  );
}
