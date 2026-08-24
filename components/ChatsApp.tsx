"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function ChatApp({
  username
}: {
  username: string;
}) {
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const roomId =
    typeof window !== "undefined"
      ? localStorage.getItem("chat_room_id") || ""
      : "";

  async function loadMessages() {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  }

  useEffect(() => {
    loadMessages();

    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function sendMessage() {
    const value = text.trim();

    if (!value || !roomId || sending) return;

    setSending(true);

    const { error } = await supabase.from("messages").insert({
      room_id: roomId,
      username,
      message: value,
      sender_type: "user"
    });

    if (!error) {
      setText("");
    } else {
      alert(error.message);
    }

    setSending(false);
  }

  function logout() {
    localStorage.removeItem("chat_username");
    localStorage.removeItem("chat_room_id");
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="font-bold">Live Chat</h1>
            <p className="text-xs text-zinc-500">
              Login sebagai {username}
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      <section className="mx-auto flex h-[calc(100vh-73px)] max-w-4xl flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="py-20 text-center text-zinc-500">
              Belum ada pesan.
              <br />
              Kirim pesan untuk memulai percakapan.
            </div>
          )}

          {messages.map((msg) => {
            const mine = msg.sender_type === "user";

            return (
              <div
                key={msg.id}
                className={`flex ${
                  mine ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    mine
                      ? "bg-white text-black"
                      : "bg-zinc-800 text-white"
                  }`}
                >
                  <div className="mb-1 text-xs font-semibold opacity-60">
                    {msg.sender_type === "user"
                      ? msg.username
                      : msg.sender_type}
                  </div>

                  <div className="break-words">{msg.message}</div>

                  <div className="mt-1 text-[10px] opacity-50">
                    {new Date(msg.created_at).toLocaleTimeString("id-ID")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder="Tulis pesan..."
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-white"
            />

            <button
              onClick={sendMessage}
              disabled={sending}
              className="rounded-xl bg-white px-5 font-semibold text-black disabled:opacity-50"
            >
              Kirim
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
