/**
 * Cấu hình và logic thuần cho đánh giá học sinh tiểu học.
 *
 * Căn cứ: Thông tư 27/2020/TT-BGDĐT (đã được sửa đổi, bổ sung bởi Thông tư 89/2026/TT-BGDĐT).
 * File này KHÔNG phụ thuộc React hay Firebase, nên dễ viết test và dễ sửa khi quy định đổi.
 * Khi Bộ thay đổi quy định, ưu tiên chỉ sửa ở đây (hằng số + suggestYearLevel).
 *
 * LƯU Ý: các ngưỡng và danh sách môn có kiểm tra định kì bên dưới cần đối chiếu
 * với văn bản hiện hành / hướng dẫn của Sở, Phòng GD&ĐT trước khi dùng chính thức.
 */

/* ======================= Mốc đánh giá ======================= */

export type PeriodKey = "gk1" | "ck1" | "gk2" | "cn";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "gk1", label: "Giữa HK1" },
  { key: "ck1", label: "Cuối HK1" },
  { key: "gk2", label: "Giữa HK2" },
  { key: "cn", label: "Cuối năm" },
];

export const periodLabel = (k: PeriodKey) =>
  PERIODS.find((p) => p.key === k)?.label ?? k;

/* ======================= Môn học ======================= */

export const GRADES = [1, 2, 3, 4, 5] as const;

const GRADE_1_2 = [
  "Tiếng Việt",
  "Toán",
  "Đạo đức",
  "Tự nhiên và Xã hội",
  "Giáo dục thể chất",
  "Nghệ thuật (Âm nhạc)",
  "Nghệ thuật (Mĩ thuật)",
  "Hoạt động trải nghiệm",
];

const GRADE_3 = [
  "Tiếng Việt",
  "Toán",
  "Tiếng Anh",
  "Tự nhiên và Xã hội",
  "Tin học và Công nghệ (Tin học)",
  "Tin học và Công nghệ (Công nghệ)",
  "Đạo đức",
  "Giáo dục thể chất",
  "Nghệ thuật (Âm nhạc)",
  "Nghệ thuật (Mĩ thuật)",
  "Hoạt động trải nghiệm",
];

const GRADE_4_5 = [
  "Tiếng Việt",
  "Toán",
  "Tiếng Anh",
  "Lịch sử và Địa lí",
  "Khoa học",
  "Tin học và Công nghệ (Tin học)",
  "Tin học và Công nghệ (Công nghệ)",
  "Đạo đức",
  "Giáo dục thể chất",
  "Nghệ thuật (Âm nhạc)",
  "Nghệ thuật (Mĩ thuật)",
  "Hoạt động trải nghiệm",
];

/** Danh sách môn mặc định theo khối. Giáo viên vẫn thêm/bỏ được (VD tiếng dân tộc). */
export const SUBJECTS_BY_GRADE: Record<number, string[]> = {
  1: GRADE_1_2,
  2: GRADE_1_2,
  3: GRADE_3,
  4: GRADE_4_5,
  5: GRADE_4_5,
};

export const defaultSubjects = (grade: number): string[] => [
  ...(SUBJECTS_BY_GRADE[grade] ?? GRADE_4_5),
];

/**
 * Môn có cột "Điểm KTĐK" theo mẫu bảng tổng hợp của trường:
 * giữa kì chỉ Tiếng Việt và Toán; cuối kì và cuối năm thêm Tiếng Anh,
 * Lịch sử và Địa lí, Khoa học, Tin học, Công nghệ.
 */
const MID_TESTED = ["Tiếng Việt", "Toán"];
const END_TESTED = [
  ...MID_TESTED,
  "Tiếng Anh",
  "Lịch sử và Địa lí",
  "Khoa học",
  "Tin học và Công nghệ (Tin học)",
  "Tin học và Công nghệ (Công nghệ)",
];
const TESTED_SUBJECTS: Record<PeriodKey, Set<string>> = {
  gk1: new Set(MID_TESTED),
  gk2: new Set(MID_TESTED),
  ck1: new Set(END_TESTED),
  cn: new Set(END_TESTED),
};

