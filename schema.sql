-- TAMA Mod Sharing: run this whole file in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique,
 display_name text not null default '',
 email text,
 avatar_url text,
 bio text not null default '',
 role text not null default 'user' check(role in ('user','admin')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_idx
on public.profiles(lower(username));

create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 slug text not null unique,
 description text not null default '',
 icon text not null default '',
 created_at timestamptz not null default now()
);

create table if not exists public.resources (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 category_id uuid references public.categories(id) on delete set null,
 title text not null,
 slug text not null unique,
 description text not null default '',
 file_name text,
 file_path text,
 file_size bigint not null default 0,
 background_url text,
 thumbnail_url text,
 version text not null default '1.0',
 compatibility text not null default '',
 downloads bigint not null default 0,
 views bigint not null default 0,
 status text not null default 'published'
   check(status in('draft','published','hidden','deleted')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.resource_tags (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.resources(id) on delete cascade,
 tag text not null,
 created_at timestamptz not null default now()
);

create table if not exists public.downloads (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 downloaded_at timestamptz not null default now()
);

create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 rating integer not null check(rating between 1 and 5),
 content text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(resource_id,user_id)
);

create table if not exists public.bookmarks (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(resource_id,user_id)
);

create table if not exists public.resource_reports (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 reason text not null,
 description text not null default '',
 status text not null default 'pending'
   check(status in('pending','reviewed','resolved','rejected')),
 created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
 id integer primary key default 1,
 site_name text not null default 'TAMA',
 site_description text not null default '',
 logo_url text not null default '',
 favicon_url text not null default '',
 background_url text not null default '',
 allow_registration boolean not null default true,
 allow_upload boolean not null default true,
 allow_reviews boolean not null default true,
 updated_at timestamptz not null default now(),
 check(id=1)
);

insert into public.site_settings(id) values(1) on conflict(id) do nothing;

create or replace function public.update_timestamp()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_timestamp();

drop trigger if exists resources_updated_at on public.resources;
create trigger resources_updated_at before update on public.resources
for each row execute function public.update_timestamp();

drop trigger if exists reviews_updated_at on public.reviews;
create trigger reviews_updated_at before update on public.reviews
for each row execute function public.update_timestamp();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
 v_username text;
 v_name text;
begin
 v_username:=nullif(trim(new.raw_user_meta_data->>'username'),'');
 if v_username is null then
   v_username:='user_'||substr(replace(new.id::text,'-',''),1,8);
 end if;
 v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),v_username);

 insert into public.profiles(id,username,display_name,email,avatar_url,role)
 values(new.id,v_username,v_name,new.email,new.raw_user_meta_data->>'avatar_url','user')
 on conflict(id) do nothing;
 return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.lock_username()
returns trigger language plpgsql as $$
begin
 if old.username is distinct from new.username then
   raise exception 'Username tidak dapat diubah';
 end if;
 return new;
end;
$$;

drop trigger if exists profiles_username_lock on public.profiles;
create trigger profiles_username_lock before update on public.profiles
for each row execute function public.lock_username();

