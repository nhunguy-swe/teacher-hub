import type ExcelJS from "exceljs";
import {
  LEVEL_CODE,
  PERIODS,
  TRAIT_CODE,
  TRAIT_GROUPS,
  TRAIT_GROUP_TITLE,
  TRAIT_SHORT,
  TRAITS,
  YEAR_RESULTS,
  getCell,
  getNote,
  getTrait,
  getYearEval,
  hasPeriodData,
  hasTest,
  parseScore,
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
  /** Dòng "Ngày ... tháng ... năm ..." ở phần chữ ký; mặc định để chấm cho giáo viên tự điền */
  signDate?: string;
}

/* Tên sheet và tiêu đề đúng như file mẫu của trường */
const PERIOD_SHEET: Record<PeriodKey, string> = {
  gk1: "GIỮA HKI",
  ck1: "CUỐI HKI",
  gk2: "GIỮA HKII",
  cn: "CUỐI NĂM HỌC",
};

const PERIOD_TITLE: Record<PeriodKey, string> = {
  gk1: "GIỮA HỌC KÌ I",
  ck1: "HỌC KÌ I",
  gk2: "GIỮA HỌC KÌ II",
  cn: "CUỐI NĂM",
};

const isMid = (p: PeriodKey) => p === "gk1" || p === "gk2";

/*
 * Bố cục theo mẫu: dòng 1 trống, dòng 2 tiêu đề, dòng 3-5 đầu bảng (3 dòng),
 * dữ liệu từ dòng 6.
 */
const FONT = "Times New Roman";
const H1 = 3; // nhóm: Môn học..., Phẩm chất..., Năng lực cốt lõi
const H2 = 4; // tên môn / nhóm năng lực
const H3 = 5; // Mức đạt được | Điểm KTĐK | Âm nhạc | tên năng lực
const DATA_START = 6;
const ROW_HEIGHTS = [15.75, 21, 24, 39, 82.5];

const thin = { style: "thin" as const };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

type BoxOpt = { rotate?: boolean; bold?: boolean; size?: number };

/* ---- Tên cột môn học ---- */

const splitSubject = (s: string) => {
  const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { group: m[1], part: m[2] } : { group: s, part: "" };
};

/** Tên viết tắt như mẫu: "TH và CN (Tin học)", "HĐTN", "GDTC" (chỉ ở sheet cuối kì/cuối năm) */
const subjectTitle = (s: string, mid: boolean) => {
  let t = s.replace("Tin học và Công nghệ", "TH và CN");
  t = t.replace("Hoạt động trải nghiệm", "HĐTN");
  if (!mid) t = t.replace("Giáo dục thể chất", "GDTC");
  return t;
};

interface SubjCol {
  sub: string;
  tested: boolean;
  start: number;
}
interface Block {
  title: string;
  /** true: một tiêu đề chung phía trên, bên dưới là tên từng môn thành phần */
  grouped: boolean;
  cols: (SubjCol & { part: string })[];
}

/**
 * Gom các môn thành cột theo mẫu:
 * - "Nghệ thuật" luôn là một nhóm (Âm nhạc | Mĩ thuật).
 * - "Tin học và công nghệ": giữa kì là một nhóm (Tin học | Công nghệ);
 *   cuối kì/cuối năm tách thành hai cột "TH và CN (…)" vì có điểm KTĐK.
 */
function buildBlocks(subjects: string[], period: PeriodKey, firstCol: number) {
  const mid = isMid(period);
  const blocks: Block[] = [];
  let col = firstCol;
  let i = 0;
  while (i < subjects.length) {
    const { group, part } = splitSubject(subjects[i]);
    let j = i + 1;
    if (part) {
      while (j < subjects.length && splitSubject(subjects[j]).group === group)
        j++;
    }
    const run = subjects.slice(i, j);
    const anyTested = run.some((s) => hasTest(s, period));
    if (part && !anyTested) {
      blocks.push({
        title: group,
        grouped: true,
        cols: run.map((sub) => ({
          sub,
          tested: false,
          start: col++,
          part: splitSubject(sub).part,
        })),
      });
    } else {
      run.forEach((sub) => {
        const tested = hasTest(sub, period);
        blocks.push({
          title: subjectTitle(sub, mid),
          grouped: false,
          cols: [{ sub, tested, start: col, part: "" }],
        });
        col += tested ? 2 : 1;
      });
    }
    i = j;
  }
  return { blocks, nextCol: col };
}

