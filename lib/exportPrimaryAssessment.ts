import type ExcelJS from "exceljs";
import {
  LEVEL_CODE,
  PERIODS,
  TRAIT_CODE,
  TRAIT_GROUPS,
  TRAIT_GROUP_TITLE,
  TRAITS,
  getCell,
  getTrait,
  hasPeriodData,
  hasTest,
  parseScore,
  getNote,
  type PeriodKey,
  type StudentData,
} from "@/lib/primaryAssessment";

export interface ExportStudent {
  id: string;
  name: string;
  birthDate: string; // dd/mm/yyyy
  female: boolean;
}

export interface ExportComment {
  text: string;
  status: "draft" | "final";
}

interface Params {
  yearName: string;
  className: string;
  schoolName: string;
  teacherName: string;
  period: PeriodKey;
  subjects: string[];
  students: ExportStudent[];
  data: Record<string, StudentData>;
  comments: Record<string, ExportComment | undefined>;
}

const PERIOD_TITLE: Record<PeriodKey, string> = {
  gk1: "GIỮA KỲ 1",
  ck1: "CUỐI KỲ 1",
  gk2: "GIỮA KỲ 2",
  cn: "CUỐI NĂM",
};

const PERIOD_SHEET: Record<PeriodKey, string> = {
  gk1: "GK1",
  ck1: "CK1",
  gk2: "GK2",
  cn: "CN",
};

/* Bố cục theo mẫu: dòng 1 trống, dòng 2 tiêu đề, dòng 3-6 đầu bảng, dữ liệu từ dòng 7 */
const FONT = "Times New Roman";
const HEAD_FIRST = 3;
const HEAD_LAST = 6;
const DATA_START = 7;
const ROW_HEIGHTS = [15.75, 21, 36, 31.5, 57.75, 55.7];

const thin = { style: "thin" as const };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

// Mẫu ghi "(CN)" thay cho "(Công nghệ)" ở tên cột
const subjectLabel = (s: string) => s.replace("(Công nghệ)", "(CN)");

type BoxOpt = { rotate?: boolean; bold?: boolean; size?: number };

