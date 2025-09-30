-- Helper to detect admin users based on email
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.email() in ('ahidalgod@gmail.com'), false);
$$;

-- Attendance policies
alter table public.attendance enable row level security;

create policy if not exists "attendance update own"
  on public.attendance
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "attendance admin can update all"
  on public.attendance
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Allow reading bars data
alter table public.bares enable row level security;

create policy if not exists "bares read"
  on public.bares
  for select
  to authenticated
  using (true);
