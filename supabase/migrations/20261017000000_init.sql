-- 初期スキーマ
-- ログイン機能は MVP では作らないため、単一ユーザー前提で user_id は持たない。
-- DB へのアクセスはサーバー（Route Handlers）から service_role キーでのみ行う。
-- RLS を有効化しポリシーを作らないことで、anon キーからの直接アクセスは拒否される。

create extension if not exists pgcrypto;

-- タスク（ユーザーが書き出した「やりたいこと・やるべきこと」）
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  due_at timestamptz,
  -- レコメンド用の重み。選ばれると増え、選ばれないと減る
  weight double precision not null default 1.0 check (weight >= 0),
  -- active: 候補に出る / in_quest: クエスト進行中 / done: 完了 / discarded: 手放した
  status text not null default 'active'
    check (status in ('active', 'in_quest', 'done', 'discarded')),
  shown_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- クエスト（3択から選んだタスクに取り組む1回分）
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  is_urgent boolean not null default false,
  xp_earned integer not null default 0 check (xp_earned >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- 3択の提示と選択の記録（何を選び、何を選ばなかったか）
create table public.selection_logs (
  id uuid primary key default gen_random_uuid(),
  shown_task_ids uuid[] not null,
  selected_task_id uuid references public.tasks (id) on delete set null,
  quest_id uuid references public.quests (id) on delete set null,
  created_at timestamptz not null default now()
);

-- チェックポイント（タスク → 全体像のチェックポイント → 細かいチェックポイント）
create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  quest_id uuid not null references public.quests (id) on delete cascade,
  -- null なら全体像のチェックポイント、値があればその子（細かいチェックポイント）
  parent_id uuid references public.checkpoints (id) on delete cascade,
  title text not null,
  description text,
  position integer not null,
  is_done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_status_idx on public.tasks (status);
create index quests_task_id_idx on public.quests (task_id);
create index checkpoints_quest_id_idx on public.checkpoints (quest_id, parent_id, position);

-- updated_at の自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.quests enable row level security;
alter table public.selection_logs enable row level security;
alter table public.checkpoints enable row level security;
