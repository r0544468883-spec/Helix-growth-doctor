-- HELIX Growth Doctor — schema. Events (funnel + returns) → funnel/retention
-- engines → insights. Privacy: data stays in the customer's own Supabase.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_domain text,
  created_at timestamptz default now()
);
create table if not exists memberships (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'owner',
  primary key (workspace_id, user_id)
);

-- Raw behavior events from the HELIX tag (or connectors). One row per event.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  visitor_id text not null,                 -- anonymous stable id
  name text not null,                       -- pageview | step:product | step:cart | step:checkout | purchase | return | ...
  step int,                                 -- funnel step index (nullable)
  meta jsonb default '{}'::jsonb,           -- {page, x, y, ...} for heatmap
  ts timestamptz default now()
);
create index if not exists idx_events_ws on events(workspace_id, ts desc);
create index if not exists idx_events_name on events(workspace_id, name);
create index if not exists idx_events_visitor on events(workspace_id, visitor_id);

-- Funnel definition (ordered step names) per workspace.
create table if not exists funnels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  steps text[] not null default '{}',
  created_at timestamptz default now()
);

-- Data-source connections (Clarity / GA4 / Mixpanel — BYOK, encrypted).
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  provider text not null,
  status text default 'connected',
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- AI diagnoses (insight → recommended action → link to the fix).
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  axis text,                                -- conversion | retention | monetization
  severity text default 'warn',             -- crit | warn | good
  title text not null,
  detail text,
  action text,                              -- landing | ab | campaign | winback
  created_at timestamptz default now()
);

-- Map a bot chat to a workspace so the Doctor answers with the right data.
create table if not exists bot_links (
  chat_id text primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  created_at timestamptz default now()
);

alter table workspaces  enable row level security;
alter table memberships enable row level security;
alter table events      enable row level security;
alter table funnels     enable row level security;
alter table connections enable row level security;
alter table insights    enable row level security;

create or replace function is_member(ws uuid) returns boolean language sql security definer stable as $$
  select exists (select 1 from memberships m where m.workspace_id = ws and m.user_id = auth.uid());
$$;
create or replace function create_workspace(ws_name text) returns uuid language plpgsql security definer as $$
declare new_id uuid; begin
  insert into workspaces (name) values (ws_name) returning id into new_id;
  insert into memberships (workspace_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- Custom (workspace-uploaded) message templates. A workspace defines its OWN
-- WhatsApp templates, merged OVER the built-in catalog (a custom row with the same
-- key overrides the built-in). Backs lib/templates/custom.ts.
create table if not exists custom_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  kind text not null,                         -- 'whatsapp'
  key text not null,                          -- logical key (overrides a built-in with same key)
  definition jsonb not null,                  -- the template shape (per kind)
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (workspace_id, kind, key)
);
create index if not exists idx_custom_tpl on custom_templates(workspace_id, kind, active);

alter table custom_templates enable row level security;

do $$ begin
  create policy ws_member on workspaces for all using (is_member(id));
  create policy mem_self on memberships for all using (user_id = auth.uid());
  create policy ev_member on events for all using (is_member(workspace_id));
  create policy fn_member on funnels for all using (is_member(workspace_id));
  create policy conn_member on connections for all using (is_member(workspace_id));
  create policy ins_member on insights for all using (is_member(workspace_id));
  create policy custom_tpl_member on custom_templates for all using (is_member(workspace_id));
exception when duplicate_object then null; end $$;
