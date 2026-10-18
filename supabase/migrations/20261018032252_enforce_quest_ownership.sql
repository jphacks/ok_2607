-- データ更新は所有者を検証するサーバーAPIに限定する。
-- 本人のクエストでも他人のtask_idを参照する偽造行を直接作成・更新させない。
-- SELECT は既存の本人限定RLSを維持し、OAuth の認証操作には影響しない。
revoke insert, update, delete
  on public.tasks, public.quests, public.selection_logs, public.checkpoints
  from public, anon, authenticated;

-- 認証対応の際に残った、所有者を確認しない旧オーバーロードを削除する。
drop function if exists public.complete_quest(uuid, integer);
-- p_user_id の既定値をなくし、省略できない契約にする。
drop function public.complete_quest(uuid, integer, uuid);

create function public.complete_quest(
  p_quest_id uuid,
  p_xp_earned integer,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quest public.quests;
  v_total_xp bigint;
begin
  if p_user_id is null then
    return null;
  end if;

  -- 既存の不正な関連付けも完了できない。元タスクをロックして所有者を確定する。
  perform tasks.id
  from public.tasks
  join public.quests on quests.task_id = tasks.id
  where quests.id = p_quest_id
    and quests.user_id = p_user_id
    and tasks.user_id = p_user_id
    and quests.status = 'in_progress'
  for update of tasks;

  if not found then
    return null;
  end if;

  update public.quests
  set status = 'completed', completed_at = now(), xp_earned = p_xp_earned
  where id = p_quest_id
    and user_id = p_user_id
    and status = 'in_progress'
    and exists (
      select 1 from public.tasks
      where tasks.id = quests.task_id and tasks.user_id = p_user_id
    )
  returning * into v_quest;

  if not found then
    return null;
  end if;

  update public.tasks
  set status = 'done', updated_at = now()
  where id = v_quest.task_id and user_id = p_user_id;

  select coalesce(sum(xp_earned), 0) into v_total_xp
  from public.quests
  where user_id = p_user_id and status = 'completed';

  return jsonb_build_object('quest', to_jsonb(v_quest), 'total_xp', v_total_xp);
end;
$$;

revoke execute on function public.complete_quest(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.complete_quest(uuid, integer, uuid) to service_role;

-- 認証ユーザーの開始対象に、所有者未設定の旧データを含めない。
-- 旧2引数呼び出しは、所有者未設定データだけを扱う互換経路として残す。
create or replace function public.start_quest(
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
    where (user_id is not distinct from p_user_id)
      and status = 'in_progress'
  ) then
    raise exception using errcode = 'P0001', message = '進行中のクエストがあります';
  end if;

  perform id from public.tasks
  where id = any(p_shown_task_ids)
    and (user_id is not distinct from p_user_id)
  order by id for update;

  if (
    select count(*) from public.tasks
    where id = any(p_shown_task_ids)
      and (user_id is not distinct from p_user_id)
      and status = 'active'
  ) <> cardinality(p_shown_task_ids)
  then
    raise exception using errcode = 'P0001', message = '選択したタスクの状態が変わりました';
  end if;

  select due_at into selected_due_at from public.tasks
  where id = p_selected_task_id and user_id is not distinct from p_user_id;

  update public.tasks
  set status = case when id = p_selected_task_id then 'in_quest' else status end,
      skipped_count = skipped_count + case when id = p_selected_task_id then 0 else 1 end
  where id = any(p_shown_task_ids) and user_id is not distinct from p_user_id;

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

