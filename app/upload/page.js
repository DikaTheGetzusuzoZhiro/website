 "use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Upload() {
  const supabase = createClient();
  const router = useRouter();
  const [user,setUser] = useState(null);
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [version,setVersion] = useState("1.0");
  const [file,setFile] = useState(null);
  const [background,setBackground] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user) router.push("/login");
      else setUser(data.user);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!file) return setError("Pilih file terlebih dahulu.");
    setBusy(true); setError("");

    try {
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${crypto.randomUUID().slice(0,8)}`;
      const filePath = `${user.id}/${crypto.randomUUID()}-${file.name}`;

      const upload = await supabase.storage.from("resources").upload(filePath, file);
      if (upload.error) throw upload.error;

      let background_url = "";
      if (background) {
        const bgPath = `${user.id}/${crypto.randomUUID()}-${background.name}`;
        const bg = await supabase.storage.from("backgrounds").upload(bgPath, background);
        if (bg.error) throw bg.error;
        background_url = supabase.storage.from("backgrounds").getPublicUrl(bgPath).data.publicUrl;
      }

      const file_url = supabase.storage.from("resources").getPublicUrl(filePath).data.publicUrl;

      const { error } = await supabase.from("resources").insert({
        owner_id: user.id,
        title,
        slug,
        description,
        version,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        background_url,
        thumbnail_url: background_url,
        status: "published"
      });

      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e.message || "Upload gagal.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="container">
    <div className="panel wide">
      <h1>Upload File</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={submit}>
        <input placeholder="Judul file/mod" value={title} onChange={e=>setTitle(e.target.value)} required />
        <textarea placeholder="Deskripsi" value={description} onChange={e=>setDescription(e.target.value)} />
        <input placeholder="Versi" value={version} onChange={e=>setVersion(e.target.value)} />
        <label>File</label>
        <input type="file" onChange={e=>setFile(e.target.files?.[0])} required />
        <label>Gambar background</label>
        <input type="file" accept="image/*" onChange={e=>setBackground(e.target.files?.[0])} />
        <button disabled={busy}>{busy ? "Mengupload..." : "Upload"}</button>
      </form>
    </div>
  </main>;
}
