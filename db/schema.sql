create extension if not exists pgcrypto;

create table if not exists sessions (
  code              text primary key,
  seed              bigint      not null,
  sprints           integer     not null,
  sprint            integer     not null default 1,
  phase             integer     not null default 0,
  reveal_incident   boolean     not null default false,
  reveal_event      boolean     not null default false,
  finished          boolean     not null default false,
  host_token        text        not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists teams (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null references sessions(code) on delete cascade,
  name        text        not null,
  token       text        not null,
  state       jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists teams_code_idx on teams (code);
-- Group names are unique per session, case-insensitively. An expression like
-- lower(name) is not allowed in a table constraint, so it lives in an index.
create unique index if not exists teams_code_name_idx on teams (code, lower(name));

create table if not exists audit_log (
  id          bigserial   primary key,
  code        text        not null,
  team_name   text,
  sprint      integer     not null,
  phase       integer     not null,
  kind        text        not null,
  detail      jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_code_idx on audit_log (code, created_at desc);
