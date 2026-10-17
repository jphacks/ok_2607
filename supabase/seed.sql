-- ローカル開発用のサンプルデータ（`npm run db:reset` で投入される）
insert into public.tasks (title, due_at) values
  ('レポートの参考文献を3本探す', now() + interval '3 days'),
  ('JPHACKS のスライドを作る', now() + interval '12 hours'),
  ('積読の技術書を1章読む', null),
  ('部屋の机の上を片付ける', null),
  ('英単語アプリを10分やる', null),
  ('ポートフォリオサイトを更新する', now() + interval '14 days');
