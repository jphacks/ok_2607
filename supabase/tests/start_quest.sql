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

-- ここからは認証ユーザーの3引数RPCを検証する。
truncate public.selection_logs, public.checkpoints, public.quests, public.tasks cascade;
insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.tasks (id, title, skipped_count, user_id) values
  ('00000000-0000-4000-8000-000000000001', '認証選択', 2, '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', '認証未選択', 3, '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', '認証非表示', 4, '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', '別ユーザー', 5, '10000000-0000-4000-8000-000000000002');

select public.start_quest(
  '00000000-0000-4000-8000-000000000001',
  array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']::uuid[],
  '10000000-0000-4000-8000-000000000001'
);

do $$
begin
  assert (select skipped_count = 2 and status = 'in_quest' from public.tasks
    where id = '00000000-0000-4000-8000-000000000001'), '認証選択タスクのreject回数は変えない';
  assert (select skipped_count = 4 and status = 'active' from public.tasks
    where id = '00000000-0000-4000-8000-000000000002'), '認証未選択タスクのみreject回数を加算する';
  assert (select skipped_count = 4 and status = 'active' from public.tasks
    where id = '00000000-0000-4000-8000-000000000003'), '認証非表示タスクは更新しない';
  assert (select count(*) = 1 from public.quests
    where user_id = '10000000-0000-4000-8000-000000000001'), 'クエストにユーザーを保存する';
  assert (select count(*) = 1 from public.selection_logs
    where user_id = '10000000-0000-4000-8000-000000000001'), 'ログにユーザーを保存する';
  begin
    perform public.start_quest(
      '00000000-0000-4000-8000-000000000002',
      array['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']::uuid[],
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception '認証ユーザーの二重開始を拒否する必要があります';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '進行中のクエストがあります' then raise; end if;
  end;
  assert (select skipped_count = 4 from public.tasks
    where id = '00000000-0000-4000-8000-000000000003'), '認証開始失敗では加算しない';
  assert (select count(*) = 1 from public.selection_logs), '認証開始失敗ではログを追加しない';
end;
$$;

-- 他ユーザーの進行中クエストとは排他せず、自分のクエストを開始できる。
select public.start_quest(
  '00000000-0000-4000-8000-000000000004',
  array['00000000-0000-4000-8000-000000000004']::uuid[],
  '10000000-0000-4000-8000-000000000002'
);

truncate public.selection_logs, public.checkpoints, public.quests cascade;
update public.tasks set status = 'active';
update public.tasks set status = 'discarded'
where id = '00000000-0000-4000-8000-000000000003';

do $$
begin
  -- 配列の重複は入力エラー。処理途中の更新を残さない。
  begin
    perform public.start_quest(
      '00000000-0000-4000-8000-000000000001',
      array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001']::uuid[],
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception '重複入力を拒否する必要があります';
  exception when sqlstate '22023' then null;
  end;
  -- 提示中の状態変更、および他ユーザーのタスクは開始できない。
  begin
    perform public.start_quest(
      '00000000-0000-4000-8000-000000000001',
      array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003']::uuid[],
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception '無効な状態のタスクを拒否する必要があります';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '選択したタスクの状態が変わりました' then raise; end if;
  end;
  begin
    perform public.start_quest(
      '00000000-0000-4000-8000-000000000001',
      array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004']::uuid[],
      '10000000-0000-4000-8000-000000000001'
    );
    raise exception '他ユーザーのタスクを拒否する必要があります';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '選択したタスクの状態が変わりました' then raise; end if;
  end;
  assert (select skipped_count = 2 and status = 'active' from public.tasks
    where id = '00000000-0000-4000-8000-000000000001'), '失敗時に選択タスクを変更しない';
  assert (select skipped_count = 4 and status = 'discarded' from public.tasks
    where id = '00000000-0000-4000-8000-000000000003'), '失敗時に未選択タスクを変更しない';
  assert (select count(*) = 0 from public.quests), '失敗時にクエストを作成しない';
  assert (select count(*) = 0 from public.selection_logs), '失敗時にログを作成しない';
  assert to_regprocedure('public.start_quest(uuid,uuid[])') is null, '旧オーバーロードを残さない';
  assert has_function_privilege('service_role', 'public.start_quest(uuid,uuid[],uuid)', 'execute'), 'サーバーは実行可能';
  assert not has_function_privilege('anon', 'public.start_quest(uuid,uuid[],uuid)', 'execute'), '匿名ロールは実行不可';
  assert not has_function_privilege('authenticated', 'public.start_quest(uuid,uuid[],uuid)', 'execute'), '認証ロールから直接実行不可';
  assert (select not prosecdef and proconfig = array['search_path=""'] from pg_proc
    where oid = 'public.start_quest(uuid,uuid[],uuid)'::regprocedure), 'RPCは呼出し元権限と空の検索パスを使う';
end;
$$;
rollback;