function addPeriodSheet(wb: ExcelJS.Workbook, p: Params, period: PeriodKey) {
  const ws = wb.addWorksheet(PERIOD_SHEET[period], {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  const head = (
    r1: number,
    c1: number,
    r2: number,
    c2: number,
    value: string,
    o: BoxOpt = {},
  ) => {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    ws.getCell(r1, c1).value = value;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cell = ws.getCell(r, c);
        cell.border = BORDER;
        cell.font = { name: FONT, size: o.size ?? 9, bold: !!o.bold };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
          textRotation: o.rotate ? 90 : 0,
        };
      }
    }
  };

  /* ---- Vị trí các cột ---- */
  let col = 5; // 1 STT, 2 Họ tên, 3 Ngày sinh, 4 Nữ
  const subjCols = p.subjects.map((sub) => {
    const tested = hasTest(sub, period);
    const start = col;
    col += tested ? 2 : 1;
    return { sub, tested, start };
  });
  const subjLast = col - 1;

  const traitCol: Record<string, number> = {};
  const groupRange: Record<string, [number, number]> = {};
  TRAIT_GROUPS.forEach((g) => {
    const start = col;
    TRAITS.filter((t) => t.group === g).forEach((t) => {
      traitCol[t.key] = col++;
    });
    groupRange[g] = [start, col - 1];
  });
  const noteCol = col;
  const traitsOf = (g: string) => TRAITS.filter((t) => t.group === g);

  /* ---- Tiêu đề (dòng 2) ---- */
  const yearRange = p.yearName.match(/\d{4}\s*[-–]\s*\d{4}/)?.[0] ?? p.yearName;
  const title = [
    `BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ GIÁO DỤC ${PERIOD_TITLE[period]} ${yearRange}`,
    p.className && `LỚP: ${p.className}`,
    p.schoolName && `TRƯỜNG: ${p.schoolName}`,
  ]
    .filter(Boolean)
    .join(" ");
  ws.mergeCells(2, 1, 2, noteCol);
  const t = ws.getCell(2, 1);
  t.value = title;
  t.font = { name: FONT, size: 10, bold: true };
  t.alignment = { horizontal: "center", vertical: "middle" };

  /* ---- Đầu bảng (dòng 3-6) ---- */
  const small = { bold: true, size: 8 };
  head(HEAD_FIRST, 1, HEAD_LAST, 1, "STT", small);
  head(HEAD_FIRST, 2, HEAD_LAST, 2, "HỌ VÀ TÊN HỌC SINH", small);
  head(HEAD_FIRST, 3, HEAD_LAST, 3, "Ngày, tháng, năm sinh", small);
  head(HEAD_FIRST, 4, HEAD_LAST, 4, "Nữ", small);

  head(3, 5, 3, subjLast, "Môn học và hoạt động giáo dục", { bold: true });
  subjCols.forEach(({ sub, tested, start }) => {
    head(4, start, 5, tested ? start + 1 : start, subjectLabel(sub), {
      rotate: true,
    });
    head(6, start, 6, start, "Mức đạt được", { rotate: true });
    if (tested) head(6, start + 1, 6, start + 1, "Điểm KTĐK", { rotate: true });
  });

  const [q1, q2] = groupRange["Phẩm chất"];
  head(3, q1, 3, q2, TRAIT_GROUP_TITLE["Phẩm chất"], { bold: true });
  traitsOf("Phẩm chất").forEach((x) =>
    head(4, traitCol[x.key], 6, traitCol[x.key], x.key, { rotate: true }),
  );

  const [n1] = groupRange["Năng lực chung"];
  const [, n2] = groupRange["Năng lực đặc thù"];
  head(3, n1, 3, n2, "Năng lực cốt lõi", { bold: true });
  (["Năng lực chung", "Năng lực đặc thù"] as const).forEach((g) => {
    const [a, b] = groupRange[g];
    head(4, a, 4, b, TRAIT_GROUP_TITLE[g], { bold: true });
    traitsOf(g).forEach((x) =>
      head(5, traitCol[x.key], 6, traitCol[x.key], x.key, { rotate: true }),
    );
  });

  head(HEAD_FIRST, noteCol, HEAD_LAST, noteCol, "Ghi chú", { bold: true });

  /* ---- Độ rộng cột, chiều cao dòng ---- */
  ws.getColumn(1).width = 3.6;
  ws.getColumn(2).width = 15.6;
  ws.getColumn(3).width = 7.8;
  ws.getColumn(4).width = 3.6;
  for (let c = 5; c < noteCol; c++) ws.getColumn(c).width = c < n1 ? 4.2 : 3.7;
  ws.getColumn(noteCol).width = 8.8;
  ROW_HEIGHTS.forEach((h, i) => (ws.getRow(i + 1).height = h));

  /* ---- Dữ liệu ---- */
  p.students.forEach((s, i) => {
    const d = p.data[s.id];
    const row: (string | number)[] = [
      i + 1,
      s.name,
      s.birthDate,
      s.female ? "X" : "",
    ];
    subjCols.forEach(({ sub, tested }) => {
      const c = getCell(d, sub, period);
      row.push(c.level ? LEVEL_CODE[c.level] : "");
      if (tested) row.push(parseScore(c.score) ?? "");
    });
    TRAITS.forEach((x) => {
      const v = getTrait(d, x.key, period);
      row.push(v ? TRAIT_CODE[v] : "");
    });
    row.push(getNote(d, period));

    const r = DATA_START + i;
    ws.getRow(r).height = 15.75;
    row.forEach((v, idx) => {
      const cell = ws.getCell(r, idx + 1);
      cell.value = v;
      cell.border = BORDER;
      cell.font = { name: FONT, size: idx < 4 ? 8 : 9 };
      cell.alignment = {
        horizontal: idx === 1 || idx === noteCol - 1 ? "left" : "center",
        vertical: "middle",
      };
    });
  });

  /* ---- Chữ ký: Hiệu trưởng (cột C) và GVCN (cột cuối trước Ghi chú) ---- */
  const sign = DATA_START + p.students.length;
  const put = (
    r: number,
    c: number,
    value: string,
    font: { bold?: boolean; italic?: boolean } = {},
  ) => {
    const cell = ws.getCell(r, c);
    cell.value = value;
    cell.font = { name: FONT, size: 9, ...font };
    cell.alignment = { horizontal: "center" };
  };
  const teacherCol = noteCol - 1;
  put(sign, teacherCol, "Giáo viên chủ nhiệm", { bold: true });
  put(sign + 1, teacherCol, "(Ký và ghi rõ họ tên)", { italic: true });
  if (p.teacherName) put(sign + 4, teacherCol, p.teacherName);
}

export async function buildAssessmentWorkbook(p: Params): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  // Giống mẫu: mỗi mốc một sheet. Mốc nào chưa nhập gì thì bỏ qua (trừ mốc đang chọn).
  PERIODS.map((x) => x.key)
    .filter(
      (k) =>
        k === p.period ||
        p.students.some((s) => hasPeriodData(p.data[s.id], k)),
    )
    .forEach((k) => addPeriodSheet(wb, p, k));

  // Nhận xét GVCN (không nằm trong mẫu): sheet phụ, chỉ tạo khi có nhận xét
  const rows = PERIODS.flatMap(({ key, label }) =>
    p.students.flatMap((s, i) => {
      const c = p.comments[`${s.id}|${key}`];
      return c?.text.trim()
        ? [
            {
              stt: i + 1,
              name: s.name,
              period: label,
              text: c.text,
              status: c.status === "final" ? "Đã chốt" : "Nháp",
            },
          ]
        : [];
    }),
  );
  if (rows.length > 0) {
    const ws = wb.addWorksheet("Nhận xét GVCN");
    ws.columns = [
      { header: "STT", key: "stt", width: 6 },
      { header: "Họ và tên", key: "name", width: 28 },
      { header: "Mốc", key: "period", width: 12 },
      { header: "Nhận xét", key: "text", width: 100 },
      { header: "Trạng thái", key: "status", width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.getColumn("text").alignment = { wrapText: true, vertical: "top" };
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
