import { NextResponse } from "next/server";
import {
  buildSemesterPrompt,
  type SemesterCommentInput,
} from "@/lib/semesterCommentPrompt";

export const maxDuration = 30;

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: corsHeaders });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

/** Kiểm tra Firebase ID token qua REST, không cần firebase-admin. */
async function isSignedIn(req: Request): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!token || !key) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: "Thiếu GEMINI_API_KEY" }, 500);

  if (!(await isSignedIn(req))) {
    return json({ error: "Chưa đăng nhập" }, 401);
  }

  try {
    const body = (await req.json()) as SemesterCommentInput;
    if (!body.studentName || (!body.grades?.length && !body.traits?.length)) {
      return json({ error: "Chưa có dữ liệu đánh giá để viết nhận xét" }, 400);
    }

    const { system, user } = buildSemesterPrompt(body);

    let text = "";
    let partialText = "";
    let lastError = "";

    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          }),
        },
      );

      if (!res.ok) {
        lastError = `${model} → ${res.status}: ${(await res.text()).slice(0, 200)}`;
        console.error("Gemini error:", lastError);
        continue;
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const finishReason: string = candidate?.finishReason || "";

      const answer = ((candidate?.content?.parts || []) as GeminiPart[])
        .filter((p) => !p.thought)
        .map((p) => p.text || "")
        .join("")
        .trim();

      if (!answer) {
        lastError = `${model} → rỗng (finishReason=${finishReason})`;
        continue;
      }
      if (finishReason === "STOP") {
        text = answer;
        break;
      }
      partialText = partialText || answer;
      lastError = `${model} → bị cắt (finishReason=${finishReason})`;
    }

    if (!text) text = partialText;
    if (!text) return json({ error: lastError || "AI trả về rỗng" }, 502);

    return json({ comment: text });
  } catch (e) {
    console.error(e);
    return json({ error: "Lỗi máy chủ" }, 500);
  }
}
