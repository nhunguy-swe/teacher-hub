import {
  TRAITS,
  emptyData,
  parseScore,
  withCell,
  withNote,
  withTrait,
  withYearEval,
  type LevelKey,
  type PeriodKey,
  type StudentData,
  type TraitLevel,
  type YearResultKey,
} from "@/lib/primaryAssessment";

/* ======================= Kiểu dữ liệu ======================= */

export type ImportCell =
  | { kind: "level"; sub: string; value: LevelKey }
  | { kind: "score"; sub: string; value: string }
  | { kind: "trait"; key: string; value: Exclude<TraitLevel, ""> }
  | { kind: "note"; value: string }
  | { kind: "yearResult"; value: Exclude<YearResultKey, ""> }
  | { kind: "rewardEnd" }
  | { kind: "rewardExtra" }
  | { kind: "retained" };

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
  | { kind: "note" | "rewardEnd" | "rewardExtra" | "retained" }
  | { kind: "yearResult"; value: Exclude<YearResultKey, ""> };

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

/** Mẫu của trường viết tắt ở tiêu đề: "TH và CN (Tin học)", "HĐTN", "GDTC" */
const expand = (h: string) =>
  h
    .replace(/^th va cn\b/, "tin hoc va cong nghe")
    .replace(/^hdtn\b/, "hoat dong trai nghiem")
    .replace(/^gdtc\b/, "giao duc the chat");

const TRAIT_ALIAS: Record<string, string> = {
  "gqvd va sang tao": "Giải quyết vấn đề và sáng tạo",
};

const toLevel = (s: string): LevelKey | null => {
  const n = norm(s).replace(/\./g, "");
  if (["t", "htt", "hoan thanh tot"].includes(n)) return "HTT";
  if (["h", "ht", "hoan thanh"].includes(n)) return "HT";
  if (["c", "cht", "chua hoan thanh"].includes(n)) return "CHT";
  if (["m", "mien"].includes(n)) return "MIEN";
  return null;
};

/** Mẫu trường dùng T / H / C; vẫn nhận "Đ" / "Đạt" của file cũ */
const toTrait = (s: string): Exclude<TraitLevel, ""> | null => {
  const n = norm(s).replace(/\./g, "");
  if (["t", "tot"].includes(n)) return "T";
  if (["h", "d", "dat", "hoan thanh"].includes(n)) return "D";
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
  if (col.kind === "note")
    return raw.trim() ? { kind: "note", value: raw.trim() } : null;
  // Các cột đánh dấu "x" của sheet Cuối năm: có ký tự là tính
  if (!raw.trim()) return null;
  if (col.kind === "yearResult")
    return { kind: "yearResult", value: col.value };
  return { kind: col.kind };
};

/* ======================= Đọc file Excel ======================= */

/**
 * Nhận sheet "GIỮA HKI", "CUỐI HKI", "GIỮA HKII", "CUỐI NĂM HỌC" của mẫu trường,
 * và cả tên ngắn GK1/CK1/GK2/CN.
 */
