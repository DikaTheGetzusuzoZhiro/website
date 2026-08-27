 "use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const supabase = createClient();
  const router = useRouter();
  const [name,setName] = useState("");
  const [username,setUsername] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [done,setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    const clean = username.trim().toLowerCase();

    if (!/^[a-z0-9_]{3,24}$/.test(clean))
      return setError("Username 3-24 karakter: huruf, angka, underscore.");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, username: clean } }
    });

    if (error) return setError(error.message);
    setDone(true);
    router.refresh();
  }

  return <main className="auth">
    <form className="panel" onSubmit={submit}>
      <h1>Buat Akun</h1>
      {error && <div className="error">{error}</div>}
      {done && <div className="success">Pendaftaran berhasil. Cek email jika verifikasi diaktifkan.</div>}
      <input placeholder="Nama" value={name} onChange={e=>setName(e.target.value)} required />
      <input placeholder="Username (tidak bisa diubah)" value={username} onChange={e=>setUsername(e.target.value)} required />
      <input type="email" placeholder="Gmail" value={email} onChange={e=>setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" minLength="6" value={password} onChange={e=>setPassword(e.target.value)} required />
      <button>Daftar</button>
      <Link href="/login">Sudah punya akun? Login</Link>
    </form>
  </main>;
}
