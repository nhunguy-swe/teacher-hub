export type SemesterCommentInput = {
  tone: "short" | "detailed" | "parent";
  studentName: string;
  semesterName: string;
  periodName: string;
  grade?: number;
  grades: { subject: string; level: string; score: number | null }[];
  traits: { name: string; level: string }[];
  teacherNote?: string;
  yearResult?: string; // chỉ có ở mốc Cuối năm
  activity?: {
    plus: number;
    minus: number;
    notable: { label: string; delta: number }[];
    absent: number;
    late: number;
    excused: number;
  } | null; // null khi chưa có dữ liệu hoạt động
};

const LENGTH: Record<SemesterCommentInput["tone"], string> = {
  short: "2-3 câu (khoảng 40-60 từ), dùng cho sổ liên lạc",
  detailed: "5-7 câu (khoảng 100-140 từ)",
  parent:
    "4-5 câu (khoảng 80-110 từ), giọng gần gũi, trân trọng, viết như gửi phụ huynh",
};

export function buildSemesterPrompt(b: SemesterCommentInput) {
  const strengths = [
    ...b.grades
      .filter((g) => g.level === "Hoàn thành tốt")
      .map((g) => g.subject),
    ...b.grades
      .filter((g) => g.score !== null && g.score >= 9)
      .map((g) => `${g.subject} (${g.score} điểm)`),
  ];
  const needsSupport = [
    ...b.grades
      .filter((g) => g.level === "Chưa hoàn thành")
      .map((g) => g.subject),
    ...b.grades
      .filter((g) => g.score !== null && g.score <= 5)
      .map((g) => `${g.subject} (${g.score} điểm)`),
  ];
  const strongTraits = b.traits
    .filter((t) => t.level === "Tốt")
    .map((t) => t.name);
  const weakTraits = b.traits
    .filter((t) => t.level === "Cần cố gắng")
    .map((t) => t.name);

  const system = `Bạn là giáo viên chủ nhiệm tiểu học, viết nhận xét ${b.periodName} cho học sinh theo Thông tư 27/2020/TT-BGDĐT.

QUY TẮC BẮT BUỘC
1. Dựa vào kết quả học tập và phẩm chất/năng lực được cung cấp. Không bao giờ viết "chưa đủ dữ liệu".
2. Chỉ dùng dữ liệu hoạt động (cộng/trừ điểm, điểm danh) khi có trong phần "Hoạt động"; nếu không có thì không nhắc đến.
3. Không nêu con số sao hay điểm tích lũy. Không dùng cụm "điểm âm", "điểm thấp".
4. Cấu trúc: (a) điểm mạnh, 1-3 môn hoặc phẩm chất nổi bật; (b) điều cần cố gắng, nói nhẹ nhàng và có định hướng; (c) lời động viên kèm một việc cụ thể em có thể làm.
5. Không có điểm yếu thì không bịa, chỉ khuyến khích tiếp tục phát huy.
6. Không bịa sự kiện, hành vi, tên bạn, tên cô. Chỉ dùng dữ liệu được cung cấp.
7. Gọi học sinh bằng tên. ${b.tone === "parent" ? 'Gọi "con" hoặc tên em, viết như gửi phụ huynh.' : 'Xưng "em".'}
8. Nếu có "Kết quả giáo dục cuối năm" thì nêu ở câu kết.
9. Chỉ trả về một đoạn văn thuần, không tiêu đề, không gạch đầu dòng, không markdown.
Độ dài: ${LENGTH[b.tone]}.`;

  const lines = [
    `Học sinh: ${b.studentName}${b.grade ? ` (lớp ${b.grade})` : ""}`,
    `${b.semesterName} · ${b.periodName}`,
    `Điểm mạnh về môn học: ${strengths.join(", ") || "(không nổi bật)"}`,
    `Môn cần hỗ trợ: ${needsSupport.join(", ") || "(không có)"}`,
    `Phẩm chất/năng lực tốt: ${strongTraits.join(", ") || "(không nổi bật)"}`,
    `Phẩm chất/năng lực cần cố gắng: ${weakTraits.join(", ") || "(không có)"}`,
    `Chi tiết môn: ${b.grades.map((g) => `${g.subject}: ${g.level}${g.score !== null ? ` (${g.score}đ)` : ""}`).join("; ") || "(chưa có)"}`,
  ];
  if (b.teacherNote?.trim())
    lines.push(`Ghi chú của giáo viên: ${b.teacherNote.trim()}`);
  if (b.yearResult) lines.push(`Kết quả giáo dục cuối năm: ${b.yearResult}`);
  if (b.activity) {
    const a = b.activity;
    lines.push(
      `Hoạt động: nghỉ ${a.absent} buổi, đi trễ ${a.late} lần, nghỉ có phép ${a.excused} buổi.`,
    );
    if (a.notable.length)
      lines.push(
        `Việc nổi bật: ${a.notable.map((n) => `${n.label} (${n.delta > 0 ? "+" : ""}${n.delta})`).join("; ")}`,
      );
  }
  return { system, user: lines.join("\n") };
}
