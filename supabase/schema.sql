-- =============================================================================
-- Gaby Style / GOAT Style Salon — esquema de Supabase
-- Pegar completo en Supabase → SQL Editor → Run (se puede volver a ejecutar sin romper).
-- Las columnas reflejan los datos que hoy guarda shared-data.js, y supabase-sync.js
-- traduce entre ambos formatos. Ver docs/supabase-setup.md para los pasos completos.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- -----------------------------------------------------------------------------
-- Barberos y roles del personal
-- -----------------------------------------------------------------------------
create table if not exists public.barbers (
    id text primary key,
    name text not null,
    alias text default '',
    email text unique,
    phone text default '',
    specialty text[] default '{}',
    bio text default '',
    avatar_url text default '',
    is_admin boolean not null default false,
    active boolean not null default true,
    years_experience int not null default 0,
    vip_clients int not null default 0,
    schedule text default '',
    socials jsonb not null default '{}'::jsonb,
    certifications jsonb not null default '[]'::jsonb,
    before_after jsonb not null default '[]'::jsonb,
    gallery jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

-- Une una cuenta de Supabase Auth con un barbero. is_admin = acceso a todo.
create table if not exists public.staff_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    barber_id text references public.barbers(id) on delete set null,
    is_admin boolean not null default false
);

-- Funciones auxiliares para las políticas (security definer evita recursion en RLS).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.staff_roles where user_id = auth.uid() and is_admin);
$$;

create or replace function public.my_barber_id() returns text
language sql stable security definer set search_path = public as $$
    select barber_id from public.staff_roles where user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Clientes (perfil enlazado a Supabase Auth; la contraseña la maneja Auth con hash)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text not null,
    email text not null,
    phone text default '',
    birth_date date,
    haircut text default '',
    beard text default '',
    preferred_barber text references public.barbers(id) on delete set null,
    photo_url text default '',
    consent jsonb,                -- { termsVersion, privacyVersion, acceptedAt, userAgent, source }
    marketing_consent jsonb,      -- { optIn, updatedAt }
    registered_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (los datos llegan en options.data del signUp).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    birth date := nullif(meta->>'birthDate', '')::date;
begin
    -- Las cuentas de staff se crean desde el panel de Supabase sin metadata: no llevan perfil.
    if meta->>'name' is null then
        return new;
    end if;
    if birth is not null and birth > (current_date - interval '18 years') then
        raise exception 'Las cuentas son para personas de 18 años o más.';
    end if;
    insert into public.profiles (id, name, email, phone, birth_date, haircut, beard, preferred_barber, photo_url, consent, marketing_consent)
    values (
        new.id,
        meta->>'name',
        new.email,
        coalesce(meta->>'phone', ''),
        birth,
        coalesce(meta->>'haircut', ''),
        coalesce(meta->>'beard', ''),
        nullif(meta->>'preferredBarber', ''),
        coalesce(meta->>'photo', ''),
        meta->'consent',
        meta->'marketingConsent'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Catalogo
-- -----------------------------------------------------------------------------
create table if not exists public.services (
    id text primary key,
    name text not null,
    price text not null default '',
    duration text default '',
    description text default '',
    active boolean not null default true,
    requests int not null default 0
);

create table if not exists public.products (
    id text primary key,
    barber_id text not null references public.barbers(id) on delete cascade,  -- quien lo vende
    name text not null,
    description text default '',
    price text not null default '',
    stock int not null default 0,
    sold int not null default 0,
    image_url text default '',
    active boolean not null default true
);

create table if not exists public.gallery (
    id text primary key,
    title text default '',
    barber_id text references public.barbers(id) on delete cascade,
    image_url text not null
);

create table if not exists public.news (
    id text primary key,
    author_id text references public.barbers(id) on delete set null,
    author_name text default '',
    role text default '',
    title text not null,
    body text not null default '',
    image_url text default '',
    likes int not null default 0,
    comments int not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists public.providers (
    id text primary key,
    name text not null,
    category text default '',
    contact text default '',
    phone text default '',
    status text default 'Activo'
);

-- -----------------------------------------------------------------------------
-- Citas, reseñas y actividad
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
    code text primary key,
    client_id uuid references public.profiles(id) on delete set null,
    client_name text not null default '',
    client_email text default '',
    service text not null,
    price text default '',
    barber_id text references public.barbers(id) on delete set null,
    status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
    date_time timestamptz,
    vip_details jsonb,
    policy_acceptance jsonb,      -- { versión, acceptedAt }
    canceled_by_client boolean not null default false,
    canceled_at timestamptz,
    cancellation_alert_seen_by text[] not null default '{}',
    created_at timestamptz not null default now()
);

-- Un cliente solo puede cancelar su cita; no puede aprobarla ni cambiar barbero, fecha o servicio.
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'COMPLETADA', 'NO_SHOW'));
alter table public.appointments add column if not exists duration int not null default 40 check (duration > 0 and duration <= 1440);
alter table public.appointments add column if not exists services text[] not null default '{}';
alter table public.appointments add column if not exists history jsonb not null default '[]';
alter table public.appointments add column if not exists client_phone text not null default '';
alter table public.appointments add column if not exists barber_name text not null default '';
alter table public.appointments add column if not exists source text not null default 'online';
alter table public.appointments add column if not exists notes text not null default '';
alter table public.appointments add column if not exists completed_at timestamptz;
alter table public.appointments add column if not exists no_show_at timestamptz;
alter table public.appointments add column if not exists canceled_by text not null default '';
alter table public.appointments add column if not exists cancel_reason text not null default '';
alter table public.appointments add column if not exists late_cancellation boolean not null default false;
alter table public.appointments add column if not exists reminder_sent_at timestamptz;
alter table public.appointments add column if not exists attendance text;
-- Foto de referencia opcional (JPEG reducido en el navegador) y opción "No sé cómo se llama el recorte".
alter table public.appointments add column if not exists reference_photo text not null default '' check (length(reference_photo) <= 400000);
alter table public.appointments add column if not exists unknown_cut boolean not null default false;
alter table public.appointments add column if not exists end_time timestamptz;
update public.appointments set end_time = date_time + make_interval(mins => duration) where end_time is null and date_time is not null;

