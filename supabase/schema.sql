-- petpen schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run; uses idempotent guards where possible.

-- ======================================================================
-- Enums
-- ======================================================================

do $$ begin
  create type species as enum ('dog', 'cat', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pet_sex as enum ('male', 'female', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stay_status as enum (
    'intook', 'available', 'claimed', 'fostered', 'discharged', 'hidden'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type foster_commitment as enum (
    'a_few_days', 'about_a_week', 'two_weeks', 'three_weeks', 'full_stay'
  );
exception when duplicate_object then null; end $$;

-- ======================================================================
-- Tables
-- ======================================================================

create table if not exists pets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  species         species not null,
  breed           text not null,
  age             int not null,
  sex             pet_sex not null default 'unknown',
  color_markings  text,
  weight          int,
  photo_url       text not null,
  sprite_url      text,
  bio             text,
  badges          jsonb not null default '[]'::jsonb,
  medical         jsonb not null default '{}'::jsonb,
  behavioral      jsonb not null default '{}'::jsonb,
  logistics       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists stays (
  id                        uuid primary key default gen_random_uuid(),
  pet_id                    uuid not null references pets(id) on delete cascade,
  owner_first_name          text not null,
  owner_phone               text not null,
  owner_email               text,
  owner_emergency_contact   jsonb,
  owner_what_if_unable      text,
  intook_at                 timestamptz not null default now(),
  expected_return           date not null default (current_date + interval '14 days')::date,
  actual_return             date,
  status                    stay_status not null default 'available',
  foster_first_name         text,
  foster_phone              text,
  foster_commitment         foster_commitment,
  claimed_at                timestamptz,
  coordinator_notes         text,
  created_at                timestamptz not null default now()
);

create index if not exists stays_pet_id_idx on stays(pet_id);
create index if not exists stays_status_idx on stays(status);

create table if not exists photo_updates (
  id                  uuid primary key default gen_random_uuid(),
  pet_id              uuid not null references pets(id) on delete cascade,
  poster_first_name   text not null,
  poster_phone        text not null,
  caption             text,
  image_url           text not null,
  created_at          timestamptz not null default now()
);

create index if not exists photo_updates_pet_id_idx on photo_updates(pet_id);

-- ======================================================================
-- Storage buckets (public read; writes go through service_role from server actions)
-- ======================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('sprites', 'sprites', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('photos', 'photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('updates', 'updates', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
