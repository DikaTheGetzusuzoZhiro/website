"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Message, Rating } from "@/lib/types";

type Room = {
  room_id: string;
  username: string;
  last_message?: string;
};

export default function AdminDashboard() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [reply, setReply] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  async function loadRooms() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return;

    const map = new Map<string, Room>();

    for (const msg of data as Message[]) {
      if (!map.has(msg.room_id)) {
        map.set(msg.room_id, {
          room_id: msg.room_id,
          username: msg.username,
          last_message: msg.message
        });
      }
    }

    setRooms([...map.values()]);
  }

  async function loadRoom(roomId: string) {
    setSelectedRoom(roomId);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    setMessages((data || []) as Message[]);
  }

  async function loadRatings() {
    const { data } = await supabase
      .from("ratings")
      .select("*")
      .order("created_at", { ascending: false });

    setRatings((data || []) as Rating[]);
  }

  useEffect(() => {
    if (!loggedIn) return;

    loadRooms();
    loadRatings();

    const channel = supabase
      .channel("admin-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        () => {
          loadRooms();

          if (selectedRoom) {
            loadRoom(selectedRoom);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ratings"
        },
        loadRatings
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedIn, selectedRoom]);

  async function sendAdminMessage() {
    const value = reply.trim();

    if (!value || !selectedRoom) return;

    const room = rooms.find((r) => r.room_id === selectedRoom);

    await supabase.from("messages").insert({
      room_id: selectedRoom,
      username: room?.username || "User",
      message: value,
      sender_type: "admin"
    });

    setReply("");
    loadRoom(selectedRoom);
  }

  async function replyRating(id: string, text: string) {
    const value = text.trim();

    if (!value) return;

    await supabase
      .from("ratings")
      .update({
        reply: value,
        replied_by: "admin",
        replied_at: new Date().toISOString()
      })
      .eq("id", id);

    loadRatings();
  }

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();

            const correct =
              process.env.NEXT_PUBLIC_ADMIN_ACCESS_KEY;

            if (adminKey === correct) {
              setLoggedIn(true);
            } else {
              alert("Access key salah.");
            }
          }}
          className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <h1 className="mb-5 text-2xl font-bold">
            Admin / Operator
          </h1>

          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Admin Access Key"
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
          />

          <button className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black">
            Masuk Dashboard
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-5 py-4">
        <h1 className="text-xl font-bold">
          Dashboard Admin / Operator
        </h1>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[280px_1fr_360px]">
        <aside className="border-r border-zinc-800 p-4">
          <h2 className="mb-3 font-semibold">Chat Users</h2>

          <div className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.room_id}
                onClick={() => loadRoom(room.room_id)}
                className={`w-full rounded-xl p-3 text-left ${
                  selectedRoom === room.room_id
                    ? "bg-white text-black"
                    : "bg-zinc-900"
                }`}
              >
                <div className="font-semibold">
                  {room.username}
                </div>
                <div className="truncate text-xs opacity-60">
                  {room.last_message}
                </div>
              </button>
            ))}

            {rooms.length === 0 && (
              <p className="text-sm text-zinc-500">
                Belum ada user.
              </p>
            )}
          </div>
        </aside>

        <section className="flex min-h-[500px] flex-col border-r border-zinc-800">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {!selectedRoom && (
              <div className="py-20 text-center text-zinc-500">
                Pilih user untuk membuka chat.
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_type === "admin"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.sender_type === "admin"
                      ? "bg-white text-black"
                      : "bg-zinc-800"
                  }`}
                >
                  <div className="text-xs opacity-50">
                    {msg.sender_type}
                  </div>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>

          {selectedRoom && (
            <div className="border-t border-zinc-800 p-4">
              <div className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendAdminMessage();
                    }
                  }}
                  placeholder="Balas user..."
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none"
                />

                <button
                  onClick={sendAdminMessage}
                  className="rounded-xl bg-white px-4 font-semibold text-black"
                >
                  Kirim
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="p-4">
          <h2 className="mb-4 text-lg font-bold">
            Rating User
          </h2>

          <div className="space-y-4">
            {ratings.map((rating) => (
              <RatingCard
                key={rating.id}
                rating={rating}
                onReply={replyRating}
              />
            ))}

            {ratings.length === 0 && (
              <p className="text-sm text-zinc-500">
                Belum ada rating.
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function RatingCard({
  rating,
  onReply
}: {
  rating: Rating;
  onReply: (id: string, text: string) => void;
}) {
  const [text, setText] = useState(rating.reply || "");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex justify-between">
        <b>{rating.username}</b>
        <span>{"★".repeat(rating.rating)}</span>
      </div>

      {rating.comment && (
        <p className="mt-2 text-sm text-zinc-400">
          {rating.comment}
        </p>
      )}

      {rating.reply && (
        <div className="mt-3 rounded-xl bg-zinc-800 p-3 text-sm">
          <div className="mb-1 text-xs text-zinc-500">
            Balasan Admin
          </div>
          {rating.reply}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Terimakasih atas ratingnya..."
        className="mt-3 min-h-20 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm outline-none"
      />

      <button
        onClick={() => onReply(rating.id, text)}
        className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black"
      >
        Balas Rating
      </button>
    </div>
  );
}