create or replace function public.set_appointment_end() returns trigger
language plpgsql set search_path = public as $$
begin
    new.end_time := new.date_time + make_interval(mins => new.duration);
    return new;
end;
$$;
drop trigger if exists appointments_end_time on public.appointments;
create trigger appointments_end_time before insert or update on public.appointments for each row execute function public.set_appointment_end();
-- La restricción opera también entre dos reservas simultáneas de distintos teléfonos.
-- Si hay citas antiguas solapadas, la migración se detiene sin eliminar ninguna.
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'appointments_no_overlap' and conrelid = 'public.appointments'::regclass) then
        alter table public.appointments add constraint appointments_no_overlap
        exclude using gist (barber_id with =, tstzrange(date_time, end_time, '[)') with &&)
        where (status in ('PENDIENTE', 'APROBADA') and date_time is not null);
    end if;
end $$;

create or replace function public.guard_client_appointment_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare min_hours numeric;
begin
    if public.is_staff() then
        return new;
    end if;
    if new.status <> old.status and new.status <> 'CANCELADA' then
        raise exception 'Solo el personal puede cambiar el estado de la cita.';
    end if;
    if new.barber_id is distinct from old.barber_id
        or new.service is distinct from old.service
        or new.client_id is distinct from old.client_id
        or new.price is distinct from old.price
        or new.duration is distinct from old.duration
        or new.services is distinct from old.services
        or new.completed_at is distinct from old.completed_at
        or new.no_show_at is distinct from old.no_show_at then
        raise exception 'Para cambiar la cita comunícate con tu barbero.';
    end if;
    if new.date_time is distinct from old.date_time or new.status is distinct from old.status then
        select coalesce((booking->>'onlineChangeMinHours')::numeric, 2) into min_hours from public.shop_settings where id = 1;
        min_hours := coalesce(min_hours, 2);
        if old.status not in ('PENDIENTE', 'APROBADA') or old.date_time < now() + make_interval(secs => (min_hours * 3600)::double precision) then
            raise exception 'Esta cita ya no permite cambios en línea. Comunícate con la barbería.';
        end if;
        if new.date_time is distinct from old.date_time and new.date_time < now() + make_interval(secs => (min_hours * 3600)::double precision) then
            raise exception 'La nueva fecha no cumple el periodo mínimo para reservar.';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists appointments_client_guard on public.appointments;
