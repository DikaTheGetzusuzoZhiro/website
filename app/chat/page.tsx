"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatApp from "@/components/ChatApp";
import RatingForm from "@/components/RatingForm";

export default function ChatPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const name = localStorage.getItem("chat_username");

    if (!name) {
      router.replace("/");
      return;
    }

    setUsername(name);
  }, [router]);

  if (!username) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Memuat...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <ChatApp username={username} />

      <div className="mx-auto max-w-4xl px-5 pb-10">
        <RatingForm username={username} />
      </div>
    </div>
  );
}
