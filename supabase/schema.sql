-- ============================================================
-- Mashonisa WebApp - Full Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  company_id uuid,
  full_name text not null default '',
  phone text,
  id_number text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Helper function to check admin status without triggering RLS recursion
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- 2. DOCUMENTS
-- ============================================================
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('id_doc', 'payslip', 'bank_statement', 'contract', 'other')),
  storage_path text not null,
  file_name text not null default '',
  status text not null default 'uploaded' check (status in ('uploaded', 'verified', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all documents"
  on public.documents for select
  using (public.is_admin());

create policy "Admins can update all documents"
  on public.documents for update
  using (public.is_admin());

-- 3. LOAN APPLICATIONS
-- ============================================================
create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_requested numeric not null,
  term_months int not null,
  monthly_income numeric not null default 0,
  monthly_expenses numeric not null default 0,
  existing_debt numeric not null default 0,
  affordability_result jsonb,
  status text not null default 'draft' check (
    status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed', 'cancelled')
  ),
  admin_notes text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table public.loan_applications enable row level security;

create policy "Users can view own applications"
  on public.loan_applications for select
  using (auth.uid() = user_id);

create policy "Users can insert own applications"
  on public.loan_applications for insert
  with check (auth.uid() = user_id);

create policy "Users can update own draft applications"
  on public.loan_applications for update
  using (auth.uid() = user_id and status = 'draft');

create policy "Admins can view all applications"
  on public.loan_applications for select
  using (public.is_admin());

create policy "Admins can update all applications"
  on public.loan_applications for update
  using (public.is_admin());

-- 4. LOANS
-- ============================================================
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  principal numeric not null,
  interest_rate numeric not null,
  fees numeric not null default 0,
  total_payable numeric not null,
  start_date date,
  status text not null default 'active' check (
    status in ('active', 'settled', 'in_arrears', 'written_off')
  ),
  created_at timestamptz not null default now()
);

alter table public.loans enable row level security;

create policy "Users can view own loans"
  on public.loans for select
  using (auth.uid() = user_id);

create policy "Admins can view all loans"
  on public.loans for select
  using (public.is_admin());

create policy "Admins can insert loans"
  on public.loans for insert
  with check (public.is_admin());

create policy "Admins can update loans"
  on public.loans for update
  using (public.is_admin());

-- 5. REPAYMENTS
-- ============================================================
create table if not exists public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  due_date date not null,
  amount_due numeric not null,
  amount_paid numeric not null default 0,
  paid_at timestamptz,
  status text not null default 'due' check (
    status in ('due', 'paid', 'partial', 'late')
  )
);

alter table public.repayments enable row level security;

create policy "Users can view own repayments"
  on public.repayments for select
  using (
    exists (
      select 1 from public.loans
      where loans.id = repayments.loan_id
      and loans.user_id = auth.uid()
    )
  );

create policy "Admins can view all repayments"
  on public.repayments for select
  using (public.is_admin());

create policy "Admins can insert repayments"
  on public.repayments for insert
  with check (public.is_admin());

create policy "Admins can update repayments"
  on public.repayments for update
  using (public.is_admin());

-- 6. TIERS
-- ============================================================
create table if not exists public.tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_successful_repayments int not null default 0,
  max_loan numeric not null,
  interest_rate numeric not null,
  rules jsonb
);

alter table public.tiers enable row level security;

create policy "Anyone can view tiers"
  on public.tiers for select
  using (true);

create policy "Admins can manage tiers"
  on public.tiers for all
  using (public.is_admin());

-- Seed tiers
insert into public.tiers (name, min_successful_repayments, max_loan, interest_rate, rules) values
  ('Tier 1',  0, 700,   5.0, '{"description": "New borrower"}'),
  ('Tier 2',  1, 1000,  4.5, '{"description": "After 1 successful repayment"}'),
  ('Tier 3',  3, 2000,  4.0, '{"description": "Higher limit"}'),
  ('Tier 4',  5, 3000,  3.5, '{"description": "Premium borrower"}')
on conflict (name) do nothing;

-- 7. USER TIER HISTORY
-- ============================================================
create table if not exists public.user_tier_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid not null references public.tiers(id),
  effective_from date not null default current_date,
  effective_to date
);

alter table public.user_tier_history enable row level security;

create policy "Users can view own tier history"
  on public.user_tier_history for select
  using (auth.uid() = user_id);

create policy "Admins can view all tier history"
  on public.user_tier_history for select
  using (public.is_admin());

create policy "Admins can manage tier history"
  on public.user_tier_history for all
  using (public.is_admin());

-- Auto-assign Basic tier to new profiles
create or replace function public.assign_default_tier()
returns trigger as $$
declare
  basic_tier_id uuid;
begin
  select id into basic_tier_id from public.tiers where name = 'Tier 1' limit 1;
  if basic_tier_id is not null then
    insert into public.user_tier_history (user_id, tier_id)
    values (new.id, basic_tier_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.assign_default_tier();

-- 8. AUDIT LOGS
-- ============================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "Admins can view audit logs"
  on public.audit_logs for select
  using (public.is_admin());

create policy "Authenticated users can insert audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = actor_user_id);

-- 9. STORAGE BUCKET
-- ============================================================
-- Run these in the Supabase dashboard > Storage or via the API:
-- Create bucket: "documents" (private)
-- Create bucket: "agreements" (private)
--
-- Storage RLS policies:
-- documents bucket:
--   SELECT: auth.uid()::text = (storage.foldername(name))[1]
--     OR exists(select 1 from profiles where id = auth.uid() and role = 'admin')
--   INSERT: auth.uid()::text = (storage.foldername(name))[1]
--
-- agreements bucket:
--   SELECT: exists(select 1 from loans where loans.user_id = auth.uid() and loans.id::text = (storage.foldername(name))[1])
--     OR exists(select 1 from profiles where id = auth.uid() and role = 'admin')
--   INSERT: exists(select 1 from profiles where id = auth.uid() and role = 'admin')
