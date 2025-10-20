-- Create brokerage integration tables and security policies
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create table if not exists public.brokerage_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'errored', 'revoked')),
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  access_token_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on column public.brokerage_connections.access_token_encrypted is 'Store encrypted access tokens with pgp_sym_encrypt or Supabase Vault.';
comment on column public.brokerage_connections.refresh_token_encrypted is 'Store encrypted refresh tokens with pgp_sym_encrypt or Supabase Vault.';

create table if not exists public.brokerage_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.brokerage_connections(id) on delete cascade,
  external_id text,
  name text,
  account_type text,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists brokerage_accounts_connection_idx on public.brokerage_accounts(connection_id);

create table if not exists public.brokerage_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.brokerage_accounts(id) on delete cascade,
  symbol text not null,
  quantity numeric not null default 0,
  cost_basis numeric,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists brokerage_positions_account_idx on public.brokerage_positions(account_id);
create index if not exists brokerage_positions_symbol_idx on public.brokerage_positions(symbol);

create trigger set_timestamp_brokerage_connections
before update on public.brokerage_connections
for each row execute function public.set_updated_at();

create trigger set_timestamp_brokerage_accounts
before update on public.brokerage_accounts
for each row execute function public.set_updated_at();

create trigger set_timestamp_brokerage_positions
before update on public.brokerage_positions
for each row execute function public.set_updated_at();

alter table public.brokerage_connections enable row level security;
alter table public.brokerage_accounts enable row level security;
alter table public.brokerage_positions enable row level security;

create policy "Users can manage their brokerage connections" on public.brokerage_connections
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their brokerage accounts" on public.brokerage_accounts
  for select using (
    exists (
      select 1
      from public.brokerage_connections bc
      where bc.id = brokerage_accounts.connection_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can insert their brokerage accounts" on public.brokerage_accounts
  for insert with check (
    exists (
      select 1
      from public.brokerage_connections bc
      where bc.id = brokerage_accounts.connection_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can update their brokerage accounts" on public.brokerage_accounts
  for update using (
    exists (
      select 1
      from public.brokerage_connections bc
      where bc.id = brokerage_accounts.connection_id
        and bc.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.brokerage_connections bc
      where bc.id = brokerage_accounts.connection_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can delete their brokerage accounts" on public.brokerage_accounts
  for delete using (
    exists (
      select 1
      from public.brokerage_connections bc
      where bc.id = brokerage_accounts.connection_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can read their brokerage positions" on public.brokerage_positions
  for select using (
    exists (
      select 1
      from public.brokerage_accounts ba
      join public.brokerage_connections bc on bc.id = ba.connection_id
      where ba.id = brokerage_positions.account_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can insert their brokerage positions" on public.brokerage_positions
  for insert with check (
    exists (
      select 1
      from public.brokerage_accounts ba
      join public.brokerage_connections bc on bc.id = ba.connection_id
      where ba.id = brokerage_positions.account_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can update their brokerage positions" on public.brokerage_positions
  for update using (
    exists (
      select 1
      from public.brokerage_accounts ba
      join public.brokerage_connections bc on bc.id = ba.connection_id
      where ba.id = brokerage_positions.account_id
        and bc.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.brokerage_accounts ba
      join public.brokerage_connections bc on bc.id = ba.connection_id
      where ba.id = brokerage_positions.account_id
        and bc.user_id = auth.uid()
    )
  );

create policy "Users can delete their brokerage positions" on public.brokerage_positions
  for delete using (
    exists (
      select 1
      from public.brokerage_accounts ba
      join public.brokerage_connections bc on bc.id = ba.connection_id
      where ba.id = brokerage_positions.account_id
        and bc.user_id = auth.uid()
    )
  );
