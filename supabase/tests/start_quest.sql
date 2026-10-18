-- 実行: psql -v ON_ERROR_STOP=1 -f supabase/tests/start_quest.sql
-- トランザクションで隔離し、テストデータを残さない。
begin;
truncate public.selection_logs, public.checkpoints, public.quests, public.tasks cascade;

insert into public.tasks (id, title, skipped_count) values
  ('00000000-0000-4000-8000-000000000001', '選択', 2),
  ('00000000-0000-4000-8000-000000000002', '未選択', 3),
  ('00000000-0000-4000-8000-000000000003', '非表示', 4);

select public.start_quest(
  '00000000-0000-4000-8000-000000000001',
  array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']::uuid[]
);

do $$
begin
  assert (select skipped_count = 2 and status = 'in_quest' from public.tasks
    where id = '00000000-0000-4000-8000-000000000001'), '選択タスクのreject回数は変えない';
  assert (select skipped_count = 4 and status = 'active' from public.tasks
    where id = '00000000-0000-4000-8000-000000000002'), '未選択タスクのみreject回数を加算する';
  assert (select skipped_count = 4 and status = 'active' from public.tasks
    where id = '00000000-0000-4000-8000-000000000003'), '非表示タスクは更新しない';
  assert (select count(*) = 1 from public.quests), 'クエストを1件作成する';
  assert (select count(*) = 1 from public.selection_logs
    where selected_task_id = '00000000-0000-4000-8000-000000000001'), '選択を記録する';

  assert (select bool_and(weight = 1) from public.tasks), '選択・未選択による旧重み更新は行わない';
  begin
    perform public.start_quest(
      '00000000-0000-4000-8000-000000000002',
      array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[]
    );
    raise exception '進行中の二重開始を拒否する必要があります';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '進行中のクエストがあります' then raise; end if;
  end;
  assert (select skipped_count = 4 from public.tasks
    where id = '00000000-0000-4000-8000-000000000003'), '開始失敗では加算しない';
  assert (select count(*) = 1 from public.selection_logs), '開始失敗ではログを追加しない';
end;
$$;
rollback;