create trigger appointments_client_guard
    before update on public.appointments
    for each row execute function public.guard_client_appointment_update();

create table if not exists public.reviews (
    id text primary key,
    client_id uuid references public.profiles(id) on delete set null,
    client_name text not null default 'Cliente',
    barber text not null default '',
    rating int not null default 5 check (rating between 1 and 5),
    text text not null default '',
    status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
    created_at timestamptz not null default now()
);

-- Ampliación compatible: conserva las reseñas anteriores sin asumir autorización.
alter table public.reviews add column if not exists appointment_code text references public.appointments(code) on delete set null;
alter table public.reviews add column if not exists barber_id text references public.barbers(id) on delete set null;
alter table public.reviews add column if not exists service text not null default '';
alter table public.reviews add column if not exists service_date date;
alter table public.reviews add column if not exists client_photo text not null default '';
alter table public.reviews add column if not exists publish_consent boolean;
alter table public.reviews add column if not exists hidden_reason text not null default '';
alter table public.reviews add column if not exists hidden_by text not null default '';
alter table public.reviews add column if not exists hidden_at timestamptz;
alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews add constraint reviews_status_check check (status in ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'OCULTA'));
create unique index if not exists reviews_one_per_appointment on public.reviews(appointment_code) where appointment_code is not null;

create or replace function public.guard_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
    if tg_op = 'UPDATE' then
        if not public.is_admin() then
            raise exception 'Solo el administrador puede moderar reseñas.';
        end if;
        if (to_jsonb(new) - array['status', 'hidden_reason', 'hidden_by', 'hidden_at'])
            is distinct from (to_jsonb(old) - array['status', 'hidden_reason', 'hidden_by', 'hidden_at']) then
            raise exception 'La moderación no puede cambiar la opinión ni el permiso del cliente.';
        end if;
        if new.status = 'OCULTA' then
            if length(trim(new.hidden_reason)) = 0 then
                raise exception 'Indica qué norma viola la reseña.';
            end if;
            new.hidden_by := auth.uid()::text;
            new.hidden_at := now();
        end if;
        return new;
    end if;
    if new.publish_consent is null then
        raise exception 'Indica si permites que tu reseña se publique en la página.';
    end if;
    select * into a from public.appointments where code = new.appointment_code;
    if not found or a.client_id is distinct from auth.uid() or a.status <> 'COMPLETADA' then
        raise exception 'Solo puedes reseñar tus propias citas completadas.';
    end if;
    if length(trim(new.text)) > 600 then
        raise exception 'El comentario debe tener como máximo 600 caracteres.';
    end if;
    new.client_id := a.client_id;
    new.client_name := a.client_name;
    select coalesce(photo_url, '') into new.client_photo from public.profiles where id = a.client_id;
    new.barber_id := a.barber_id;
    new.service := a.service;
    new.service_date := (a.date_time at time zone 'America/Puerto_Rico')::date;
    new.status := 'APROBADA';
    new.created_at := now();
    new.hidden_reason := '';
    new.hidden_by := '';
    new.hidden_at := null;
    return new;
end;
$$;
drop trigger if exists reviews_guard on public.reviews;
create trigger reviews_guard before insert or update on public.reviews for each row execute function public.guard_review();

create table if not exists public.activity_log (
    id text primary key,
    type text default '',
    text text default '',
    created_at timestamptz not null default now()
);

create table if not exists public.barber_applications (
    id text primary key,
    data jsonb not null,
    created_at timestamptz not null default now()
);

-- Configuración global de la barbería (una sola fila, id = 1).
create table if not exists public.shop_settings (
    id int primary key default 1 check (id = 1),
    shop_mode text not null default 'online',
    closure_notice text default '',
    updated_at timestamptz not null default now()
);

