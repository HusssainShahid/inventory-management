# Inventory

Simple, mobile-first inventory app: add, edit, delete, search, and filter items. Built with HTML, Bootstrap 5, vanilla JS, and Supabase. Deploy to Vercel.

## Features

- **Fields:** item, quantity, location, updated at (readable)
- **CRUD:** add, edit, delete
- **Search:** by item name or location
- **Filter:** by location dropdown
- **Storage:** Supabase (Postgres)
- **Hosting:** Vercel (static)

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run:

```sql
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  quantity integer not null default 1,
  location text,
  updated_at timestamptz not null default now()
);

-- Optional: allow anonymous read/write for demo (tighten with RLS for production)
alter table public.items enable row level security;

create policy "Allow all for items"
  on public.items for all
  using (true)
  with check (true);
```

3. In **Settings → API** copy:
   - **Project URL**
   - **anon public** key

4. In this repo, edit `js/config.js` and set:

```js
window.SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
```

## Run locally

Open `index.html` in a browser, or use a local server (e.g. `npx serve .` or VS Code Live Server).

## Deploy on Vercel

1. Push this repo to GitHub (ensure `js/config.js` has your Supabase URL and anon key, or use env vars and a build step).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. **Framework Preset:** Other (static).
4. **Build and Output:** leave default (no build) or set **Build Command** empty and **Output Directory** `.`
5. Deploy.

To avoid committing keys, you can add **Environment Variables** in Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) and a small build step that writes `js/config.js` from them before deploy.

## Tech stack

- HTML, CSS, Bootstrap 5, vanilla JS
- Supabase (Postgres + JS client)
- Vercel (static hosting)