/** "2026-2027" / "Năm học 2026 – 2027" -> "2026 - 2027" */
const yearRangeOf = (name: string) => {
  const m = name.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  return m ? `${m[1]} - ${m[2]}` : name;
};

const schoolTitle = (s: string) => {
  const t = s.trim();
  if (!t) return "";
  return (/^tr(ư|u)ờng/i.test(t) ? t : `Trường ${t}`).toUpperCase();
};

function addPeriodSheet(wb: ExcelJS.Workbook, p: Params, period: PeriodKey) {
  const mid = isMid(period);
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
    views: [{ state: "frozen", xSplit: 2, ySplit: H3 }],
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
  // 1 STT, 2 Họ tên, 3 Ngày sinh, 4 Nữ, 5... môn học
  const { blocks, nextCol } = buildBlocks(p.subjects, period, 5);
  const subjCols = blocks.flatMap((b) => b.cols);
  const subjLast = nextCol - 1;

  let col = nextCol;
  const traitCol: Record<string, number> = {};
  const groupRange: Record<string, [number, number]> = {};
  TRAIT_GROUPS.forEach((g) => {
    const start = col;
    TRAITS.filter((t) => t.group === g).forEach((t) => {
      traitCol[t.key] = col++;
    });
    groupRange[g] = [start, col - 1];
  });
  const traitsOf = (g: string) => TRAITS.filter((t) => t.group === g);

  // Sheet cuối năm: Đánh giá KQGD (4 cột) | Khen thưởng (2 cột) | Chưa được lên lớp
  const resultStart = period === "cn" ? col : 0;
  if (period === "cn") col += 4 + 2 + 1;
  const noteCol = col;

  /* ---- Tiêu đề (dòng 2) ---- */
  const title = [
    `BẢNG TỔNG HỢP KẾT QUẢ ĐÁNH GIÁ GIÁO DỤC ${PERIOD_TITLE[period]}, NĂM HỌC: ${yearRangeOf(p.yearName)}`,
    p.className && `, LỚP ${p.className}`,
    schoolTitle(p.schoolName) && ` ${schoolTitle(p.schoolName)}`,
  ]
    .filter(Boolean)
    .join("");
  ws.mergeCells(2, 1, 2, noteCol);
  const t = ws.getCell(2, 1);
  t.value = title;
  t.font = { name: FONT, size: 10, bold: true };
  t.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  /* ---- Đầu bảng (dòng 3-5) ---- */
  const small = { bold: true, size: 8 };
  head(H1, 1, H3, 1, "TT", small);
  head(H1, 2, H3, 2, "Họ và tên", small);
  head(H1, 3, H3, 3, "Ngày, tháng năm sinh", small);
  head(H1, 4, H3, 4, "Nữ", small);

  head(H1, 5, H1, subjLast, "Môn học và hoạt động giáo dục", { bold: true });
  blocks.forEach((b) => {
    const first = b.cols[0].start;
    if (b.grouped) {
      head(H2, first, H2, b.cols[b.cols.length - 1].start, b.title);
      b.cols.forEach((c) =>
        head(H3, c.start, H3, c.start, c.part, { rotate: true }),
      );
    } else {
      const c = b.cols[0];
      if (c.tested) {
        head(H2, c.start, H2, c.start + 1, b.title);
        head(H3, c.start, H3, c.start, "Mức đạt được", { rotate: true });
        head(H3, c.start + 1, H3, c.start + 1, "Điểm KTĐK", { rotate: true });
      } else if (mid) {
        // Giữa kì: môn không có điểm chỉ có tên môn, gộp 2 dòng
        head(H2, c.start, H3, c.start, b.title, { rotate: true });
      } else {
        head(H2, c.start, H2, c.start, b.title, { rotate: true });
        head(H3, c.start, H3, c.start, "Mức đạt được", { rotate: true });
      }
    }
  });

  const [q1, q2] = groupRange["Phẩm chất"];
  head(H1, q1, H1, q2, TRAIT_GROUP_TITLE["Phẩm chất"], { bold: true });
  traitsOf("Phẩm chất").forEach((x) =>
    head(H2, traitCol[x.key], H3, traitCol[x.key], x.key, { rotate: true }),
  );

  const [n1] = groupRange["Năng lực chung"];
  const [, n2] = groupRange["Năng lực đặc thù"];
  head(H1, n1, H1, n2, "Năng lực cốt lõi", { bold: true });
  (["Năng lực chung", "Năng lực đặc thù"] as const).forEach((g) => {
    const [a, b] = groupRange[g];
    head(H2, a, H2, b, TRAIT_GROUP_TITLE[g], { bold: true });
    traitsOf(g).forEach((x) =>
      head(
        H3,
        traitCol[x.key],
        H3,
        traitCol[x.key],
        TRAIT_SHORT[x.key] ?? x.key,
        {
          rotate: true,
        },
      ),
    );
  });

  if (period === "cn") {
    const r = resultStart;
    head(H1, r, H2, r + 3, "Đánh giá KQGD", { bold: true });
    YEAR_RESULTS.forEach((y, i) =>
      head(H3, r + i, H3, r + i, y.label, { rotate: true }),
    );
    head(H1, r + 4, H2, r + 5, "Khen thưởng", { bold: true });
    head(H3, r + 4, H3, r + 4, "Cuối năm", { rotate: true });
    head(H3, r + 5, H3, r + 5, "Đột xuất", { rotate: true });
    head(H1, r + 6, H3, r + 6, "Chưa được lên lớp", {
      bold: true,
      rotate: true,
    });
  }

  head(H1, noteCol, H3, noteCol, "Ghi chú", { bold: true });

  /* ---- Độ rộng cột, chiều cao dòng ---- */
  ws.getColumn(1).width = 3.6;
  ws.getColumn(2).width = 22.8;
  ws.getColumn(3).width = 11.5;
  ws.getColumn(4).width = 4.2;
  for (let c = 5; c < noteCol; c++) ws.getColumn(c).width = c < n1 ? 4.2 : 3.9;
  ws.getColumn(noteCol).width = 22;
  ROW_HEIGHTS.forEach((h, i) => (ws.getRow(i + 1).height = h));

  /* ---- Dữ liệu ---- */
  p.students.forEach((s, i) => {
    const d = p.data[s.id];
    const row: (string | number)[] = [
      i + 1,
      s.name,
      s.birthDate,
      s.female ? "x" : "",
    ];
    // Duyệt theo thứ tự cột đã dựng (đúng thứ tự trong bảng, kể cả khi gom nhóm)
    subjCols.forEach(({ sub, tested }) => {
      const c = getCell(d, sub, period);
      row.push(c.level ? LEVEL_CODE[c.level] : "");
      if (tested) row.push(parseScore(c.score) ?? "");
    });
    TRAITS.forEach((x) => {
      const v = getTrait(d, x.key, period);
      row.push(v ? TRAIT_CODE[v] : "");
    });
    if (period === "cn") {
      const y = getYearEval(d);
      YEAR_RESULTS.forEach((r) => row.push(y.result === r.key ? "x" : ""));
      row.push(y.rewardEnd ? "x" : "", y.rewardExtra ? "x" : "");
      row.push(y.retained ? "x" : "");
    }
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

  /* ---- Chữ ký: GVCN (bên trái) và Hiệu trưởng (bên phải) như mẫu ---- */
  const sign = DATA_START + p.students.length;
  const put = (
    r: number,
    c1: number,
    c2: number,
    value: string,
    font: { bold?: boolean; italic?: boolean } = {},
  ) => {
    if (c2 > c1) ws.mergeCells(r, c1, r, c2);
    const cell = ws.getCell(r, c1);
    cell.value = value;
    cell.font = { name: FONT, size: 9, ...font };
    cell.alignment = { horizontal: "center" };
  };
  const rightFrom = Math.max(5, noteCol - 12);
  const rightTo = noteCol - 1;
  put(sign, rightFrom, rightTo, p.signDate ?? "Ngày …… tháng …… năm ……", {
    italic: true,
  });
  put(sign + 1, rightFrom, rightTo, "HIỆU TRƯỞNG", { bold: true });
  put(sign + 2, rightFrom, rightTo, "(Kí, ghi rõ họ tên)", { italic: true });

  put(sign + 1, 2, 3, "GIÁO VIÊN CHỦ NHIỆM", { bold: true });
  put(sign + 2, 2, 3, "(Kí, ghi rõ họ tên)", { italic: true });
  if (p.teacherName) put(sign + 6, 2, 3, p.teacherName, { bold: true });
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
