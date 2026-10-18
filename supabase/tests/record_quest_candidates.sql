-- 実行: psql -v ON_ERROR_STOP=1 -f supabase/tests/record_quest_candidates.sql
-- ローカルDB専用。全体をロールバックし、既存データとテストデータを残さない。
begin;
truncate public.selection_logs, public.checkpoints, public.quests, public.tasks cascade;
insert into auth.users (id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.tasks (id, title, user_id, shown_count, skipped_count, due_at, status) values
  ('00000000-0000-4000-8000-000000000001', '通常1', '20000000-0000-4000-8000-000000000001', 2, 5, null, 'active'),
  ('00000000-0000-4000-8000-000000000002', '通常2', '20000000-0000-4000-8000-000000000001', 3, 6, null, 'active'),
  ('00000000-0000-4000-8000-000000000003', '通常3', '20000000-0000-4000-8000-000000000001', 4, 7, now() + interval '25 hours', 'active'),
  ('00000000-0000-4000-8000-000000000004', '他ユーザーの緊急', '20000000-0000-4000-8000-000000000002', 8, 0, now() + interval '1 hour', 'active'),
  ('00000000-0000-4000-8000-000000000005', '期限切れ', '20000000-0000-4000-8000-000000000001', 8, 0, now() - interval '1 second', 'active'),
  ('00000000-0000-4000-8000-000000000006', '手放した', '20000000-0000-4000-8000-000000000001', 8, 0, null, 'discarded'),
  ('00000000-0000-4000-8000-000000000007', '所有者なし', null, 8, 0, null, 'active'),
  ('00000000-0000-4000-8000-000000000008', '完了済み', '20000000-0000-4000-8000-000000000001', 8, 0, null, 'done'),
  ('00000000-0000-4000-8000-000000000009', '取り組み中', '20000000-0000-4000-8000-000000000001', 8, 0, null, 'in_quest');

-- APIと同じservice_roleから呼び、返却値で加算後の状態を受け取る。
set local role service_role;
do $$
declare
  recorded public.tasks;
  recorded_count integer := 0;
begin
  for recorded in select * from public.record_quest_candidates(
    array['00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']::uuid[],
    '20000000-0000-4000-8000-000000000001'
  ) loop
    recorded_count := recorded_count + 1;
    assert recorded.user_id = '20000000-0000-4000-8000-000000000001'::uuid, '返却するのは自分のタスクだけ';
    assert recorded.status = 'active', '提示だけではタスクを開始しない';
    case recorded.id
      when '00000000-0000-4000-8000-000000000001'::uuid then
        assert recorded.shown_count = 3 and recorded.skipped_count = 5, '通常1は提示回数だけ1増える';
      when '00000000-0000-4000-8000-000000000002'::uuid then
        assert recorded.shown_count = 4 and recorded.skipped_count = 6, '通常2は提示回数だけ1増える';
      when '00000000-0000-4000-8000-000000000003'::uuid then
        assert recorded.shown_count = 5 and recorded.skipped_count = 7, '通常3は提示回数だけ1増える';
      else raise exception '候補外のタスクが返却されました';
    end case;
  end loop;
  assert recorded_count = 3, '指定した3件を返す（順序は契約に含めない）';
  assert (select shown_count = 8 from public.tasks where id = '00000000-0000-4000-8000-000000000004'), '他ユーザーの緊急タスクは通常候補を妨げず、更新もしない';
  assert (select count(*) = 0 from public.quests), '提示だけではクエストを作成しない';
  assert (select count(*) = 0 from public.selection_logs), '提示だけでは選択ログを作成しない';
end;
$$;

-- 成功した呼出しも呼出し元のトランザクションと一緒に取り消せる。
savepoint before_record;
select * from public.record_quest_candidates(
  array['00000000-0000-4000-8000-000000000001']::uuid[],
  '20000000-0000-4000-8000-000000000001'
);
do $$
begin
  assert (select shown_count = 4 from public.tasks where id = '00000000-0000-4000-8000-000000000001'), '再提示はさらに1加算する';
end;
$$;
rollback to savepoint before_record;
do $$
begin
  assert (select shown_count = 3 from public.tasks where id = '00000000-0000-4000-8000-000000000001'), '呼出し元のロールバックで提示回数も戻る';
end;
$$;

-- 不正入力は22023。どのケースも提示回数を変更しない。
do $$
declare
  invalid_ids uuid[];
begin
  foreach invalid_ids slice 1 in array array[
    array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001']::uuid[],
    array['00000000-0000-4000-8000-000000000001', null]::uuid[]
  ] loop
    begin
      perform public.record_quest_candidates(invalid_ids, '20000000-0000-4000-8000-000000000001');
      raise exception '重複またはnull要素を拒否する必要があります';
    exception when sqlstate '22023' then null;
    end;
  end loop;
  begin
    perform public.record_quest_candidates(null::uuid[], '20000000-0000-4000-8000-000000000001');
    raise exception 'null配列を拒否する必要があります';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_quest_candidates(array[]::uuid[], '20000000-0000-4000-8000-000000000001');
    raise exception '空配列を拒否する必要があります';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_quest_candidates(
      array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004']::uuid[],
      '20000000-0000-4000-8000-000000000001'
    );
    raise exception '4件以上を拒否する必要があります';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_quest_candidates(array['00000000-0000-4000-8000-000000000001']::uuid[], null::uuid);
    raise exception 'ユーザー未指定を拒否する必要があります';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

-- 有効な候補に1件でも他ユーザー・所有者なし・期限切れ・非active・不存在を混ぜると全体が失敗する。
do $$
declare
  invalid_id uuid;
begin
  foreach invalid_id in array array[
    '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000099'
  ]::uuid[] loop
    begin
      perform public.record_quest_candidates(
        array['00000000-0000-4000-8000-000000000001'::uuid, invalid_id],
        '20000000-0000-4000-8000-000000000001'
      );
      raise exception '不適格な候補を拒否する必要があります';
    exception when sqlstate 'P0001' then
      if sqlerrm <> '候補の状態が変わりました' then raise; end if;
    end;
  end loop;
  assert (select shown_count = 3 from public.tasks where id = '00000000-0000-4000-8000-000000000001'), '失敗では同時指定した有効タスクも更新しない';
  assert (select bool_and(shown_count = 8) from public.tasks where id in (
    '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009'
  )), '拒否された候補は一切加算しない';
end;
$$;

-- 他ユーザーの進行中クエストは妨げず、自分が開始した後の再提示は拒否する。
select public.start_quest(
  '00000000-0000-4000-8000-000000000004',
  array['00000000-0000-4000-8000-000000000004']::uuid[],
  '20000000-0000-4000-8000-000000000002'
);
select * from public.record_quest_candidates(
  array['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']::uuid[],
  '20000000-0000-4000-8000-000000000001'
);
select public.start_quest(
  '00000000-0000-4000-8000-000000000003',
  array['00000000-0000-4000-8000-000000000003']::uuid[],
  '20000000-0000-4000-8000-000000000001'
);
do $$
begin
  begin
    perform public.record_quest_candidates(
      array['00000000-0000-4000-8000-000000000001']::uuid[],
      '20000000-0000-4000-8000-000000000001'
    );
    raise exception '進行中のクエストがある場合は再提示できません';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '進行中のクエストがあります' then raise; end if;
  end;
  assert (select shown_count = 4 from public.tasks where id = '00000000-0000-4000-8000-000000000001'), '進行中の拒否でも提示回数は変えない';
  assert (select shown_count = 5 from public.tasks where id = '00000000-0000-4000-8000-000000000002'), '他ユーザーの進行中クエストがあっても2件提示は成功する';
  assert (select count(*) = 2 from public.quests), '記録失敗でクエストは増減しない';
  assert (select count(*) = 2 from public.selection_logs), '記録失敗で選択ログは増減しない';
end;
$$;
update public.quests set status = 'completed';

-- 期限切れ・非activeは緊急判定からも除外する。最短期限に同率があればどちらの1択も有効。
insert into public.tasks (id, title, user_id, due_at) values
  ('00000000-0000-4000-8000-000000000011', '緊急最短', '20000000-0000-4000-8000-000000000001', now() + interval '2 hours'),
  ('00000000-0000-4000-8000-000000000012', '緊急同率', '20000000-0000-4000-8000-000000000001', now() + interval '2 hours'),
  ('00000000-0000-4000-8000-000000000013', '緊急だが後', '20000000-0000-4000-8000-000000000001', now() + interval '3 hours');
update public.tasks set due_at = now() + interval '1 hour'
where id = '00000000-0000-4000-8000-000000000006';
do $$
declare
  invalid_ids uuid[];
begin
  for invalid_ids in
    select ids from (values
      (array['00000000-0000-4000-8000-000000000001']::uuid[]),
      (array['00000000-0000-4000-8000-000000000013']::uuid[]),
      (array['00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001']::uuid[]),
      (array['00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012']::uuid[])
    ) as cases(ids)
  loop
    begin
      perform public.record_quest_candidates(invalid_ids, '20000000-0000-4000-8000-000000000001');
      raise exception '緊急時は最短期限の1択だけを記録できます';
    exception when sqlstate 'P0001' then
      if sqlerrm <> '緊急クエストの候補が変わりました' then raise; end if;
    end;
  end loop;
  assert (select shown_count = 4 from public.tasks where id = '00000000-0000-4000-8000-000000000001'), '緊急判定で失敗した通常候補は加算しない';
  assert (select bool_and(shown_count = 0) from public.tasks where id in (
    '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013'
  )), '緊急判定の失敗は全件ロールバックする';
  assert (select shown_count = 1 from public.record_quest_candidates(
    array['00000000-0000-4000-8000-000000000011']::uuid[], '20000000-0000-4000-8000-000000000001'
  )), '最短の緊急タスクを加算して返す';
  assert (select shown_count = 1 from public.record_quest_candidates(
    array['00000000-0000-4000-8000-000000000012']::uuid[], '20000000-0000-4000-8000-000000000001'
  )), '同率の別タスクも推薦の入力順によらず受け付ける';
end;
$$;

-- 推薦と同じく「今」と「24時間後」の境界を含む。
update public.tasks set due_at = now() + interval '25 hours'
where id in ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000013');
update public.tasks set due_at = now() + interval '24 hours'
where id = '00000000-0000-4000-8000-000000000011';
do $$
begin
  begin
    perform public.record_quest_candidates(
      array['00000000-0000-4000-8000-000000000001']::uuid[], '20000000-0000-4000-8000-000000000001'
    );
    raise exception '24時間後ちょうども緊急として優先する必要があります';
  exception when sqlstate 'P0001' then
    if sqlerrm <> '緊急クエストの候補が変わりました' then raise; end if;
  end;
  assert (select shown_count = 2 from public.record_quest_candidates(
    array['00000000-0000-4000-8000-000000000011']::uuid[], '20000000-0000-4000-8000-000000000001'
  )), '24時間後ちょうどの緊急候補を受け付ける';
end;
$$;
update public.tasks set due_at = now() where id = '00000000-0000-4000-8000-000000000011';
do $$
begin
  assert (select shown_count = 3 from public.record_quest_candidates(
    array['00000000-0000-4000-8000-000000000011']::uuid[], '20000000-0000-4000-8000-000000000001'
  )), '期限が今ちょうどなら期限切れにせず最優先する';
end;
$$;

-- ACLは権限一覧だけでなく、ブラウザー側のロールから実際に呼んで拒否を確認する。
reset role;
set local role anon;
do $$
begin
  begin
    perform public.record_quest_candidates(array['00000000-0000-4000-8000-000000000011']::uuid[], '20000000-0000-4000-8000-000000000001');
    raise exception '匿名ロールはRPCを実行できません';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform public.record_quest_candidates(array['00000000-0000-4000-8000-000000000011']::uuid[], '20000000-0000-4000-8000-000000000001');
    raise exception '認証ロールからも直接RPCを実行できません';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
do $$
begin
  assert has_function_privilege('service_role', 'public.record_quest_candidates(uuid[],uuid)', 'execute'), 'サーバーロールだけが新RPCを実行できる';
  assert not has_function_privilege('anon', 'public.record_quest_candidates(uuid[],uuid)', 'execute'), '匿名ロールに実行権限を与えない';
  assert not has_function_privilege('authenticated', 'public.record_quest_candidates(uuid[],uuid)', 'execute'), '認証ロールに実行権限を与えない';
  assert (select not prosecdef and proconfig = array['search_path=""'] from pg_proc
    where oid = 'public.record_quest_candidates(uuid[],uuid)'::regprocedure), '呼出し元権限と空の検索パスを使う';
  assert to_regprocedure('public.record_quest_candidates(uuid[])') is not null, '既存GET用の1引数RPCを維持する';
  assert has_function_privilege('service_role', 'public.record_quest_candidates(uuid[])', 'execute'), '既存GETの実行権限も維持する';
end;
$$;

rollback;
