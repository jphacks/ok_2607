# DB回帰テストのCI

`.github/workflows/ci.yml` の `database` ジョブは、使い捨てのPostgreSQL 17サービスで全マイグレーションを適用し、`supabase/tests/*.sql` を実行する。SQLのエラー・assert失敗は `ON_ERROR_STOP=1` でCI失敗にする。既存の必須ジョブ `check` は `database` の完了後に `always()` で実行し、先頭ステップでDB結果が `success` 以外なら明示的に失敗する。依存失敗で必須ジョブがスキップされることを避け、DB失敗時にマージ条件を満たさないようにする。

- `start_quest.sql`: reject回数、開始時のトランザクション、同時進行制限、ユーザー分離、RPC実行権限。
- `complete_quest.sql`: 完了とタスク更新、XP付与、二重完了拒否、他ユーザーの完了拒否、RLSとRPC実行権限。
- `quest_ownership.sql`: 所有者の境界、直接DMLの禁止、所有者保護RPCの権限。
- `record_quest_candidates.sql`: キャッシュ候補記録の本人限定、状態・期限・緊急候補の検証。
- `ci/bootstrap.sql`: 空DB専用のロール・`auth.users`・`auth.uid()` の最小限の代替。SupabaseのOAuth・セッション・API認証は再現しない。これらの検証は別途必要。

CI専用DBは空の状態から毎回作り、共有DBや本番DBには接続しない。bootstrapはマイグレーションに含めない。テストのtruncateはトランザクション内で行いrollbackするが、既存データのあるDBでは実行しない。

ローカルで同等の分離DBを用意した場合は、CIと同じ順でbootstrap・全マイグレーション・テストをpsqlで実行する。認証なしの旧RPC互換性も既存テストで扱うが、未認証APIへのアクセス可否は既存Issue #20の対象。
