import {
  TRAITS,
  emptyData,
  parseScore,
  withCell,
  withNote,
  withTrait,
  type LevelKey,
  type PeriodKey,
  type StudentData,
  type TraitLevel,
} from "@/lib/primaryAssessment";

/* ======================= Kiểu dữ liệu ======================= */

export type ImportCell =
  | { kind: "level"; sub: string; value: LevelKey }
  | { kind: "score"; sub: string; value: string }
  | { kind: "trait"; key: string; value: Exclude<TraitLevel, ""> }
  | { kind: "note"; value: string };

export interface ImportRow {
  name: string; // rỗng nếu dữ liệu dán không có cột họ tên
  index: number; // thứ tự dòng, dùng khi không có tên
  cells: ImportCell[];
}

export interface ImportSheet {
  sheet: string;
  period: PeriodKey | null;
  rows: ImportRow[];
  invalid: number; // số ô có giá trị không hợp lệ, bị bỏ qua
}

type Col =
  | { kind: "level" | "score"; sub: string }
  | { kind: "trait"; key: string }
  | { kind: "note" };

/* ======================= Chuẩn hóa ======================= */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const short = (s: string) => s.replace("(Công nghệ)", "(CN)");

const toLevel = (s: string): LevelKey | null => {
  const n = norm(s).replace(/\./g, "");
  if (["t", "htt", "hoan thanh tot"].includes(n)) return "HTT";
  if (["h", "ht", "hoan thanh"].includes(n)) return "HT";
  if (["c", "cht", "chua hoan thanh"].includes(n)) return "CHT";
  if (["m", "mien"].includes(n)) return "MIEN";
  return null;
};

const toTrait = (s: string): Exclude<TraitLevel, ""> | null => {
  const n = norm(s).replace(/\./g, "");
  if (["t", "tot"].includes(n)) return "T";
  if (["d", "dat"].includes(n)) return "D";
  if (["c", "cdg", "can co gang"].includes(n)) return "C";
  return null;
};

const cellFrom = (col: Col, raw: string): ImportCell | null => {
  if (col.kind === "level") {
    const v = toLevel(raw);
    return v ? { kind: "level", sub: col.sub, value: v } : null;
  }
  if (col.kind === "score") {
    const n = parseScore(raw.trim());
    return n === null
      ? null
      : { kind: "score", sub: col.sub, value: String(n) };
  }
  if (col.kind === "trait") {
    const v = toTrait(raw);
    return v ? { kind: "trait", key: col.key, value: v } : null;
  }
  return raw.trim() ? { kind: "note", value: raw.trim() } : null;
};

/* ======================= Đọc file Excel ======================= */

const periodFromSheet = (name: string): PeriodKey | null => {
  const n = norm(name).replace(/[^a-z0-9]/g, "");
  if (n.includes("gk1") || n.includes("giuaky1") || n.includes("giuahk1"))
    return "gk1";
  if (n.includes("ck1") || n.includes("cuoiky1") || n.includes("cuoihk1"))
    return "ck1";
  if (n.includes("gk2") || n.includes("giuaky2") || n.includes("giuahk2"))
    return "gk2";
  if (n === "cn" || n.includes("cuoinam") || n.includes("canam")) return "cn";
  return null;
};

/**
 * Đọc theo tiêu đề cột nên file có thể đổi thứ tự hoặc thiếu môn vẫn nhập được.
 * Dữ liệu bắt đầu từ dòng đầu tiên có STT là số và có họ tên.
 */
