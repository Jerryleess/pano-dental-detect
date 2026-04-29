/**
 * API 服務模組
 * 負責與 FastAPI 後端通訊，並使用 Zod 進行 Runtime 回傳格式驗證
 */

import { z } from "zod";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// ── Zod Schemas ──

export const PredictionResultSchema = z.object({
  class_name: z.string(),
  pathology: z.string().optional(),
  confidence: z.number(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

export const PredictionResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    filename: z.string(),
    image_size: z.tuple([z.number(), z.number()]),
    pathologies: z.array(z.string()),
    predictions: z.array(PredictionResultSchema),
  }),
});

export const PathologyInfoSchema = z.object({
  name: z.string(),
  label: z.string(),
  color: z.string(),
  loaded: z.boolean(),
});

export const HealthResponseSchema = z.object({
  status: z.string(),
  model_loaded: z.boolean(),
});

export const ReportResponseSchema = z.object({
  status: z.string(),
  report: z.string(),
});

// ── 從 Zod Schema 推導 TypeScript 類型 ──

export type PredictionResult = z.infer<typeof PredictionResultSchema>;
export type PredictionResponse = z.infer<typeof PredictionResponseSchema>;
export type PathologyInfo = z.infer<typeof PathologyInfoSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ReportResponse = z.infer<typeof ReportResponseSchema>;

// ── API Functions ──

/**
 * 上傳 X 光圖片並取得 AI 偵測結果
 * @param file - 圖片檔案
 * @param pathologies - 要偵測的病狀列表
 */
export async function predictImage(
  file: File,
  pathologies: string[] = ["retain"]
): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  pathologies.forEach((p) => formData.append("pathologies", p));

  const response = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API 錯誤: ${response.status}`);
  }

  const json: unknown = await response.json();
  return PredictionResponseSchema.parse(json);
}

/**
 * 取得所有可用的病狀偵測類型
 */
export async function getPathologies(): Promise<PathologyInfo[]> {
  const response = await fetch(`${API_BASE}/api/pathologies`);
  if (!response.ok) {
    throw new Error("無法取得病狀列表");
  }
  const data: unknown = await response.json();
  const parsed = z.object({ data: z.array(PathologyInfoSchema) }).parse(data);
  return parsed.data;
}

/**
 * 健康檢查
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/api/health`);
  const json: unknown = await response.json();
  return HealthResponseSchema.parse(json);
}

/**
 * 要求 Ollama 生成報告 (Streaming)
 */
export async function generateReport(
  predictions: PredictionResult[],
  pathologies: string[],
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ predictions, pathologies }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API 錯誤: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("API 沒有回傳 ReadableStream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);
  }
}

