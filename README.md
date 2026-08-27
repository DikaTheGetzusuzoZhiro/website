# TAMA Mod Sharing - Full Starter

## 1. Supabase
Run `supabase/schema.sql` in Supabase SQL Editor.

Then create an account on the website and make it admin:

```sql
update public.profiles
set role = 'admin'
where username = 'USERNAME_KAMU';
```

## 2. Local
Copy `.env.example` to `.env.local` and fill:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

Then:

npm install
npm run dev

## 3. Vercel
Import the GitHub repository into Vercel and add the same environment variables.

This package is a working starter for signup/login, immutable username, upload file, background image, resource listing and download.