-- Datos administrados por los formularios actuales. Las migraciones no pisan valores.
alter table public.shop_settings add column if not exists business jsonb not null default '{}';
alter table public.shop_settings add column if not exists booking jsonb not null default '{}';
alter table public.shop_settings add column if not exists service_categories text[] not null default '{}';
alter table public.barbers add column if not exists weekly_schedule jsonb;
alter table public.services add column if not exists minutes int not null default 40 check (minutes > 0 and minutes <= 600);
alter table public.services add column if not exists category text not null default 'Cortes';
alter table public.services add column if not exists image_url text not null default '';
alter table public.services add column if not exists barber_ids text[] not null default '{}';
alter table public.profiles add column if not exists favorites jsonb not null default '{}';
alter table public.profiles add column if not exists status text not null default 'Activo';
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists alt_phones jsonb not null default '[]';
alter table public.profiles add column if not exists last_modified_at timestamptz;

-- -----------------------------------------------------------------------------
-- Ficha CRM (memos, pagos, descuentos). El contenido va en jsonb con la misma forma que crm/src/types.ts.
-- -----------------------------------------------------------------------------
create table if not exists public.memos (
    id text primary key,
    client_id uuid references public.profiles(id) on delete cascade,
    data jsonb not null,
    created_at timestamptz not null default now()
);

create table if not exists public.payments (
    id text primary key,
    client_id uuid references public.profiles(id) on delete set null,
    data jsonb not null,
    created_at timestamptz not null default now()
);

