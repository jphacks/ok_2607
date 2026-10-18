-- キャッシュで抽選した候補を、ユーザー・期限・緊急優先を確認して記録する。
-- 既存GETが使う1引数版は維持し、新しいPOST専用の2引数版を追加する。
create function public.record_quest_candidates(p_task_ids uuid[], p_user_id uuid)
returns setof public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lock_key bigint;
  earliest_urgent_due_at timestamptz;
begin
  if p_user_id is null
    or p_task_ids is null
    or cardinality(p_task_ids) not between 1 and 3
    or exists (select 1 from unnest(p_task_ids) as ids(id) where id is null)
    or (select count(distinct id) from unnest(p_task_ids) as ids(id)) <> cardinality(p_task_ids)
  then
    raise exception using errcode = '22023', message = '提示するタスクIDまたはユーザーIDが不正です';
  end if;

  -- start_questと同じユーザー単位のロックを先に取り、開始との競合を直列化する。
  lock_key := ('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint;
  perform pg_catalog.pg_advisory_xact_lock(lock_key);

  if exists (
    select 1 from public.quests
    where user_id = p_user_id and status = 'in_progress'
  ) then
    raise exception using errcode = 'P0001', message = '進行中のクエストがあります';
  end if;

  -- 行ロックの順番もstart_questに合わせ、候補全件の検証後にだけ加算する。
  perform id from public.tasks
  where id = any(p_task_ids) and user_id = p_user_id
  order by id for update;

  if (
    select count(*) from public.tasks
    where id = any(p_task_ids)
      and user_id = p_user_id
      and status = 'active'
      and (due_at is null or due_at >= now())
  ) <> cardinality(p_task_ids)
  then
    raise exception using errcode = 'P0001', message = '候補の状態が変わりました';
  end if;

  select min(due_at) into earliest_urgent_due_at
  from public.tasks
  where user_id = p_user_id
    and status = 'active'
    and due_at between now() and now() + interval '24 hours';

  -- recommendTasksと同じ最短期限の1択。同期限は入力順に依存するため、どちらも許可する。
  if earliest_urgent_due_at is not null and (
    cardinality(p_task_ids) <> 1
    or not exists (
      select 1 from public.tasks
      where id = any(p_task_ids) and due_at = earliest_urgent_due_at
    )
  ) then
    raise exception using errcode = 'P0001', message = '緊急クエストの候補が変わりました';
  end if;

  return query
    update public.tasks
    set shown_count = shown_count + 1
    where id = any(p_task_ids) and user_id = p_user_id
    returning *;
end;
$$;

revoke execute on function public.record_quest_candidates(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.record_quest_candidates(uuid[], uuid) to service_role;