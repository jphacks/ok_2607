import { Type } from "@google/genai";
import { z } from "zod";

export class AiGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiGenerationError";
  }
}

export const CheckpointStepSchema = z.object({
  title: z.string().trim().min(1, "ステップのタイトルは必須です"),
  description: z.string().trim().nullable().optional(),
});
export type CheckpointStep = z.infer<typeof CheckpointStepSchema>;

export const CheckpointMilestoneSchema = z.object({
  title: z.string().trim().min(1, "全体像のタイトルは必須です"),
  description: z.string().trim().nullable().optional(),
  steps: z.array(CheckpointStepSchema).min(1, "各マイルストーンには1つ以上のステップが必要です"),
});
export type CheckpointMilestone = z.infer<typeof CheckpointMilestoneSchema>;

export const CheckpointPlanSchema = z.object({
  milestones: z.array(CheckpointMilestoneSchema).min(1, "1つ以上のマイルストーンが必要です"),
});
export type CheckpointPlan = z.infer<typeof CheckpointPlanSchema>;

const geminiResponseSchema = {
  type: Type.OBJECT,
  description: "タスクを達成するためのチェックポイント計画",
  properties: {
    milestones: {
      type: Type.ARRAY,
      description: "タスク達成までの全体像・大まかなステップ（時系列）",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "全体像のタイトル（例: 情報を集めて整理する）",
          },
          description: {
            type: Type.STRING,
            description: "この全体像の目的や達成基準の簡単な説明",
          },
          steps: {
            type: Type.ARRAY,
            description: "この全体像を達成するための具体的・即座に行動できる細かいアクション",
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "具体的な行動のタイトル（例: Googleで検索キーワードを3つ調べる）",
                },
                description: {
                  type: Type.STRING,
                  description: "行動の詳細やヒント・注意点",
                },
              },
              required: ["title"],
            },
          },
        },
        required: ["title", "steps"],
      },
    },
  },
  required: ["milestones"],
};

export interface GenerateContentClient {
  models: {
    generateContent: (args: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        responseMimeType?: string;
        responseSchema?: unknown;
        temperature?: number;
      };
    }) => Promise<{ text?: string | (() => string) | null }>;
  };
}

export interface GenerateCheckpointOptions {
  client?: GenerateContentClient;
  model?: string;
}

export const CHECKPOINT_SYSTEM_INSTRUCTION = `
あなたはユーザーがタスクを達成できるよう、行動のチェックポイントを作成するアシスタントです。
ユーザーは「タスクが大きすぎて何から手をつければいいか分からない」「計画を立てても手順がずれてしまう」という悩みを抱えています。

以下のルールを厳格に守ってチェックポイントを設計してください:
1. 【2段階の分解】タスク全体を 2〜4 個の「全体像（milestone）」に分け、各全体像の中に 2〜4 個の「具体的で小さな行動ステップ（step）」を作成してください。
2. 【次の一歩を極限まで小さく】各ステップは「今すぐ5分〜15分で着手できる」くらい具体的で心理的ハードルの低い行動にしてください。抽象的な指示（例: 「勉強する」「頑張る」）は禁止です。
3. 【時系列の順序】最初のステップから順番にクリアしていけば、自然とタスクが完了する並び順にしてください。
4. 【日本語】タイトルや説明はわかりやすい自然な日本語で記述してください。
`.trim();

/**
 * タスク名から AI チェックポイント計画を生成する。
 */
export async function generateCheckpointPlan(
  taskTitle: string,
  options: GenerateCheckpointOptions = {},
): Promise<CheckpointPlan> {
  let client = options.client;
  const model = options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!client) {
    const geminiLib = await import("@/lib/gemini");
    client = geminiLib.gemini();
  }

  let responseText: string | null | undefined;
  try {
    const response = await client.models.generateContent({
      model,
      contents: `タスク名: 「${taskTitle}」\nこのタスクを完了するためのチェックポイントを作成してください。`,
      config: {
        systemInstruction: CHECKPOINT_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
        temperature: 0.2,
      },
    });

    responseText = typeof response.text === "function" ? response.text() : response.text;
  } catch (error) {
    throw new AiGenerationError(
      `Gemini API の呼び出しに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }

  if (!responseText) {
    throw new AiGenerationError("Gemini からの応答が空でした");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(responseText);
  } catch (error) {
    throw new AiGenerationError("Gemini からの応答が有効な JSON ではありませんでした", error);
  }

  const validationResult = CheckpointPlanSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    const errorDetails = validationResult.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new AiGenerationError(
      `Gemini の出力がスキーマと一致しませんでした: ${errorDetails}`,
      validationResult.error,
    );
  }

  return validationResult.data;
}
