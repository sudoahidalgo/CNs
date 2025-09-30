-- Helper to detect admin users based on email
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.email() in ('ahidalgod@gmail.com'), false);
$$;

-- Asistencias policies
alter table public.asistencias enable row level security;

create policy if not exists "asistencias update own"
  on public.asistencias
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "asistencias admin can update all"
  on public.asistencias
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
