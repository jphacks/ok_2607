-- 実行: 分離したローカルDBのみで psql -v ON_ERROR_STOP=1 -f supabase/tests/quest_ownership.sql
-- 全マイグレーション適用後に実行する。データとロール設定はロールバックする。
begin;
truncate public.selection_logs, public.checkpoints, public.quests, public.tasks cascade;
insert into auth.users (id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.tasks (id, title, user_id) values
  ('20000000-0000-4000-8000-000000000011', '本人のタスク', '20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000012', '他人のタスク', '20000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000013', '所有者未設定', null),
  ('20000000-0000-4000-8000-000000000014', '本人の開始候補', '20000000-0000-4000-8000-000000000001');
-- 以前のポリシーで作成できた不正な関連付けを含む既存データを再現する。
insert into public.quests (id, task_id, user_id, status, xp_earned) values
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'in_progress', 0),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001', 'in_progress', 0),
  ('20000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000013', null, 'in_progress', 0),
  ('20000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', 'in_progress', 0),
  ('20000000-0000-4000-8000-000000000025', '20000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000001', 'in_progress', 0),
  ('20000000-0000-4000-8000-000000000026', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001', 'completed', 50),
  ('20000000-0000-4000-8000-000000000027', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002', 'completed', 100),
  ('20000000-0000-4000-8000-000000000028', '20000000-0000-4000-8000-000000000013', null, 'completed', 999);

-- 認証ロールでは他人のタスクを読めず、本人名義でも直接DMLできない。
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
do $$
begin
  assert (select count(*) = 2 from public.tasks), 'SELECT は本人データのみ';
  begin
    insert into public.quests (task_id, user_id) values
      ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000001');
    raise exception '他人タスクを参照する本人クエストを直接作成できてはいけません';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quests set task_id = '20000000-0000-4000-8000-000000000012'
    where id = '20000000-0000-4000-8000-000000000021';
    raise exception '本人クエストも直接変更できてはいけません';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- サーバーが本人IDを渡しても、既存の偽造クエストは完了できない。
set local role service_role;
do $$
declare
  v_result jsonb;
begin
  assert public.complete_quest('20000000-0000-4000-8000-000000000022', 25, '20000000-0000-4000-8000-000000000001') is null, '他人タスクの偽造クエストは拒否';
  assert public.complete_quest('20000000-0000-4000-8000-000000000024', 25, '20000000-0000-4000-8000-000000000001') is null, '他人のクエストは拒否';
  assert public.complete_quest('20000000-0000-4000-8000-000000000023', 25, '20000000-0000-4000-8000-000000000001') is null, '所有者未設定クエストは拒否';
  assert public.complete_quest('20000000-0000-4000-8000-000000000025', 25, '20000000-0000-4000-8000-000000000001') is null, '所有者未設定タスクの本人クエストも拒否';
  assert public.complete_quest('20000000-0000-4000-8000-000000000021', 25, null) is null, 'ユーザーID未指定は拒否';
  assert (select count(*) = 5 from public.quests where status = 'in_progress'), '拒否時はクエストを更新しない';
  assert (select count(*) = 4 from public.tasks where status = 'active'), '拒否時はタスクを更新しない';

  v_result := public.complete_quest('20000000-0000-4000-8000-000000000021', 25, '20000000-0000-4000-8000-000000000001');
  assert v_result->>'total_xp' = '75', '合計XPに他人と所有者未設定のクエストを含めない';
  assert v_result->'quest'->>'status' = 'completed', '本人クエストを完了する';
  assert (select status = 'done' from public.tasks where id = '20000000-0000-4000-8000-000000000011'), '本人タスクを完了する';
  assert (select status = 'active' from public.tasks where id = '20000000-0000-4000-8000-000000000012'), '他人タスクを変更しない';
  assert public.complete_quest('20000000-0000-4000-8000-000000000021', 25, '20000000-0000-4000-8000-000000000001') is null, '二重完了を拒否';
end;
$$;

-- 認証ユーザーは旧データを開始できず、NULL呼び出しで他人タスクも開始できない。
delete from public.quests where status = 'in_progress';
do $$
begin
  begin
    perform public.start_quest('20000000-0000-4000-8000-000000000013', array['20000000-0000-4000-8000-000000000013']::uuid[], '20000000-0000-4000-8000-000000000001');
    raise exception '本人IDで所有者未設定タスクを開始できてはいけません';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '選択したタスクの状態が変わりました' then raise; end if;
  end;
  begin
    perform public.start_quest('20000000-0000-4000-8000-000000000012', array['20000000-0000-4000-8000-000000000012']::uuid[], null);
    raise exception 'NULL引数で他人のタスクを開始できてはいけません';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '選択したタスクの状態が変わりました' then raise; end if;
  end;
  assert (select count(*) = 4 from public.quests), '開始失敗ではクエストを増やさない';
  assert (select count(*) = 0 from public.selection_logs), '開始失敗ではログを作らない';
end;
$$;
select public.start_quest('20000000-0000-4000-8000-000000000014', array['20000000-0000-4000-8000-000000000014']::uuid[], '20000000-0000-4000-8000-000000000001');
-- service_role の通常CRUDは維持する。
insert into public.checkpoints (quest_id, title, position)
select id, 'サーバー作成', 0 from public.quests where task_id = '20000000-0000-4000-8000-000000000014';
update public.checkpoints set is_done = true;
delete from public.checkpoints;
reset role;

do $$
declare
  v_table text;
  v_role text;
  v_privilege text;
  v_function text;
begin
  assert to_regprocedure('public.complete_quest(uuid,integer)') is null, '旧2引数関数を残さない';
  assert (select pronargdefaults = 0 and not prosecdef and proconfig = array['search_path=""']
    from pg_proc where oid = 'public.complete_quest(uuid,integer,uuid)'::regprocedure), 'ユーザーID必須、呼出し元権限、検索パス固定';
  foreach v_table in array array['tasks', 'quests', 'selection_logs', 'checkpoints'] loop
    foreach v_privilege in array array['INSERT', 'UPDATE', 'DELETE'] loop
      assert has_table_privilege('service_role', 'public.' || v_table, v_privilege), 'サーバーのDML権限を維持';
      foreach v_role in array array['anon', 'authenticated'] loop
        assert not has_table_privilege(v_role, 'public.' || v_table, v_privilege), 'ブラウザからの直接DMLを禁止';
      end loop;
    end loop;
  end loop;
  foreach v_function in array array[
    'public.complete_quest(uuid,integer,uuid)',
    'public.start_quest(uuid,uuid[],uuid)',
    'public.record_quest_candidates(uuid[])',
    'public.replace_quest_checkpoints(uuid,jsonb)'
  ] loop
    assert has_function_privilege('service_role', v_function, 'execute'), 'サーバーはRPC実行可能';
    foreach v_role in array array['anon', 'authenticated'] loop
      assert not has_function_privilege(v_role, v_function, 'execute'), 'ブラウザからの直接RPC実行を禁止';
    end loop;
  end loop;
end;
$$;
rollback;
