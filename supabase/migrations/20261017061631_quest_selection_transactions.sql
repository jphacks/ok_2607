-- 提示回数の加算はDB内で行い、同時リクエストによる更新の消失を防ぐ。
create function public.record_quest_candidates(p_task_ids uuid[])
returns setof public.tasks
language plpgsql
set search_path = ''
as $$
begin
  if p_task_ids is null
    or cardinality(p_task_ids) not between 1 and 3
    or exists (select 1 from unnest(p_task_ids) as ids(id) where id is null)
    or (select count(distinct id) from unnest(p_task_ids) as ids(id)) <> cardinality(p_task_ids)
  then
    raise exception using errcode = '22023', message = '提示するタスクIDが不正です';
  end if;

  -- 開始処理と同じ順序でロックし、デッドロックを避ける。
  perform id from public.tasks where id = any(p_task_ids) order by id for update;
  if (select count(*) from public.tasks where id = any(p_task_ids) and status = 'active')
    <> cardinality(p_task_ids)
  then
    raise exception using errcode = 'P0001', message = '候補の状態が変わりました';
  end if;

  return query
    update public.tasks set shown_count = shown_count + 1
    where id = any(p_task_ids)
    returning *;
end;
$$;

-- タスク更新、クエスト作成、選択ログを1トランザクションにまとめる。
create function public.start_quest(p_selected_task_id uuid, p_shown_task_ids uuid[])
returns public.quests
language plpgsql
set search_path = ''
as $$
declare
  selected_due_at timestamptz;
  created_quest public.quests;
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

  -- 単一ユーザーの同時開始を直列化し、別々のタスクの二重開始も防ぐ。
  perform pg_catalog.pg_advisory_xact_lock(171026, 1);
  if exists (select 1 from public.quests where status = 'in_progress') then
    raise exception using errcode = 'P0001', message = '進行中のクエストがあります';
  end if;

  perform id from public.tasks where id = any(p_shown_task_ids) order by id for update;
  if (select count(*) from public.tasks where id = any(p_shown_task_ids) and status = 'active')
    <> cardinality(p_shown_task_ids)
  then
    raise exception using errcode = 'P0001', message = '選択したタスクの状態が変わりました';
  end if;

  select due_at into selected_due_at from public.tasks where id = p_selected_task_id;

  update public.tasks
  set status = case when id = p_selected_task_id then 'in_quest' else status end,
      weight = case when id = p_selected_task_id then weight + 1 else weight * 0.8 end,
      skipped_count = skipped_count + case when id = p_selected_task_id then 0 else 1 end
  where id = any(p_shown_task_ids);

  insert into public.quests (task_id, is_urgent)
  values (p_selected_task_id, coalesce(selected_due_at <= now() + interval '24 hours', false))
  returning * into created_quest;

  insert into public.selection_logs (shown_task_ids, selected_task_id, quest_id)
  values (p_shown_task_ids, p_selected_task_id, created_quest.id);

  return created_quest;
end;
$$;

-- service_roleを使うサーバー経由に限定する。
revoke execute on function public.record_quest_candidates(uuid[]) from public, anon, authenticated;
revoke execute on function public.start_quest(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.record_quest_candidates(uuid[]) to service_role;
grant execute on function public.start_quest(uuid, uuid[]) to service_role;
