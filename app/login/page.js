 "use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const supabase = createClient();
  const router = useRouter();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  return <main className="auth">
    <form className="panel" onSubmit={submit}>
      <h1>Login</h1>
      {error && <div className="error">{error}</div>}
      <input type="email" placeholder="Gmail" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
      <button>Masuk</button>
      <Link href="/register">Belum punya akun? Daftar</Link>
    </form>
  </main>;
}