export async function parseWorkbook(
  buffer: ArrayBuffer,
  subjects: string[],
): Promise<ImportSheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as never);

  const out: ImportSheet[] = [];

  wb.worksheets.forEach((ws) => {
    const text = (r: number, c: number) => {
      try {
        return String(ws.getCell(r, c).text ?? "").trim();
      } catch {
        return "";
      }
    };
    const maxCol = Math.max(ws.columnCount, 60);

    // 1) Tìm ô tiêu đề "HỌ VÀ TÊN" để biết cột tên và dòng tiêu đề
    let nameCol = 0;
    let headRow = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 40) && !nameCol; r++) {
      for (let c = 1; c <= Math.min(maxCol, 12); c++) {
        const n = norm(text(r, c));
        if (
          n.includes("ho va ten") ||
          n === "ho ten" ||
          n === "ho va ten hoc sinh"
        ) {
          nameCol = c;
          headRow = r;
          break;
        }
      }
    }
    if (!nameCol) return;
    const headName = norm(text(headRow, nameCol));

    // 2) Dòng dữ liệu đầu tiên: ô tên có chữ và khác ô tiêu đề (ô gộp trả về chữ tiêu đề)
    let dataStart = 0;
    for (let r = headRow + 1; r <= Math.min(ws.rowCount, headRow + 20); r++) {
      const v = text(r, nameCol);
      if (v && /\p{L}/u.test(v) && norm(v) !== headName) {
        dataStart = r;
        break;
      }
    }
    if (!dataStart) return;

    // 3) Nhận dạng cột đánh giá từ các dòng tiêu đề
    const colMap: { c: number; col: Col }[] = [];
    for (let c = nameCol + 1; c <= maxCol; c++) {
      const heads: string[] = [];
      for (let r = 1; r < dataStart; r++) heads.push(norm(text(r, c)));
      const last = heads[heads.length - 1] ?? "";

      if (heads.some((h) => h === "ghi chu")) {
        colMap.push({ c, col: { kind: "note" } });
      } else if (last.includes("diem") || last.includes("muc")) {
        const sub = subjects.find((s) =>
          heads.some((h) => h === norm(s) || h === norm(short(s))),
        );
        if (sub)
          colMap.push({
            c,
            col: { kind: last.includes("diem") ? "score" : "level", sub },
          });
      } else {
        const t = TRAITS.find((x) => heads.some((h) => h === norm(x.key)));
        if (t) colMap.push({ c, col: { kind: "trait", key: t.key } });
      }
    }

    // 4) Đọc từng học sinh
    const rows: ImportRow[] = [];
    let invalid = 0;
    for (let r = dataStart; r <= ws.rowCount; r++) {
      const name = text(r, nameCol);
      if (!name || !/\p{L}/u.test(name)) continue;
      const cells: ImportCell[] = [];
      colMap.forEach(({ c, col }) => {
        const raw = text(r, c);
        if (!raw) return;
        const cell = cellFrom(col, raw);
        if (cell) cells.push(cell);
        else invalid++;
      });
      rows.push({ name, index: rows.length, cells });
    }

    out.push({
      sheet: ws.name,
      period: periodFromSheet(ws.name),
      rows,
      invalid,
    });
  });

  return out;
}

/* ======================= Áp dụng vào dữ liệu ======================= */

/** Chỉ ghi đè ô có giá trị trong file; ô trống trong file không xóa dữ liệu đang có. */
export function applyImport(
  data: Record<string, StudentData>,
  students: { id: string; name: string }[],
  period: PeriodKey,
  rows: ImportRow[],
) {
  const byName = new Map<string, string>();
  students.forEach((s) => {
    const k = norm(s.name);
    if (!byName.has(k)) byName.set(k, s.id);
  });

  const updates: Record<string, StudentData> = {};
  const unmatched: string[] = [];
  let matched = 0;

  rows.forEach((row) => {
    if (row.cells.length === 0) return;
    const id = row.name ? byName.get(norm(row.name)) : students[row.index]?.id;
    if (!id) {
      unmatched.push(row.name || `dòng ${row.index + 1}`);
      return;
    }
    let d = updates[id] ?? data[id] ?? emptyData();
    row.cells.forEach((c) => {
      if (c.kind === "level")
        d = withCell(d, c.sub, period, { level: c.value });
      else if (c.kind === "score")
        d = withCell(d, c.sub, period, { score: c.value });
      else if (c.kind === "trait") d = withTrait(d, c.key, period, c.value);
      else d = withNote(d, period, c.value);
    });
    updates[id] = d;
    matched++;
  });

  return { updates, matched, unmatched };
}
