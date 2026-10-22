import { NextResponse } from "next/server";

export const maxDuration = 30;

interface LogInput {
  label: string;
  delta: number;
  date: string;
}

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
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: corsHeaders });

const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "Thiếu GEMINI_API_KEY" }, 500);
  }

  try {
    const body = await req.json();
    const weeklyScore = num(body.weeklyScore);
    const weeklyDelta = num(body.weeklyDelta);
    const stars = num(body.stars);
    const attendance = {
      absent: num(body.attendance?.absent),
      late: num(body.attendance?.late),
      excused: num(body.attendance?.excused),
    };

    const logLines = (Array.isArray(body.logs) ? (body.logs as LogInput[]) : [])
      .slice(0, 30)
      .map(
        (l) =>
          `- ${String(l.date || "").slice(0, 12)}: ${String(l.label || "").slice(0, 100)} (${num(l.delta) > 0 ? "+" : ""}${num(l.delta)})`,
      )
      .join("\n");

    const prompt = `Bạn là trợ lý của giáo viên chủ nhiệm. Hãy viết nhận xét NGẮN GỌN (2-3 câu, tối đa 180 từ) bằng tiếng Việt về một học sinh, dựa HOÀN TOÀN vào dữ liệu cộng/trừ điểm bên dưới.

Yêu cầu:
- Nhận xét chi tiết, khuyến khích cải thiện.
- Không bịa thêm thông tin ngoài dữ liệu. Nếu dữ liệu quá ít, nói ngắn gọn là chưa đủ dữ liệu để nhận xét.
- Không nêu số lần cụ thể của từng lỗi; chỉ nói chung chung (ví dụ "thường xuyên", "đôi khi").
- Không nhắc đến việc học sinh có được thưởng hay không, chỉ nhận xét về thái độ, hành vi, kết quả học tập.
- Dùng đại từ "em" để nói về học sinh, không nhắc tên.
- Luôn viết câu hoàn chỉnh, kết thúc bằng dấu chấm.
- Chỉ trả về đoạn nhận xét, không tiêu đề, không gạch đầu dòng.

Điểm tuần này: ${weeklyScore} đ (${weeklyDelta >= 0 ? "+" : ""}${weeklyDelta} so với mốc gốc)
Sao tích lũy: ${stars}
Điểm danh: vắng ${attendance.absent}, đi muộn ${attendance.late}, có phép ${attendance.excused}

Lịch sử gần đây (mới nhất trước):
${logLines || "(chưa có)"}`;

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
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.7,
            },
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

      console.log(`Gemini ${model} finishReason=${finishReason}`, answer);

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

    if (!text) {
      return json({ error: lastError || "AI trả về rỗng" }, 502);
    }

    return json({ comment: text });
  } catch (e) {
    console.error(e);
    return json({ error: "Lỗi máy chủ" }, 500);
  }
}
