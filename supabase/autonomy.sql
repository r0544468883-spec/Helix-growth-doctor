-- HELIX Autonomy Switch — Growth Doctor install.
-- See helix/PRODUCTS/AUTONOMY-SWITCH-SPEC.md. Safe by default: absent row => advisor.
-- RLS uses this product's is_member(ws) helper.

create table if not exists autonomy_settings (
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  feature_key   text not null,
  mode          text not null default 'advisor'
                check (mode in ('advisor','approve','autopilot')),
  risk_ack      boolean not null default false,
  daily_cap     int,
  updated_by    uuid,
  updated_at    timestamptz default now(),
  primary key (workspace_id, feature_key)
);

create table if not exists autonomy_actions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  feature_key   text not null,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','executed','failed')),
  summary       text not null,
  payload       jsonb not null default '{}'::jsonb,
  result        jsonb,
  created_at    timestamptz default now(),
  decided_at    timestamptz,
  executed_at   timestamptz
);
create index if not exists idx_autonomy_actions_ws_status
  on autonomy_actions(workspace_id, status);

alter table autonomy_settings enable row level security;
alter table autonomy_actions  enable row level security;

do $$ begin
  create policy autonomy_settings_member on autonomy_settings for all using (is_member(workspace_id));
  create policy autonomy_actions_member  on autonomy_actions  for all using (is_member(workspace_id));
exception when duplicate_object then null; end $$;
