-- Items table (if not already created)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  quantity integer not null default 1,
  location text,
  updated_at timestamptz not null default now()
);

-- Issued table: one record per issuance; return_qty and return_date updated when items are returned
create table if not exists public.issued (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete restrict,
  issued_to text not null,
  issued_at date not null,
  quantity_issued integer not null check (quantity_issued > 0),
  return_quantity integer not null default 0 check (return_quantity >= 0),
  return_date date,
  created_at timestamptz not null default now(),
  constraint return_qty_lte_issued check (return_quantity <= quantity_issued)
);

-- RLS
alter table public.items enable row level security;
alter table public.issued enable row level security;

create policy "Allow all for items"
  on public.items for all
  using (true)
  with check (true);

create policy "Allow all for issued"
  on public.issued for all
  using (true)
  with check (true);
