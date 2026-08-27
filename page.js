import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function Resource({ params }) {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("resources")
    .select("*,profiles(username)")
    .eq("id", params.id)
    .single();

  if (!r || r.status !== "published") return notFound();

  const url = r.file_path
    ? supabase.storage.from("resources").getPublicUrl(r.file_path).data.publicUrl
    : "#";

  return <main className="container">
    <article className="detail">
      {r.background_url && <img className="cover" src={r.background_url} alt="" />}
      <h1>{r.title}</h1>
      <p>{r.description}</p>
      <p>Versi: {r.version} • Download: {r.downloads}</p>
      <p>Uploader: @{r.profiles?.username}</p>
      <a className="button" href={url} target="_blank" rel="noreferrer" download>Download File</a>
    </article>
  </main>;
}