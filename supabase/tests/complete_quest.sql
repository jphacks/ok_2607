-- CI専用の分離DBで実行。完了RPCの原子性・ユーザー分離を検証する。
begin;
truncate public.selection_logs, public.checkpoints, public.quests, public.tasks cascade;
insert into auth.users(id) values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.tasks(id, title, user_id, status) values
  ('20000000-0000-4000-8000-000000000011', '本人', '20000000-0000-4000-8000-000000000001', 'in_quest'),
  ('20000000-0000-4000-8000-000000000012', '他ユーザー', '20000000-0000-4000-8000-000000000002', 'in_quest');
insert into public.quests(id, task_id, user_id) values
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000002');
set local role service_role;
do $$
declare result jsonb;
begin
  result := public.complete_quest('20000000-0000-4000-8000-000000000022', 999, '20000000-0000-4000-8000-000000000001');
  assert result is null, '他ユーザーのクエストを完了できない';
  assert (select status = 'in_progress' and xp_earned = 0 from public.quests where id = '20000000-0000-4000-8000-000000000022'), '失敗時に他ユーザーを更新しない';
  perform public.complete_quest('20000000-0000-4000-8000-000000000022', 70, '20000000-0000-4000-8000-000000000002');
  result := public.complete_quest('20000000-0000-4000-8000-000000000021', 30, '20000000-0000-4000-8000-000000000001');
  assert result->>'total_xp' = '30', '本人のXPだけを集計する';
  assert (select status = 'completed' and xp_earned = 30 from public.quests where id = '20000000-0000-4000-8000-000000000021'), 'クエストを完了する';
  assert (select status = 'done' from public.tasks where id = '20000000-0000-4000-8000-000000000011'), '元タスクを同時に完了する';
  perform public.complete_quest('20000000-0000-4000-8000-000000000022', 70, '20000000-0000-4000-8000-000000000002');
  result := public.complete_quest('20000000-0000-4000-8000-000000000021', 300, '20000000-0000-4000-8000-000000000001');
  assert result is null, '二重完了を拒否する';
  assert (select xp_earned = 30 from public.quests where id = '20000000-0000-4000-8000-000000000021'), '二重付与しない';
end;
$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
do $$
begin
  assert (select count(*) = 1 from public.tasks), 'RLSは本人のタスクだけ返す';
  assert (select count(*) = 1 from public.quests), 'RLSは本人のクエストだけ返す';
  assert not has_function_privilege('authenticated', 'public.complete_quest(uuid,integer,uuid)', 'execute'), '認証ロールはRPCを直接実行できない';
  assert not has_function_privilege('anon', 'public.complete_quest(uuid,integer,uuid)', 'execute'), '匿名ロールはRPCを直接実行できない';
end;
$$;
reset role;
rollback;