/** Môn này ở mốc này có nhập điểm kiểm tra định kì không? */
export const hasTest = (subject: string, period: PeriodKey) =>
  TESTED_SUBJECTS[period].has(subject);

/* ======================= Mức đạt ======================= */

export type LevelKey = "HTT" | "HT" | "CHT" | "MIEN";
export type Level = "" | LevelKey;

export const LEVELS: { key: LevelKey; short: string; label: string }[] = [
  { key: "HTT", short: "HTT", label: "Hoàn thành tốt" },
  { key: "HT", short: "HT", label: "Hoàn thành" },
  { key: "CHT", short: "CHT", label: "Chưa hoàn thành" },
  // Học sinh được miễn môn/hoạt động theo kế hoạch giáo dục cá nhân (ghi "Miễn" trong học bạ)
  { key: "MIEN", short: "Miễn", label: "Miễn" },
];

export const LEVEL_LABEL = Object.fromEntries(
  LEVELS.map((l) => [l.key, l.label]),
) as Record<LevelKey, string>;

/** Ký hiệu ghi trong bảng tổng hợp */
export const LEVEL_CODE: Record<LevelKey, string> = {
  HTT: "T",
  HT: "H",
  CHT: "C",
  MIEN: "Miễn",
};

export type TraitLevel = "" | "T" | "D" | "C";

export const TRAIT_LABEL: Record<Exclude<TraitLevel, "">, string> = {
  T: "Tốt",
  D: "Đạt",
  C: "Cần cố gắng",
};

export const TRAIT_CODE: Record<Exclude<TraitLevel, "">, string> = {
  T: "T",
  D: "Đ",
  C: "C",
};

export type TraitGroup = "Phẩm chất" | "Năng lực chung" | "Năng lực đặc thù";

export const TRAIT_GROUPS: TraitGroup[] = [
  "Phẩm chất",
  "Năng lực chung",
  "Năng lực đặc thù",
];

export const TRAIT_GROUP_TITLE: Record<TraitGroup, string> = {
  "Phẩm chất": "Phẩm chất chủ yếu",
  "Năng lực chung": "Năng lực chung",
  "Năng lực đặc thù": "Năng lực đặc thù",
};

export const TRAITS: { key: string; group: TraitGroup }[] = [
  { key: "Yêu nước", group: "Phẩm chất" },
  { key: "Nhân ái", group: "Phẩm chất" },
  { key: "Chăm chỉ", group: "Phẩm chất" },
  { key: "Trung thực", group: "Phẩm chất" },
  { key: "Trách nhiệm", group: "Phẩm chất" },
  { key: "Tự chủ và tự học", group: "Năng lực chung" },
  { key: "Giao tiếp và hợp tác", group: "Năng lực chung" },
  { key: "Giải quyết vấn đề và sáng tạo", group: "Năng lực chung" },
  { key: "Ngôn ngữ", group: "Năng lực đặc thù" },
  { key: "Tính toán", group: "Năng lực đặc thù" },
  { key: "Khoa học", group: "Năng lực đặc thù" },
  { key: "Công nghệ", group: "Năng lực đặc thù" },
  { key: "Tin học", group: "Năng lực đặc thù" },
  { key: "Thẩm mĩ", group: "Năng lực đặc thù" },
  { key: "Thể chất", group: "Năng lực đặc thù" },
];

/* ======================= Kiểu dữ liệu ======================= */

/** Ô đánh giá của một môn trong một mốc. Điểm giữ dạng chuỗi để gõ dở không bị mất. */
export interface SubjectCell {
  level: Level;
  /** Điểm kiểm tra định kì, số nguyên 0-10. Chỉ dùng khi hasTest(subject, period). */
  score: string;
  note: string;
}

export interface StudentData {
  subjects: Record<string, Partial<Record<PeriodKey, SubjectCell>>>;
  traits: Record<string, Partial<Record<PeriodKey, TraitLevel>>>;
  /** Ghi chú chung của học sinh theo mốc (cột "Ghi chú" trong bảng tổng hợp) */
  notes: Partial<Record<PeriodKey, string>>;
}

