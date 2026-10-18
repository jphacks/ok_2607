-- 認証対応の3引数RPCから、削除済みweight列への参照を除く。
-- 旧2引数RPCを削除し、省略時はp_user_idの既定値nullで同じ処理を使う。
drop function if exists public.start_quest(uuid, uuid[]);

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

