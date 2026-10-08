create extension if not exists pgcrypto;

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  table_number integer unique not null,
  active boolean not null default true
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Other',
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables(id) on delete cascade,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','PAID','CANCELLED')),
  reward_type text,
  reward_value numeric(10,2) not null default 0,
  reward_revealed boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  price numeric(10,2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

alter table public.tables enable row level security;
alter table public.menu_items enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;

-- MVP policies: customers need to read active menu/table/bill data and update a bill's reward fields.
-- Before a public production launch, replace these broad policies with Supabase Auth + staff roles.
drop policy if exists "public read active tables" on public.tables;
create policy "public read active tables" on public.tables for select using (active = true);

drop policy if exists "public read menu" on public.menu_items;
create policy "public read menu" on public.menu_items for select using (available = true);

drop policy if exists "public read open bills" on public.bills;
create policy "public read open bills" on public.bills for select using (status = 'OPEN');

drop policy if exists "public create bills" on public.bills;
create policy "public create bills" on public.bills for insert with check (status = 'OPEN');

drop policy if exists "public update open bills" on public.bills;
create policy "public update open bills" on public.bills for update using (status = 'OPEN') with check (status in ('OPEN','PAID'));

drop policy if exists "public read bill items" on public.bill_items;
create policy "public read bill items" on public.bill_items for select using (exists (select 1 from public.bills b where b.id = bill_items.bill_id and b.status = 'OPEN'));

drop policy if exists "public insert bill items" on public.bill_items;
create policy "public insert bill items" on public.bill_items for insert with check (exists (select 1 from public.bills b where b.id = bill_items.bill_id and b.status = 'OPEN'));

insert into public.tables(table_number) values
(1),(2),(3),(4),(5),(6),(7),(8),(9),(10)
on conflict (table_number) do nothing;

insert into public.menu_items(name, description, category, price) values
('Meals','Homestyle Andhra meal','Meals',120),
('Veg Biryani','Aromatic rice with vegetables','Rice',160),
('Chicken Biryani','House-style chicken biryani','Biryani',240),
('Chicken 65','Crispy spicy chicken','Starters',220),
('Paneer 65','Crispy paneer starter','Starters',180),
('Dal Fry','Comforting dal with tempering','Curries',130),
('Curd Rice','Cooling curd rice','Rice',80),
('Soft Drink','Chilled beverage','Beverages',40);