export type StoredCell = {
  level?: string;
  score?: number | null;
  note?: string;
};

export type StoredData = {
  subjects: Record<string, Record<string, Required<StoredCell>>>;
  traits: Record<string, Record<string, string>>;
  notes: Record<string, string>;
};

/* ======================= Hàm tiện ích ======================= */

/** Điểm kiểm tra định kì tiểu học: thang 10, số nguyên (cho phép 0), không có số thập phân. */
export const parseScore = (
  s: string | number | null | undefined,
): number | null => {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
};

export const EMPTY_CELL: SubjectCell = { level: "", score: "", note: "" };

export const emptyData = (): StudentData => ({
  subjects: {},
  traits: {},
  notes: {},
});

export const getCell = (
  d: StudentData | undefined,
  sub: string,
  p: PeriodKey,
): SubjectCell => d?.subjects?.[sub]?.[p] ?? EMPTY_CELL;

export const getTrait = (
  d: StudentData | undefined,
  trait: string,
  p: PeriodKey,
): TraitLevel => d?.traits?.[trait]?.[p] ?? "";

export const withCell = (
  d: StudentData,
  sub: string,
  p: PeriodKey,
  patch: Partial<SubjectCell>,
): StudentData => {
  const cur = d.subjects[sub]?.[p] ?? EMPTY_CELL;
  return {
    ...d,
    subjects: {
      ...d.subjects,
      [sub]: { ...d.subjects[sub], [p]: { ...cur, ...patch } },
    },
  };
};

export const withTrait = (
  d: StudentData,
  trait: string,
  p: PeriodKey,
  v: TraitLevel,
): StudentData => ({
  ...d,
  traits: { ...d.traits, [trait]: { ...d.traits[trait], [p]: v } },
});

export const getNote = (d: StudentData | undefined, p: PeriodKey): string =>
  d?.notes?.[p] ?? "";

export const withNote = (
  d: StudentData,
  p: PeriodKey,
  v: string,
): StudentData => ({ ...d, notes: { ...d.notes, [p]: v } });

/** Mốc này đã có dữ liệu nhập chưa (dùng để quyết định xuất sheet nào). */
export const hasPeriodData = (d: StudentData | undefined, p: PeriodKey) =>
  !!d &&
  (Object.values(d.subjects).some((per) => {
    const c = per[p];
    return !!c && (!!c.level || c.score !== "" || !!c.note.trim());
  }) ||
    Object.values(d.traits).some((per) => !!per[p]) ||
    !!d.notes?.[p]?.trim());

const asLevel = (s?: string): Level =>
  s === "HTT" || s === "HT" || s === "CHT" || s === "MIEN" ? s : "";
const asTrait = (s?: string): TraitLevel =>
  s === "T" || s === "D" || s === "C" ? s : "";

export const toTraitLevel = asTrait;

/** Firestore -> state. Bỏ qua các trường cũ không còn dùng (oral, q15, t1). */
export const fromStored = (
  subjects?: Record<string, Record<string, StoredCell>>,
  traits?: Record<string, Record<string, string>>,
  notes?: Record<string, string>,
): StudentData => {
  const out = emptyData();
  Object.entries(subjects || {}).forEach(([sub, per]) => {
    out.subjects[sub] = {};
    PERIODS.forEach(({ key }) => {
      const c = per?.[key];
      if (!c) return;
      out.subjects[sub][key] = {
        level: asLevel(c.level),
        score: c.score === null || c.score === undefined ? "" : String(c.score),
        note: c.note || "",
      };
    });
  });
  Object.entries(traits || {}).forEach(([t, per]) => {
    out.traits[t] = {};
    PERIODS.forEach(({ key }) => {
      const v = asTrait(per?.[key]);
      if (v) out.traits[t][key] = v;
    });
  });
  PERIODS.forEach(({ key }) => {
    const n = notes?.[key];
    if (n) out.notes[key] = n;
  });
  return out;
};

