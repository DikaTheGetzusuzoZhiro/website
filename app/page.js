import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("resources")
    .select("id,title,description,version,downloads,background_url,profiles(username)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return (
    <main className="container">
      <nav className="nav">
        <b>TAMA</b>
        <div>
          <Link href="/upload">Upload</Link>
          <Link href="/login">Login</Link>
          <Link href="/register">Daftar</Link>
        </div>
      </nav>

      <section className="hero">
        <h1>TAMA Mod Sharing</h1>
        <p>Temukan, upload, dan download mod serta file.</p>
      </section>

      <section className="grid">
        {(resources || []).map((r) => (
          <article className="card" key={r.id}>
            {r.background_url && <img src={r.background_url} alt="" />}
            <div className="cardBody">
              <h2>{r.title}</h2>
              <p>{r.description}</p>
              <small>v{r.version} • {r.downloads} download • @{r.profiles?.username || "user"}</small>
              <Link className="button" href={`/resource/${r.id}`}>Lihat & Download</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}