-- reject回数のみを更新し、旧重みの加算・減衰を停止する。
create or replace function public.start_quest(p_selected_task_id uuid, p_shown_task_ids uuid[])
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

  -- 単一ユーザーの同時開始を直列化する。
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

revoke execute on function public.start_quest(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.start_quest(uuid, uuid[]) to service_role;