/** state -> Firestore. Chỉ lưu ô có nội dung để tài liệu nhỏ gọn. */
export const toStored = (d: StudentData): StoredData => {
  const subjects: StoredData["subjects"] = {};
  Object.entries(d.subjects).forEach(([sub, per]) => {
    Object.entries(per).forEach(([p, c]) => {
      if (!c || (!c.level && c.score === "" && !c.note.trim())) return;
      (subjects[sub] ??= {})[p] = {
        level: c.level,
        score: parseScore(c.score),
        note: c.note.trim(),
      };
    });
  });
  const traits: StoredData["traits"] = {};
  Object.entries(d.traits).forEach(([t, per]) => {
    Object.entries(per).forEach(([p, v]) => {
      if (v) (traits[t] ??= {})[p] = v;
    });
  });
  const notes: StoredData["notes"] = {};
  Object.entries(d.notes ?? {}).forEach(([p, v]) => {
    if (v && v.trim()) notes[p] = v.trim();
  });
  return { subjects, traits, notes };
};

/* ======================= Gợi ý mức tổng hợp cuối năm ======================= */

export type YearLevelKey =
  | "incomplete"
  | "excellent"
  | "good"
  | "pass"
  | "fail";

/** Ngưỡng điểm kiểm tra định kì cuối năm. Đối chiếu văn bản hiện hành trước khi dùng chính thức. */
export const YEAR_LEVEL_THRESHOLDS = { excellent: 9, good: 7, pass: 5 };

export interface YearSuggestion {
  level: YearLevelKey;
  htt: number;
  ht: number;
  cht: number;
  mien: number;
  tT: number;
  tD: number;
  tC: number;
  /** Điểm kiểm tra định kì cuối năm thấp nhất (null nếu chưa có) */
  min: number | null;
  /** Số ô còn thiếu (mức môn, phẩm chất/năng lực, điểm kiểm tra) */
  missing: number;
}

/**
 * Chỉ là GỢI Ý để giáo viên đối chiếu; giáo viên quyết định mức cuối cùng.
 * Môn được miễn không tính vào điều kiện.
 */
export const suggestYearLevel = (
  d: StudentData | undefined,
  subjects: string[],
): YearSuggestion => {
  const cells = subjects.map((s) => ({ s, c: getCell(d, s, "cn") }));
  const active = cells.filter((x) => x.c.level !== "MIEN");
  const traits = TRAITS.map((t) => getTrait(d, t.key, "cn"));

  const tested = active.filter((x) => hasTest(x.s, "cn"));
  const scores = tested.map((x) => parseScore(x.c.score));
  const known = scores.filter((n): n is number => n !== null);

  const missing =
    active.filter((x) => !x.c.level).length +
    traits.filter((t) => !t).length +
    scores.filter((n) => n === null).length;

  const count = <T>(arr: T[], v: T) => arr.filter((x) => x === v).length;
  const levels = cells.map((x) => x.c.level);
  const base = {
    htt: count(levels, "HTT" as Level),
    ht: count(levels, "HT" as Level),
    cht: count(levels, "CHT" as Level),
    mien: count(levels, "MIEN" as Level),
    tT: count(traits, "T" as TraitLevel),
    tD: count(traits, "D" as TraitLevel),
    tC: count(traits, "C" as TraitLevel),
    min: known.length ? Math.min(...known) : null,
    missing,
  };

  if (missing > 0) return { ...base, level: "incomplete" };

  const { excellent, good, pass } = YEAR_LEVEL_THRESHOLDS;
  const allHTT = base.ht === 0 && base.cht === 0;
  const allT = base.tT === TRAITS.length;
  const minAtLeast = (n: number) => base.min === null || base.min >= n;

  if (allHTT && allT && minAtLeast(excellent))
    return { ...base, level: "excellent" };
  if (allHTT && allT && minAtLeast(good)) return { ...base, level: "good" };
  if (base.cht === 0 && base.tC === 0 && minAtLeast(pass))
    return { ...base, level: "pass" };
  return { ...base, level: "fail" };
};