insert into public.categories(name,slug,description,icon) values
('Gamemode','gamemode','Gamemode','gamepad'),
('Filterscript','filterscript','Filterscript','code'),
('Include','include','Include','box'),
('Plugin','plugin','Plugin','plug'),
('Mapping','mapping','Mapping','map'),
('Textdraw','textdraw','Textdraw','layout'),
('Vehicle Pack','vehicle-pack','Vehicle Pack','car'),
('Skin Pack','skin-pack','Skin Pack','user'),
('Launcher','launcher','Launcher','rocket'),
('UCP','ucp','User Control Panel','monitor'),
('Tools','tools','Tools dan Utilities','wrench'),
('Open.mp','openmp','open.mp Resource','globe')
on conflict(slug) do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.resources enable row level security;
alter table public.resource_tags enable row level security;
alter table public.downloads enable row level security;
alter table public.reviews enable row level security;
alter table public.bookmarks enable row level security;
alter table public.resource_reports enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using(true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
using(auth.uid()=id or public.is_admin())
with check(auth.uid()=id or public.is_admin());

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using(true);

drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists resources_read on public.resources;
create policy resources_read on public.resources for select
using(status='published' or owner_id=auth.uid() or public.is_admin());

drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources for insert to authenticated
with check(owner_id=auth.uid());

drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources for update to authenticated
using(owner_id=auth.uid() or public.is_admin())
with check(owner_id=auth.uid() or public.is_admin());

drop policy if exists resources_delete on public.resources;
create policy resources_delete on public.resources for delete to authenticated
using(owner_id=auth.uid() or public.is_admin());

drop policy if exists tags_read on public.resource_tags;
create policy tags_read on public.resource_tags for select using(true);

drop policy if exists tags_write on public.resource_tags;
create policy tags_write on public.resource_tags for all to authenticated
using(exists(select 1 from public.resources r where r.id=resource_id and(r.owner_id=auth.uid() or public.is_admin())))
with check(exists(select 1 from public.resources r where r.id=resource_id and(r.owner_id=auth.uid() or public.is_admin())));

drop policy if exists downloads_read on public.downloads;
create policy downloads_read on public.downloads for select to authenticated
using(user_id=auth.uid() or public.is_admin());

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using(true);

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert to authenticated
with check(user_id=auth.uid());

drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update to authenticated
using(user_id=auth.uid() or public.is_admin())
with check(user_id=auth.uid() or public.is_admin());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete to authenticated
using(user_id=auth.uid() or public.is_admin());

drop policy if exists bookmarks_all on public.bookmarks;
create policy bookmarks_all on public.bookmarks for all to authenticated
using(user_id=auth.uid() or public.is_admin())
with check(user_id=auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.resource_reports;
create policy reports_insert on public.resource_reports for insert to authenticated
with check(user_id=auth.uid());

drop policy if exists reports_read on public.resource_reports;
create policy reports_read on public.resource_reports for select to authenticated
using(user_id=auth.uid() or public.is_admin());

drop policy if exists reports_admin on public.resource_reports;
create policy reports_admin on public.resource_reports for update to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists settings_read on public.site_settings;
create policy settings_read on public.site_settings for select using(true);

drop policy if exists settings_admin on public.site_settings;
create policy settings_admin on public.site_settings for all to authenticated
using(public.is_admin()) with check(public.is_admin());

-- Storage. Tidak menggunakan storage.objects.owner_id.
insert into storage.buckets(id,name,public) values
('resources','resources',true),
('avatars','avatars',true),
('backgrounds','backgrounds',true)
on conflict(id) do update set public=true;

drop policy if exists storage_resources_read on storage.objects;
create policy storage_resources_read on storage.objects for select to public
using(bucket_id='resources');

drop policy if exists storage_avatars_read on storage.objects;
create policy storage_avatars_read on storage.objects for select to public
using(bucket_id='avatars');

drop policy if exists storage_backgrounds_read on storage.objects;
create policy storage_backgrounds_read on storage.objects for select to public
using(bucket_id='backgrounds');

drop policy if exists storage_resources_insert on storage.objects;
create policy storage_resources_insert on storage.objects for insert to authenticated
with check(bucket_id='resources');

drop policy if exists storage_avatars_insert on storage.objects;
create policy storage_avatars_insert on storage.objects for insert to authenticated
with check(bucket_id='avatars');

drop policy if exists storage_backgrounds_insert on storage.objects;
create policy storage_backgrounds_insert on storage.objects for insert to authenticated
with check(bucket_id='backgrounds');

drop policy if exists storage_resources_update on storage.objects;
create policy storage_resources_update on storage.objects for update to authenticated
using(bucket_id='resources') with check(bucket_id='resources');

drop policy if exists storage_avatars_update on storage.objects;
create policy storage_avatars_update on storage.objects for update to authenticated
using(bucket_id='avatars') with check(bucket_id='avatars');

drop policy if exists storage_backgrounds_update on storage.objects;
create policy storage_backgrounds_update on storage.objects for update to authenticated
using(bucket_id='backgrounds') with check(bucket_id='backgrounds');

drop policy if exists storage_resources_delete on storage.objects;
create policy storage_resources_delete on storage.objects for delete to authenticated
using(bucket_id='resources');

drop policy if exists storage_avatars_delete on storage.objects;
create policy storage_avatars_delete on storage.objects for delete to authenticated
using(bucket_id='avatars');

drop policy if exists storage_backgrounds_delete on storage.objects;
create policy storage_backgrounds_delete on storage.objects for delete to authenticated
using(bucket_id='backgrounds');

select to_regclass('public.profiles') as profiles_table;
select to_regclass('public.resources') as resources_table;