create table if not exists public.discounts (
    id text primary key,
    client_id uuid references public.profiles(id) on delete set null,
    data jsonb not null,
    created_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security: nadie puede leer ni escribir nada que no le corresponda.
-- =============================================================================
alter table public.barbers enable row level security;
alter table public.staff_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.gallery enable row level security;
alter table public.news enable row level security;
alter table public.providers enable row level security;
alter table public.appointments enable row level security;
alter table public.reviews enable row level security;
alter table public.activity_log enable row level security;
alter table public.barber_applications enable row level security;
alter table public.shop_settings enable row level security;
alter table public.memos enable row level security;
alter table public.payments enable row level security;
alter table public.discounts enable row level security;

-- Borra políticas anteriores para poder re-ejecutar este archivo.
do $$
declare pol record;
begin
    for pol in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
        execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    end loop;
end $$;

-- Barberos: publicos para leer; el admin los administra y cada barbero edita su propio perfil.
create policy barbers_read on public.barbers for select using (true);
create policy barbers_admin_write on public.barbers for all using (public.is_admin()) with check (public.is_admin());
create policy barbers_self_update on public.barbers for update using (id = public.my_barber_id()) with check (id = public.my_barber_id());

create policy staff_roles_read on public.staff_roles for select using (user_id = auth.uid() or public.is_admin());
create policy staff_roles_admin on public.staff_roles for all using (public.is_admin()) with check (public.is_admin());

-- Perfiles: cada cliente ve y edita el suyo; el admin ve todos; el barbero ve sus clientes.
create policy profiles_own on public.profiles for select using (id = auth.uid());
create policy profiles_staff_read on public.profiles for select using (
    public.is_admin()
    or preferred_barber = public.my_barber_id()
    or exists (select 1 from public.appointments a where a.client_id = profiles.id and a.barber_id = public.my_barber_id())
);
create policy profiles_own_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_update on public.profiles for update using (public.is_staff()) with check (public.is_staff());

-- Catalogo público.
create policy services_read on public.services for select using (true);
create policy services_staff_write on public.services for all using (public.is_staff()) with check (public.is_staff());

create policy products_read on public.products for select using (true);
create policy products_owner_write on public.products for all
    using (public.is_admin() or barber_id = public.my_barber_id())
    with check (public.is_admin() or barber_id = public.my_barber_id());

create policy gallery_read on public.gallery for select using (true);
create policy gallery_owner_write on public.gallery for all
    using (public.is_admin() or barber_id = public.my_barber_id())
    with check (public.is_admin() or barber_id = public.my_barber_id());

create policy news_read on public.news for select using (true);
create policy news_author_write on public.news for all
    using (public.is_admin() or author_id = public.my_barber_id())
    with check (public.is_admin() or author_id = public.my_barber_id());

create policy providers_staff on public.providers for all using (public.is_staff()) with check (public.is_staff());

-- Citas: el cliente ve, crea y cancela las suyas; el barbero ve y gestiona las suyas; el admin todas.
create policy appointments_client_read on public.appointments for select using (client_id = auth.uid());
create policy appointments_staff_read on public.appointments for select using (public.is_admin() or barber_id = public.my_barber_id());
create policy appointments_client_insert on public.appointments for insert
    with check (client_id = auth.uid() and (status = 'PENDIENTE' or
        (status = 'APROBADA' and coalesce((select (booking->>'autoConfirm')::boolean from public.shop_settings where id = 1), true))));
create policy appointments_staff_insert on public.appointments for insert
    with check (public.is_admin() or barber_id = public.my_barber_id());
create policy appointments_client_update on public.appointments for update
    using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy appointments_staff_update on public.appointments for update
    using (public.is_admin() or barber_id = public.my_barber_id())
    with check (public.is_admin() or barber_id = public.my_barber_id());
create policy appointments_admin_delete on public.appointments for delete using (public.is_admin());

-- Reseñas: publicas solo si están aprobadas; el cliente crea las suyas como pendientes.
create policy reviews_public_read on public.reviews for select using (
    (status = 'APROBADA' and publish_consent is true) or client_id = auth.uid()
    or public.is_admin() or barber_id = public.my_barber_id()
);
create policy reviews_client_insert on public.reviews for insert with check (
    auth.uid() is not null and client_id = auth.uid() and status = 'APROBADA'
    and publish_consent is not null and appointment_code is not null
);
create policy reviews_admin_moderate on public.reviews for update using (public.is_admin()) with check (public.is_admin());

create policy activity_insert on public.activity_log for insert with check (auth.uid() is not null);
create policy activity_staff_read on public.activity_log for select using (public.is_staff());

create policy applications_insert on public.barber_applications for insert with check (true);
create policy applications_admin_read on public.barber_applications for select using (public.is_admin());

create policy settings_read on public.shop_settings for select using (true);
create policy settings_admin_write on public.shop_settings for all using (public.is_admin()) with check (public.is_admin());

create policy memos_staff on public.memos for all using (public.is_staff()) with check (public.is_staff());
create policy payments_staff on public.payments for all using (public.is_staff()) with check (public.is_staff());
create policy discounts_staff on public.discounts for all using (public.is_staff()) with check (public.is_staff());

-- =============================================================================
-- Datos iniciales (on conflict do nothing: no pisa cambios hechos después)
-- =============================================================================
insert into public.barbers (id, name, alias, email, phone, specialty, bio, avatar_url, is_admin, active, years_experience, vip_clients, schedule, socials, certifications, gallery) values
('gabriel', 'Gabriel Andres Ortiz', 'Gaby', 'gaby@goatstylesalon.com', '787-218-1068', '{"Fade Premium","Diseño","Celebridades"}', 'Administrador general y fundador de la barbería.',
 'https://res.cloudinary.com/dtw3qx4qq/image/upload/v1783942400/320ed6b8-6ea7-4309-9f6a-e6ecf33bb939_sop8ao.jpg', true, true, 14, 2000, '8AM - 10PM',
 '{"instagram":"https://www.instagram.com/gabystylee_","facebook":"https://www.facebook.com/share/1F6o7gHn9A/"}',
 '[{"id":"cert-gabriel-1","name":"Barbero"},{"id":"cert-gabriel-2","name":"Estilista"},{"id":"cert-gabriel-3","name":"Colorimetría"}]', '[]'),
('darialex', 'Darialex Rivera', 'Tazmania', 'darialex@goatstylesalon.com', '787-228-5878', '{"Barba Detallada","Color","Rapado"}', 'Especialista en barba, color y experiencias premium.',
 'https://res.cloudinary.com/dtw3qx4qq/image/upload/v1783942759/449dcd8d-1026-4eef-b360-20464ed96cd6_l5ccyi.jpg', false, true, 8, 1500, '8AM - 11PM',
 '{"instagram":"https://www.instagram.com/darialexthebarber"}',
 '[{"id":"cert-darialex-1","name":"Licencia profesional de barbero"},{"id":"cert-darialex-2","name":"Certificación en diseño y detalle de barba"},{"id":"cert-darialex-3","name":"Certificación en color y técnicas avanzadas"}]', '[]'),
('wilo', 'Wilo', '', 'wilo@goatstylesalon.com', '939-324-2271', '{}', '',
 'https://res.cloudinary.com/dtw3qx4qq/image/upload/v1785203892/ddd23b62-7c16-46d3-bffd-fe2750215649_najb0v.jpg', false, true, 0, 0, '',
 '{"instagram":"https://www.instagram.com/wilostudio6"}', '[]', '[]')
on conflict (id) do nothing;

insert into public.services (id, name, price, duration, description) values
('service-1', 'Classic Cut', '$35', 'Incluye bebida y lavado', 'Todo corte incluye una bebida de preferencia y lavado de cabello.'),
('service-2', 'Premium Fade', '$40', 'Corte premium', 'Premium Fade con acabado limpio y profesional.'),
('service-3', 'Signature Cut', '$45', 'Traditional Hot Towel Shave', 'Signature Cut con Traditional Hot Towel Shave.'),
('service-4', 'Kids Premium', '$35', 'Hasta 12 años', 'Kids Premium para niños de hasta 12 años.'),
('service-5', 'Baby Cut', 'Consultar', 'Consulta previa', 'Baby Cut sujeto a consulta previa.'),
('service-6', 'Hair Light', '$65', 'Color', 'Hair Light para un look más definido y moderno.'),
('service-7', 'Platinado', '$120', 'No incluye corte', 'Platinado completo. No incluye corte.'),
('service-8', 'Hidratación Capilar', 'Desde $30', 'Tratamiento', 'Tratamiento de hidratación capilar.'),
('service-9', 'Keratina', 'Desde $45', 'Tratamiento', 'Keratina para mejorar la textura y controlar el frizz.'),
('service-10', 'Limpieza Facial Profunda', '$50', 'Facial', 'Limpieza facial profunda.'),
('service-11', 'GOAT VIP Experience', '$100', 'Experiencia completa', 'Incluye Signature Cut, diseño de barba, lavado, toallas calientes, masaje capilar, limpieza facial express, bebida de cortesía y productos premium para finalizar.')
on conflict (id) do nothing;

insert into public.products (id, barber_id, name, description, price, stock, sold, image_url) values
('prod-1', 'gabriel', 'Pomada Premium Mate', 'Fijación fuerte, acabado mate.', '$20', 15, 48, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80'),
('prod-2', 'gabriel', 'Aceite para Barba Dorado', 'Hidrata y suaviza la barba.', '$25', 8, 35, 'https://images.unsplash.com/photo-1626202373052-2bbb4f5b9d62?auto=format&fit=crop&w=600&q=80'),
('prod-3', 'gabriel', 'Shampoo Artefacto', 'Limpieza profunda sin sulfatos.', '$18', 20, 28, 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80'),
('prod-4', 'gabriel', 'Cera Modeladora Classic', 'Para peinados clásicos con brillo.', '$22', 12, 22, 'https://images.unsplash.com/photo-1631730486572-226d1f595b68?auto=format&fit=crop&w=600&q=80')
on conflict (id) do nothing;

insert into public.news (id, author_id, author_name, role, title, body, created_at) values
('news-apertura-2026', 'gabriel', 'Gabriel (Gaby)', 'Admin General', 'Apertura de la nueva barbería',
 'El sábado 7 de noviembre de 2026 abrimos las puertas de nuestra nueva barbería. Te esperamos para celebrar juntos. Ya puedes reservar tu cita desde la página.',
 '2026-10-20T12:00:00Z')
on conflict (id) do nothing;

insert into public.shop_settings (id) values (1) on conflict (id) do nothing;

-- =============================================================================
-- Cuentas del personal: primero crea los 3 usuarios en Authentication → Users
-- (gaby@, darialex@, wilo@goatstylesalon.com) y luego ejecuta este bloque.
-- =============================================================================
insert into public.staff_roles (user_id, barber_id, is_admin)
select id, 'gabriel', true from auth.users where email = 'gaby@goatstylesalon.com'
on conflict (user_id) do update set barber_id = excluded.barber_id, is_admin = excluded.is_admin;
insert into public.staff_roles (user_id, barber_id, is_admin)
select id, 'darialex', false from auth.users where email = 'darialex@goatstylesalon.com'
on conflict (user_id) do update set barber_id = excluded.barber_id, is_admin = excluded.is_admin;
insert into public.staff_roles (user_id, barber_id, is_admin)
select id, 'wilo', false from auth.users where email = 'wilo@goatstylesalon.com'
on conflict (user_id) do update set barber_id = excluded.barber_id, is_admin = excluded.is_admin;

-- =============================================================================
-- SEGURIDAD Y PANEL TECNICO (agregado despues; se puede ejecutar sobre lo anterior)
-- =============================================================================

-- Rol de desarrollador (Angel) y cambio obligatorio de contrasena.
alter table public.staff_roles add column if not exists is_developer boolean not null default false;
alter table public.staff_roles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.is_developer() returns boolean
language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.staff_roles where user_id = auth.uid() and is_developer);
$$;

-- Configuracion global del sitio (modo mantenimiento). Todos la leen; solo el desarrollador la cambia.
create table if not exists public.site_config (
    id int primary key default 1 check (id = 1),
    maintenance jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.site_config enable row level security;
drop policy if exists site_config_read on public.site_config;
drop policy if exists site_config_dev_write on public.site_config;
create policy site_config_read on public.site_config for select using (true);
create policy site_config_dev_write on public.site_config for all using (public.is_developer()) with check (public.is_developer());
insert into public.site_config (id) values (1) on conflict (id) do nothing;

-- Intentos fallidos y bloqueos. Solo el desarrollador los lee directamente;
-- el sitio usa las funciones de abajo.
create table if not exists public.login_attempts (
    email text primary key,
    count int not null default 0,
    account_type text default 'client',
    last_at timestamptz not null default now()
);

create table if not exists public.account_locks (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    account_type text not null default 'client',
    user_id uuid,
    attempts int not null default 3,
    user_agent text default '',
    status text not null default 'BLOQUEADA' check (status in ('BLOQUEADA', 'MANTENER_BLOQUEADA', 'DESBLOQUEADA')),
    locked_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by uuid
);

alter table public.login_attempts enable row level security;
alter table public.account_locks enable row level security;
drop policy if exists login_attempts_dev on public.login_attempts;
drop policy if exists account_locks_dev on public.account_locks;
create policy login_attempts_dev on public.login_attempts for all using (public.is_developer()) with check (public.is_developer());
create policy account_locks_dev on public.account_locks for all using (public.is_developer()) with check (public.is_developer());

-- Esta bloqueada esta cuenta? (se consulta antes de iniciar sesion)
create or replace function public.login_guard(p_email text) returns jsonb
language sql stable security definer set search_path = public as $$
    select jsonb_build_object('locked', exists (
        select 1 from public.account_locks where lower(email) = lower(trim(p_email)) and status <> 'DESBLOQUEADA'
    ));
$$;

-- Registra un intento fallido; al tercero bloquea la cuenta (si existe).
-- Responde igual exista o no la cuenta, para no revelar que correos estan registrados.
create or replace function public.register_failed_login(p_email text, p_user_agent text default '', p_account_type text default 'client') returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
    v_email text := lower(trim(p_email));
    v_count int;
    v_user uuid;
begin
    insert into public.login_attempts (email, count, account_type, last_at)
    values (v_email, 1, p_account_type, now())
    on conflict (email) do update set count = public.login_attempts.count + 1, last_at = now(), account_type = excluded.account_type
    returning count into v_count;

    if v_count >= 3 then
        select id into v_user from auth.users where lower(email) = v_email;
        if v_user is not null and not exists (
            select 1 from public.account_locks where lower(email) = v_email and status <> 'DESBLOQUEADA'
        ) then
            insert into public.account_locks (email, account_type, user_id, attempts, user_agent)
            values (v_email, p_account_type, v_user, v_count, left(coalesce(p_user_agent, ''), 400));
        end if;
    end if;
    return jsonb_build_object('locked', v_count >= 3, 'attempts_left', greatest(0, 3 - v_count));
end;
$$;

create or replace function public.clear_login_attempts() returns void
language sql security definer set search_path = public as $$
    delete from public.login_attempts where email = lower(auth.email());
$$;

create or replace function public.must_change_password() returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce(
        (select must_change_password from public.profiles where id = auth.uid()),
        (select must_change_password from public.staff_roles where user_id = auth.uid()),
        false
    );
$$;

create or replace function public.clear_must_change_password() returns void
language plpgsql security definer set search_path = public as $$
begin
    update public.profiles set must_change_password = false where id = auth.uid();
    update public.staff_roles set must_change_password = false where user_id = auth.uid();
end;
$$;

-- Lista para el panel tecnico con los datos de contacto necesarios para verificar a la persona.
create or replace function public.locked_accounts() returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
    if not public.is_developer() then
        raise exception 'Solo el desarrollador puede ver los bloqueos.';
    end if;
    return query
    select jsonb_build_object(
        'id', l.id, 'email', l.email, 'accountType', l.account_type, 'accountId', l.user_id, 'attempts', l.attempts,
        'userAgent', l.user_agent, 'status', l.status, 'lockedAt', l.locked_at, 'resolvedAt', l.resolved_at,
        'profile', jsonb_build_object(
            'name', coalesce(p.name, b.name), 'phone', coalesce(p.phone, b.phone), 'birthDate', p.birth_date,
            'registeredAt', p.registered_at, 'preferredBarber', p.preferred_barber, 'haircut', p.haircut,
            'appointments', (select count(*) from public.appointments a where a.client_id = l.user_id)
        )
    )
    from public.account_locks l
    left join public.profiles p on p.id = l.user_id
    left join public.staff_roles s on s.user_id = l.user_id
    left join public.barbers b on b.id = s.barber_id
    order by l.locked_at desc;
end;
$$;

create or replace function public.resolve_account_lock(p_lock_id uuid, p_unlock boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
    v_lock public.account_locks;
begin
    if not public.is_developer() then
        raise exception 'Solo el desarrollador puede desbloquear cuentas.';
    end if;
    update public.account_locks
        set status = case when p_unlock then 'DESBLOQUEADA' else 'MANTENER_BLOQUEADA' end,
            resolved_at = now(), resolved_by = auth.uid()
        where id = p_lock_id
        returning * into v_lock;
    if p_unlock and v_lock.id is not null then
        delete from public.login_attempts where email = lower(v_lock.email);
        -- Al desbloquear se exige una contrasena nueva.
        update public.profiles set must_change_password = true where id = v_lock.user_id;
        update public.staff_roles set must_change_password = true where user_id = v_lock.user_id;
    end if;
end;
$$;

revoke all on function public.login_guard(text) from public;
revoke all on function public.register_failed_login(text, text, text) from public;
grant execute on function public.login_guard(text) to anon, authenticated;
grant execute on function public.register_failed_login(text, text, text) to anon, authenticated;
grant execute on function public.clear_login_attempts() to authenticated;
grant execute on function public.must_change_password() to authenticated;
grant execute on function public.clear_must_change_password() to authenticated;
grant execute on function public.locked_accounts() to authenticated;
grant execute on function public.resolve_account_lock(uuid, boolean) to authenticated;
grant execute on function public.is_developer() to authenticated;

-- Cuenta de Angel (desarrollador): creala en Authentication > Users, cambia el correo abajo y ejecuta:
-- Ocupación pública limitada: nunca devuelve identidad ni código de otros clientes.
create or replace function public.booking_busy_slots()
returns table (barber_id text, date_time timestamptz, duration int, own_code text)
language sql stable security definer set search_path = public as $$
    select a.barber_id, a.date_time, a.duration,
        case when a.client_id = auth.uid() or public.is_admin() or a.barber_id = public.my_barber_id() then a.code else null end
    from public.appointments a
    where a.status in ('PENDIENTE', 'APROBADA')
      and a.date_time >= now() - interval '1 day'
      and a.date_time <= now() + interval '366 days';
$$;
revoke all on function public.booking_busy_slots() from public;
grant execute on function public.booking_busy_slots() to anon, authenticated;

-- Cuenta de Angel (desarrollador): creala en Authentication > Users, cambia el correo abajo y ejecuta:
-- insert into public.staff_roles (user_id, barber_id, is_admin, is_developer)
-- select id, null, false, true from auth.users where email = 'TU-CORREO@ejemplo.com'
-- on conflict (user_id) do update set is_developer = true;
