import { OperationProgress } from "@/components/ui/OperationProgress";

export default function QuestLoading() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-surface text-text">
      <main className="flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-4 font-dotgothic sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <OperationProgress
          title="クエストへ移動中"
          steps={[{ label: "移動先のデータの読み込み", status: "running" }]}
        />
      </main>
    </div>
  );
}
