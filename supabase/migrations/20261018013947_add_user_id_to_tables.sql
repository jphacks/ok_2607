-- マルチユーザー認証対応: tasks, quests, selection_logs に user_id を追加
-- 既存の単一ユーザー環境やテストデータを壊さないよう、user_id は NULL 許容とする

-- 1. 列の追加
alter table public.tasks
  add column user_id uuid references auth.users (id) on delete cascade;

alter table public.quests
  add column user_id uuid references auth.users (id) on delete cascade;

alter table public.selection_logs
  add column user_id uuid references auth.users (id) on delete cascade;

-- 2. 検索高速化用インデックスの作成
create index tasks_user_id_idx on public.tasks (user_id);
create index quests_user_id_idx on public.quests (user_id);
create index selection_logs_user_id_idx on public.selection_logs (user_id);

-- 3. RLS ポリシーの追加（authenticated ユーザーは自分のデータのみ操作可能）
create policy "Users can manage own tasks" on public.tasks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own quests" on public.quests
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own selection_logs" on public.selection_logs
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage own checkpoints" on public.checkpoints
  for all to authenticated
  using (
    exists (
      select 1 from public.quests
      where quests.id = checkpoints.quest_id and quests.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quests
      where quests.id = checkpoints.quest_id and quests.user_id = auth.uid()
    )
  );

-- 4. start_quest 関数のマルチユーザー対応（後方互換性のため p_user_id はデフォルト null）
drop function if exists public.start_quest(uuid, uuid[]);

create function public.start_quest(
  p_selected_task_id uuid,
  p_shown_task_ids uuid[],
  p_user_id uuid default null
)
returns public.quests
language plpgsql
set search_path = ''
as $$
declare
  selected_due_at timestamptz;
  created_quest public.quests;
  lock_key bigint;
begin
  if p_selected_task_id is null
    or p_shown_task_ids is null
    or cardinality(p_shown_task_ids) not between 1 and 3
    or exists (select 1 from unnest(p_shown_task_ids) as ids(id) where id is null)
    or (select count(distinct id) from unnest(p_shown_task_ids) as ids(id)) <> cardinality(p_shown_task_ids)
    or not (p_selected_task_id = any(p_shown_task_ids))
  then
    raise exception using errcode = '22023', message = '選択したタスクと提示したタスクが一致しません';
  end if;

  -- ユーザーごとに排他ロックを取得
  if p_user_id is not null then
    lock_key := ('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint;
    perform pg_catalog.pg_advisory_xact_lock(lock_key);
  else
    perform pg_catalog.pg_advisory_xact_lock(171026, 1);
  end if;

  if exists (
    select 1 from public.quests
    where (p_user_id is null or user_id = p_user_id)
      and status = 'in_progress'
  ) then
    raise exception using errcode = 'P0001', message = '進行中のクエストがあります';
  end if;

  perform id from public.tasks
  where id = any(p_shown_task_ids)
    and (p_user_id is null or user_id = p_user_id or user_id is null)
  order by id for update;

  if (
    select count(*) from public.tasks
    where id = any(p_shown_task_ids)
      and (p_user_id is null or user_id = p_user_id or user_id is null)
      and status = 'active'
  ) <> cardinality(p_shown_task_ids)
  then
    raise exception using errcode = 'P0001', message = '選択したタスクの状態が変わりました';
  end if;

  select due_at into selected_due_at from public.tasks where id = p_selected_task_id;

  update public.tasks
  set status = case when id = p_selected_task_id then 'in_quest' else status end,
      weight = case when id = p_selected_task_id then weight + 1 else weight * 0.8 end,
      skipped_count = skipped_count + case when id = p_selected_task_id then 0 else 1 end
  where id = any(p_shown_task_ids);

  insert into public.quests (task_id, is_urgent, user_id)
  values (
    p_selected_task_id,
    coalesce(selected_due_at <= now() + interval '24 hours', false),
    p_user_id
  )
  returning * into created_quest;

  insert into public.selection_logs (shown_task_ids, selected_task_id, quest_id, user_id)
  values (p_shown_task_ids, p_selected_task_id, created_quest.id, p_user_id);

  return created_quest;
end;
$$;

revoke execute on function public.start_quest(uuid, uuid[], uuid) from public, anon, authenticated;
grant execute on function public.start_quest(uuid, uuid[], uuid) to service_role;

-- 5. complete_quest 関数のマルチユーザー対応
create or replace function public.complete_quest(
  p_quest_id uuid,
  p_xp_earned integer,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_quest record;
  v_total_xp bigint;
begin
  -- 1. 進行中のクエストを更新（自ユーザーのもののみ）
  update public.quests
  set
    status = 'completed',
    completed_at = now(),
    xp_earned = p_xp_earned
  where id = p_quest_id
    and (p_user_id is null or user_id = p_user_id or user_id is null)
    and status = 'in_progress'
  returning * into v_quest;

  -- 該当する進行中クエストがなければ null を返却
  if v_quest is null then
    return null;
  end if;

  -- 2. 紐づくタスクを done に更新
  update public.tasks
  set
    status = 'done',
    updated_at = now()
  where id = v_quest.task_id;

  -- 3. 自ユーザーの全完了クエストの合計経験値を集計
  select coalesce(sum(xp_earned), 0) into v_total_xp
  from public.quests
  where (p_user_id is null or user_id = p_user_id or user_id is null)
    and status = 'completed';

  return jsonb_build_object(
    'quest', to_jsonb(v_quest),
    'total_xp', v_total_xp
  );
end;
$$;

revoke execute on function public.complete_quest(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.complete_quest(uuid, integer, uuid) to service_role;
