"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatApp from "@/components/ChatApp";

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

  return <ChatApp username={username} />;
}
