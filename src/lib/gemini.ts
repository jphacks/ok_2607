/**
 * サーバー専用の Gemini クライアント。API キーをクライアントに渡さないこと。
 */
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";

let client: GoogleGenAI | undefined;

export function gemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  }
  return client;
}

export function geminiModel(): string {
  return serverEnv().GEMINI_MODEL;
}
