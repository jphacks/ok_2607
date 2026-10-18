type OperationStatus = "pending" | "running" | "complete" | "error";

type OperationProgressProps = {
  title: string;
  steps: readonly { label: string; status: OperationStatus }[];
};

const statusLabels: Record<OperationStatus, string> = {
  pending: "待機中",
  running: "処理中",
  complete: "完了",
  error: "エラー",
};

const statusColors: Record<OperationStatus, string> = {
  pending: "text-muted",
  running: "text-gold-accent",
  complete: "text-success",
  error: "text-danger",
};

export function OperationProgress({ title, steps }: OperationProgressProps) {
  let completed = 0;
  let hasError = false;
  let isRunning = false;
  for (const step of steps) {
    if (step.status === "complete") completed += 1;
    if (step.status === "error") hasError = true;
    if (step.status === "running") isRunning = true;
  }
  const summary = hasError
    ? "エラーがあります"
    : steps.length > 0 && completed === steps.length
      ? "すべての処理が完了しました"
      : isRunning
        ? "処理中"
        : "待機中";
  const countLabel = `完了した処理: ${completed} / ${steps.length} 件`;

  return (
    <section aria-label={title} className="border-2 border-frame bg-panel p-5 text-text">
      <h2 className="text-lg text-gold-accent">{title}</h2>
      <p role="status" aria-atomic="true" className="mt-3 text-sm">
        <span className={hasError ? "text-danger" : undefined}>{summary}</span>
        <span className="block mt-1">{countLabel}</span>
      </p>
      <p className="mt-2 text-xs text-muted">
        件数は完了した処理の数です。残り時間や時間の進み具合を表すものではありません。
      </p>
      {steps.length > 0 && (
        <div
          role="progressbar"
          aria-label={`${title}の完了した処理数`}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={completed}
          aria-valuetext={countLabel}
          className="mt-3 h-2 overflow-hidden bg-field"
        >
          <div
            className={`h-full ${hasError ? "bg-danger" : "bg-success"}`}
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      )}
      <ol aria-label={`${title}の処理手順`} className="mt-4 list-decimal space-y-3 pl-5 text-sm">
        {steps.map((step, index) => (
          <li key={index} aria-current={step.status === "running" ? "step" : undefined}>
            <div className="flex flex-wrap justify-between gap-2">
              <span>{step.label}</span>
              <span className={statusColors[step.status]}>{statusLabels[step.status]}</span>
            </div>
            {step.status === "running" && (
              <div
                role="progressbar"
                aria-label={`${step.label}：処理中`}
                aria-valuetext="処理中（所要時間は未確定）"
                className="mt-2 h-1 animate-pulse bg-gold-accent motion-reduce:animate-none"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
