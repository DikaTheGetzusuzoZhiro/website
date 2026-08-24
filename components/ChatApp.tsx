"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";

export default function ChatApp({
  username
}: {
  username: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    let id = localStorage.getItem("chat_room_id");

    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("chat_room_id", id);
    }

    setRoomId(id);
  }, []);

  async function loadMessages(id: string) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", id)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error(error);
      return;
    }

    setMessages((data || []) as Message[]);
  }

  useEffect(() => {
    if (!roomId) return;

    loadMessages(roomId);

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`
        },
        () => {
          loadMessages(roomId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function sendMessage() {
    const message = text.trim();

    if (!message || !roomId || sending) return;

    setSending(true);

    const { error } = await supabase
      .from("messages")
      .insert({
        room_id: roomId,
        username,
        message,
        sender_type: "user"
      });

    if (error) {
      alert(error.message);
    } else {
      setText("");
      await loadMessages(roomId);
    }

    setSending(false);
  }

  return (
    <section className="mx-auto flex h-[calc(100vh-73px)] max-w-4xl flex-col">
      <div className="flex-1 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">
            Belum ada pesan.
            <br />
            Kirim pesan untuk memulai chat.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const mine = msg.sender_type === "user";

              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    mine
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      mine
                        ? "bg-white text-black"
                        : "bg-zinc-800 text-white"
                    }`}
                  >
                    <div className="mb-1 text-xs opacity-50">
                      {mine
                        ? username
                        : msg.sender_type}
                    </div>

                    <div className="break-words">
                      {msg.message}
                    </div>

                    <div className="mt-1 text-[10px] opacity-50">
                      {new Date(
                        msg.created_at
                      ).toLocaleTimeString("id-ID")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Tulis pesan..."
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-white"
          />

          <button
            onClick={sendMessage}
            disabled={sending}
            className="rounded-xl bg-white px-5 font-semibold text-black disabled:opacity-50"
          >
            {sending ? "..." : "Kirim"}
          </button>
        </div>
      </div>
    </section>
  );
}