export const periodFromSheet = (name: string): PeriodKey | null => {
  const tokens = norm(name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const n = tokens.join("");
  if (n === "cn" || n.includes("cuoinam") || n.includes("canam")) return "cn";

  const mid = n.startsWith("giua") || n.includes("gk");
  const end = n.startsWith("cuoi") || n.includes("ck");
  if (!mid && !end) return null;

  const last = tokens[tokens.length - 1] ?? "";
  const sem = /(ii|2)$/.test(last) ? 2 : /(i|1)$/.test(last) ? 1 : 0;
  if (!sem) return null;
  return mid ? (sem === 1 ? "gk1" : "gk2") : sem === 1 ? "ck1" : null;
};

/** File .xls (Excel 97-2003) như mẫu 4A4: đổi sang .xlsx trước khi đọc bằng exceljs. */
export async function toXlsxBuffer(file: File): Promise<ArrayBuffer> {
  const buf = await file.arrayBuffer();
  if (!/\.xls$/i.test(file.name)) return buf;
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/**
 * Đọc theo tiêu đề cột nên file có thể đổi thứ tự hoặc thiếu môn vẫn nhập được.
 * Tiêu đề nhiều dòng (3 dòng trong mẫu): mỗi cột được nhận dạng bằng cả cụm
 * "nhóm > môn > Mức đạt được / Điểm KTĐK", nên "Nghệ thuật > Âm nhạc",
 * "Tin học và công nghệ > Tin học" hay "TH và CN (Tin học)" đều khớp.
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

    // 3) Nhận dạng cột từ tất cả các dòng tiêu đề (ô gộp trả về chữ của ô gốc)
    const colMap: { c: number; col: Col }[] = [];
    for (let c = nameCol + 1; c <= maxCol; c++) {
      const heads: string[] = [];
      for (let r = 1; r < dataStart; r++) {
        const h = expand(norm(text(r, c)));
        if (h) heads.push(h);
      }
      if (heads.length === 0) continue;
      const has = (s: string) => heads.includes(s);
      const last = heads[heads.length - 1];

      // Tên ứng viên: từng tiêu đề và cặp liền kề "nhóm (môn)"
      const names = heads.filter(
        (h) =>
          !h.startsWith("muc dat") &&
          !h.startsWith("diem") &&
          !h.startsWith("bang tong hop") &&
          h !== "mon hoc va hoat dong giao duc" &&
          h !== "pham chat chu yeu" &&
          h !== "nang luc cot loi",
      );
      const cands = new Set(names);
      for (let i = 0; i < names.length - 1; i++)
        cands.add(`${names[i]} (${names[i + 1]})`);

      if (has("ghi chu")) {
        colMap.push({ c, col: { kind: "note" } });
      } else if (has("danh gia kqgd")) {
        const value =
          last === "hoan thanh xuat sac"
            ? "xuat_sac"
            : last === "hoan thanh tot"
              ? "tot"
              : last === "hoan thanh"
                ? "hoan_thanh"
                : last === "chua hoan thanh"
                  ? "chua"
                  : null;
        if (value) colMap.push({ c, col: { kind: "yearResult", value } });
      } else if (has("khen thuong")) {
        if (last === "cuoi nam") colMap.push({ c, col: { kind: "rewardEnd" } });
        else if (last === "dot xuat")
          colMap.push({ c, col: { kind: "rewardExtra" } });
      } else if (has("chua duoc len lop")) {
        colMap.push({ c, col: { kind: "retained" } });
      } else if (has("mon hoc va hoat dong giao duc")) {
        const sub = subjects.find(
          (s) => cands.has(norm(s)) || cands.has(norm(short(s))),
        );
        if (sub) {
          // Mẫu giữa kì không có chữ "Mức đạt được" ở môn không có điểm: mặc định là mức
          const isScore = heads.some((h) => h.startsWith("diem"));
          colMap.push({ c, col: { kind: isScore ? "score" : "level", sub } });
        }
      } else if (has("pham chat chu yeu") || has("nang luc cot loi")) {
        const t = TRAITS.find(
          (x) =>
            cands.has(norm(x.key)) ||
            [...cands].some((h) => TRAIT_ALIAS[h] === x.key),
        );
        if (t) colMap.push({ c, col: { kind: "trait", key: t.key } });
      }
    }

    // 4) Đọc từng học sinh
    const rows: ImportRow[] = [];
    let invalid = 0;
    for (let r = dataStart; r <= ws.rowCount; r++) {
      const name = text(r, nameCol);
      if (!name || !/\p{L}/u.test(name)) continue;
      // Hết danh sách: đến phần chữ ký cuối bảng (chữ ký có thể nằm ở cột tên hoặc cột bên cạnh)
      const tail = [name, text(r, nameCol + 1)].map(norm);
      if (
        tail.some(
          (t) =>
            t.startsWith("giao vien chu nhiem") || t.startsWith("hieu truong"),
        )
      )
        break;
      // Dòng có cột STT là chữ thay vì số thì không phải học sinh
      const stt = nameCol > 1 ? text(r, nameCol - 1) : "";
      if (stt && !/^\d+(\.0+)?$/.test(stt)) continue;
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
      else if (c.kind === "note") d = withNote(d, period, c.value);
      else if (c.kind === "yearResult")
        d = withYearEval(d, { result: c.value });
      else if (c.kind === "rewardEnd") d = withYearEval(d, { rewardEnd: true });
      else if (c.kind === "rewardExtra")
        d = withYearEval(d, { rewardExtra: true });
      else d = withYearEval(d, { retained: true });
    });
    updates[id] = d;
    matched++;
  });

  return { updates, matched, unmatched };
}
