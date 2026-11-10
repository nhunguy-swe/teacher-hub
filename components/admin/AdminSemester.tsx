"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
} from "firebase/firestore";
import { API_BASE } from "@/lib/apiBase";
import {
  GRADES,
  LEVELS,
  LEVEL_CODE,
  LEVEL_LABEL,
  PERIODS,
  TRAITS,
  TRAIT_CODE,
  TRAIT_GROUP_TITLE,
  TRAIT_LABEL,
  defaultSubjects,
  emptyData,
  fromStored,
  getCell,
  getNote,
  getTrait,
  hasTest,
  parseScore,
  periodLabel,
  toStored,
  toTraitLevel,
  withCell,
  withNote,
  withTrait,
  type LevelKey,
  type PeriodKey,
  type StudentData,
  type SubjectCell,
  type TraitLevel,
} from "@/lib/primaryAssessment";
import {
  buildAssessmentWorkbook,
  saveBlob,
} from "@/lib/exportPrimaryAssessment";
import {
  applyImport,
  parseWorkbook,
  type ImportRow,
} from "@/lib/importPrimaryAssessment";

/* ======================= Kiểu dữ liệu ======================= */

interface StudentItem {
  id: string;
  name: string;
  group?: string;
  stars?: number;
  position?: string;
  birthDate: string;
  female: boolean;
}

interface YearItem {
  id: string;
  name: string;
  className: string;
  schoolName: string;
  teacherName: string;
  grade: number;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
  subjects: string[];
}

type CommentTone = "short" | "detailed" | "parent";
interface CommentItem {
  text: string;
  source: "ai" | "manual";
  status: "draft" | "final";
}

interface ActivityLogLite {
  studentId?: string;
  name: string;
  label: string;
  delta: number;
  type?: string;
}
interface AttendanceLite {
  studentId: string;
  status: string;
  date: string;
}

type Tab = "years" | "grid" | "comments";

/* ======================= Giao diện ======================= */

const LEVEL_STYLE: Record<LevelKey, { on: string; chip: string }> = {
  HTT: {
    on: "bg-emerald-500 text-white border-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  HT: {
    on: "bg-sky-500 text-white border-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200",
  },
  CHT: {
    on: "bg-rose-500 text-white border-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
  },
  MIEN: {
    on: "bg-slate-500 text-white border-slate-500",
    chip: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

const TONE_LABEL: Record<CommentTone, string> = {
  short: "Ngắn gọn (sổ liên lạc)",
  detailed: "Chi tiết",
  parent: "Gửi phụ huynh",
};

const BTN =
  "px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const BTN_AMBER = `${BTN} bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20`;
const BTN_SOFT = `${BTN} bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-600 hover:text-white hover:border-amber-600`;
const BTN_INDIGO = `${BTN} bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600`;
const BTN_GREEN = `${BTN} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600`;
const BTN_ROSE = `${BTN} bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600`;
const SELECT =
  "text-xs font-bold text-slate-700 bg-white border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-60";
const INPUT =
  "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none";
const CELL_INPUT =
  "h-10 text-base rounded-lg border border-slate-200 bg-white text-slate-800 px-1 appearance-none text-center focus:outline-none focus:border-amber-400 disabled:bg-slate-50 disabled:text-slate-400";
const TH_X =
  "text-slate-700! bg-slate-100! p-1 font-bold text-xs text-center border border-slate-300";
const TH_S =
  "text-slate-700! bg-slate-100! p-1 font-semibold text-[10px] leading-tight text-center border border-slate-300 whitespace-normal";
const TD_X = "border border-slate-200 p-1 text-center";
const SEARCH =
  "w-36 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:border-amber-400 focus:outline-none";

/* ======================= Hàm tiện ích ======================= */

const removeAccents = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const getGivenName = (fullName?: string) =>
  (fullName || "").trim().split(/\s+/).pop() || "";

const compareByGivenName = (a?: string, b?: string) =>
  getGivenName(a).localeCompare(getGivenName(b), "vi") ||
  (a || "").localeCompare(b || "", "vi");

const pad = (n: number) => String(n).padStart(2, "0");
const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const formatDMY = (key: string) => key.split("-").reverse().join("/");

const DEFAULT_SCHOOL = "TH số 1 Hoài Nhơn Đông";

const readBirthDate = (x: Record<string, unknown>) => {
  const v = x.birthDate ?? x.dob ?? x.dateOfBirth ?? x.birthday;
  if (!v) return "";
  if (v instanceof Timestamp) {
    const d = v.toDate();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatDMY(s) : s;
};

const readFemale = (x: Record<string, unknown>) => {
  if (x.isFemale === true) return true;
  const g = removeAccents(String(x.gender ?? x.sex ?? ""));
  return g === "nu" || g === "female" || g === "f";
};

const defaultYearForm = () => {
  const now = new Date();
  const y = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `Năm học ${y}-${y + 1}`,
    className: "",
    schoolName: DEFAULT_SCHOOL,
    teacherName: "",
    grade: 1,
    startDate: `${y}-09-05`,
    endDate: `${y + 1}-05-31`,
  };
};

const ckey = (sid: string, p: PeriodKey) => `${sid}|${p}`;

const fileSafe = (s: string) =>
  s.replace(/[\\/?*[\]:]/g, "-").replace(/\s+/g, "-");

const deleteInChunks = async (docs: { ref: DocumentReference }[]) => {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

const subjectShort = (s: string) => s.replace("(Công nghệ)", "(CN)");

/* ======================= Component chính ======================= */

export default function AdminSemester() {
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("years");
  const [period, setPeriod] = useState<PeriodKey>("gk1");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [years, setYears] = useState<YearItem[]>([]);
  const [selectedId, setSelectedId] = useState("");

  const [data, setData] = useState<Record<string, StudentData>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const dirtyRef = useRef<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<Record<string, CommentItem>>({});
  const [dirtyComments, setDirtyComments] = useState<Set<string>>(new Set());
  const dirtyCommentsRef = useRef<Set<string>>(new Set());
  const [savingComments, setSavingComments] = useState(false);

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(false); // giáo viên đã chọn mốc chưa
  const [expanded, setExpanded] = useState(false); // bảng đang phóng to

  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(defaultYearForm);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<YearItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // đang sửa năm học nào

  const [tone, setTone] = useState<CommentTone>("short");
  const [activeStudentId, setActiveStudentId] = useState("");
  const [aiLoadingId, setAiLoadingId] = useState("");
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const cancelBatchRef = useRef(false);
  const ctxRef = useRef<{
    key: string;
    logs: ActivityLogLite[];
    att: AttendanceLite[];
  } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);
  const tabInitRef = useRef(false);

  const year = useMemo(
    () =>
      years.find((y) => y.id === selectedId) ??
      years.find((y) => y.status === "open") ??
      years[0],
    [years, selectedId],
  );
  const yearId = year?.id;
  const locked = year?.status === "closed";
  const inputsOff = locked || saving;

  const subjectList = useMemo(
    () => year?.subjects ?? defaultSubjects(year?.grade ?? 4),
    [year],
  );

  const filteredStudents = useMemo(() => {
    const kw = removeAccents(search);
    if (!kw) return students;
    return students.filter((s) => removeAccents(s.name).includes(kw));
  }, [students, search]);

  // Cột của bảng đánh giá theo mốc đang chọn (giống file Excel)
  const subjCols = useMemo(
    () => subjectList.map((sub) => ({ sub, tested: hasTest(sub, period) })),
    [subjectList, period],
  );
  const subjSpan = subjCols.reduce((a, c) => a + (c.tested ? 2 : 1), 0);
  const traitsOf = (g: string) => TRAITS.filter((t) => t.group === g);
  const coreTraits = TRAITS.filter((t) => t.group !== "Phẩm chất");

  /* ---------- Đăng ký dữ liệu Firestore ---------- */

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          ...x,
          birthDate: readBirthDate(x),
          female: readFemale(x),
        };
      }) as StudentItem[];
      list.sort((a, b) => compareByGivenName(a.name, b.name));
      setStudents(list);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "semesters"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setYears(
        snap.docs
          .filter((d) => d.data().schema === 2)
          .map((d) => {
            const x = d.data();
            const grade = Number(x.grade) || 0;
            return {
              id: d.id,
              name: x.name || "",
              className: x.className || "",
              schoolName: x.schoolName || "",
              teacherName: x.teacherName || "",
              grade,
              startDate: x.startDate || "",
              endDate: x.endDate || "",
              status: x.status === "closed" ? "closed" : "open",
              subjects: (x.subjects as string[]) || defaultSubjects(grade || 4),
            } as YearItem;
          }),
      );
    });
  }, []);

  useEffect(() => {
    if (!tabInitRef.current && years.length > 0) {
      tabInitRef.current = true;
      setTab("grid");
    }
  }, [years]);

  useEffect(() => {
    if (!yearId) return;
    const q = query(
      collection(db, "semesterGrades"),
      where("semesterId", "==", yearId),
    );
    const unsub = onSnapshot(q, (snap) => {
      setData((prev) => {
        const next = { ...prev };
        snap.docs.forEach((d) => {
          const x = d.data();
          const sid = x.studentId as string;
          if (dirtyRef.current.has(sid)) return;
          next[sid] = fromStored(x.subjects, x.traits, x.notes);
        });
        return next;
      });
    });
    return () => {
      unsub();
      setData({});
      dirtyRef.current = new Set();
      setDirty(new Set());
    };
  }, [yearId]);

  useEffect(() => {
    if (!yearId) return;
    const q = query(
      collection(db, "semesterComments"),
      where("semesterId", "==", yearId),
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments((prev) => {
        const next = { ...prev };
        snap.docs.forEach((d) => {
          const x = d.data();
          const p = x.period as PeriodKey;
          if (!PERIODS.some((o) => o.key === p)) return;
          const key = ckey(x.studentId as string, p);
          if (dirtyCommentsRef.current.has(key)) return;
          next[key] = {
            text: x.text || "",
            source: x.source === "manual" ? "manual" : "ai",
            status: x.status === "final" ? "final" : "draft",
          };
        });
        return next;
      });
    });
    return () => {
      unsub();
      setComments({});
      dirtyCommentsRef.current = new Set();
      setDirtyComments(new Set());
      ctxRef.current = null;
    };
  }, [yearId]);

  const hasUnsaved = dirty.size > 0 || dirtyComments.size > 0;

  useEffect(() => {
    return () => {
      cancelBatchRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsaved]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const handleSelectYear = (id: string) => {
    if (id === yearId) return;
    if (batchProgress !== null) {
      toast.warning("Đang tạo nhận xét, hãy dừng trước khi đổi năm học");
      return;
    }
    if (
      hasUnsaved &&
      !window.confirm("Còn dữ liệu chưa lưu, đổi năm học sẽ mất. Tiếp tục?")
    )
      return;
    setEditingId(null);
    setForm(defaultYearForm());
    setSelectedId(id);
  };

  /* ---------- Năm học ---------- */

  const handleCreateYear = async () => {
    const name = form.name.trim();
    if (!name || !form.startDate || !form.endDate) {
      toast.error("Vui lòng nhập tên năm học, ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, "semesters"), {
        schema: 2,
        name,
        className: form.className.trim(),
        schoolName: form.schoolName.trim(),
        teacherName: form.teacherName.trim(),
        grade: form.grade,
        startDate: form.startDate,
        endDate: form.endDate,
        status: "open",
        subjects: defaultSubjects(form.grade),
        createdAt: serverTimestamp(),
      });
      setSelectedId(ref.id);
      setForm({
        ...defaultYearForm(),
        schoolName: form.schoolName,
        teacherName: form.teacherName,
      });
      toast.success(`Đã tạo năm học "${name}"!`);
      setTab("grid");
    } catch (err) {
      console.error(err);
      toast.error("Không thể tạo năm học");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!year) return;
    if (!locked && hasUnsaved) {
      toast.warning("Hãy lưu dữ liệu trước khi chốt năm học");
      return;
    }
    try {
      await updateDoc(doc(db, "semesters", year.id), {
        status: locked ? "open" : "closed",
      });
      toast.success(locked ? "Đã mở lại năm học" : "Đã chốt năm học");
    } catch {
      toast.error("Không thể đổi trạng thái năm học");
    }
  };

  const handleEditInfo = (y: YearItem) => {
    setEditingId(y.id);
    setForm({
      name: y.name,
      className: y.className,
      schoolName: y.schoolName || DEFAULT_SCHOOL,
      teacherName: y.teacherName,
      grade: y.grade || 1,
      startDate: y.startDate,
      endDate: y.endDate,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(defaultYearForm());
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const name = form.name.trim();
    if (!name || !form.startDate || !form.endDate) {
      toast.error("Vui lòng nhập tên năm học, ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    setCreating(true);
    try {
      await updateDoc(doc(db, "semesters", editingId), {
        name,
        className: form.className.trim(),
        schoolName: form.schoolName.trim(),
        teacherName: form.teacherName.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      toast.success("Đã cập nhật thông tin năm học");
      handleCancelEdit();
    } catch {
      toast.error("Không thể cập nhật");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteYear = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const id = confirmDelete.id;
      const [g, c] = await Promise.all([
        getDocs(
          query(
            collection(db, "semesterGrades"),
            where("semesterId", "==", id),
          ),
        ),
        getDocs(
          query(
            collection(db, "semesterComments"),
            where("semesterId", "==", id),
          ),
        ),
      ]);
      await deleteInChunks([...g.docs, ...c.docs]);
      const batch = writeBatch(db);
      batch.delete(doc(db, "semesters", id));
      await batch.commit();
      setSelectedId("");
      if (editingId === id) handleCancelEdit();
      toast.success("Đã xóa năm học!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xóa năm học");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  /* ---------- Nhập đánh giá ---------- */

  const markDirty = (ids: string[]) => {
    ids.forEach((id) => dirtyRef.current.add(id));
    setDirty(new Set(dirtyRef.current));
  };

  const updateData = (sid: string, fn: (d: StudentData) => StudentData) => {
    if (locked) return;
    setData((prev) => ({ ...prev, [sid]: fn(prev[sid] ?? emptyData()) }));
    markDirty([sid]);
  };

  const patchCell = (sid: string, sub: string, patch: Partial<SubjectCell>) =>
    updateData(sid, (d) => withCell(d, sub, period, patch));

  const setTraitLevel = (sid: string, trait: string, v: TraitLevel) =>
    updateData(sid, (d) => withTrait(d, trait, period, v));

  const setNote = (sid: string, v: string) =>
    updateData(sid, (d) => withNote(d, period, v));

  const focusScore = (c: number, r: number) => {
    const el = tableRef.current?.querySelector<HTMLInputElement>(
      `[data-score="${c}-${r}"]`,
    );
    if (el) {
      el.focus();
      el.select();
    }
  };

  // Dán một cột điểm từ Excel vào môn tương ứng, điền từ học sinh đang chọn trở xuống
  const pasteScores = (sub: string, start: number, text: string) => {
    if (locked) return;
    const lines = text.replace(/\r/g, "").split("\n");
    if (lines[lines.length - 1].trim() === "") lines.pop();
    const updates: Record<string, StudentData> = {};
    let invalid = 0;
    lines.forEach((raw, i) => {
      const st = filteredStudents[start + i];
      const v = raw.split("\t")[0].trim();
      if (!st || v === "") return;
      if (parseScore(v) === null) {
        invalid++;
        return;
      }
      updates[st.id] = withCell(
        updates[st.id] ?? data[st.id] ?? emptyData(),
        sub,
        period,
        { score: v },
      );
    });
    const ids = Object.keys(updates);
    if (ids.length > 0) {
      setData((prev) => ({ ...prev, ...updates }));
      markDirty(ids);
    }
    if (invalid > 0)
      toast.warning(`${invalid} ô bị bỏ qua vì không phải số nguyên 0-10`);
  };

  const handleSave = async () => {
    if (!year || dirty.size === 0) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      dirty.forEach((sid) => {
        const st = students.find((s) => s.id === sid);
        if (!st) return;
        const stored = toStored(data[sid] ?? emptyData());
        batch.set(doc(db, "semesterGrades", `${year.id}_${sid}`), {
          semesterId: year.id,
          studentId: sid,
          name: st.name,
          group: st.group || "",
          subjects: stored.subjects,
          traits: stored.traits,
          notes: stored.notes,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      dirtyRef.current = new Set();
      setDirty(new Set());
      toast.success("Đã lưu đánh giá!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu đánh giá");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Xuất Excel ---------- */

  const handleExport = async () => {
    if (!year) return;
    try {
      const blob = await buildAssessmentWorkbook({
        yearName: year.name,
        className: year.className,
        schoolName: year.schoolName,
        teacherName: year.teacherName,
        period,
        subjects: subjectList,
        students,
        data,
        comments,
      });
      saveBlob(blob, `Danh-gia-${fileSafe(year.name)}-${getTodayKey()}.xlsx`);
      toast.success("Đã xuất bảng tổng hợp!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể xuất file Excel");
    }
  };

  /* ---------- Nhập từ Excel / dán ---------- */

  const runImport = (
    items: { period: PeriodKey; rows: ImportRow[] }[],
    invalid: number,
  ) => {
    if (locked) return false;
    const merged: Record<string, StudentData> = {};
    let matched = 0;
    const unmatched: string[] = [];

    items.forEach(({ period: p, rows }) => {
      const r = applyImport({ ...data, ...merged }, students, p, rows);
      Object.assign(merged, r.updates);
      matched += r.matched;
      unmatched.push(...r.unmatched);
    });

    const ids = Object.keys(merged);
    if (ids.length === 0) {
      toast.warning("Không có dữ liệu nào khớp với danh sách học sinh");
      return false;
    }
    setData((prev) => ({ ...prev, ...merged }));
    markDirty(ids);
    toast.success(
      `Đã nhập ${matched} học sinh. Hãy kiểm tra, sửa nếu cần rồi bấm "Lưu đánh giá"!`,
    );
    if (unmatched.length > 0)
      toast.warning(
        `${unmatched.length} dòng không khớp tên: ${unmatched
          .slice(0, 3)
          .join(", ")}${unmatched.length > 3 ? "..." : ""}`,
      );
    if (invalid > 0)
      toast.warning(`${invalid} ô bị bỏ qua vì giá trị không hợp lệ`);
    return true;
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || locked) return;
    setImporting(true);
    try {
      const sheets = await parseWorkbook(await file.arrayBuffer(), subjectList);
      if (sheets.length === 0) {
        toast.error("Không nhận ra bảng đánh giá trong file này");
        return;
      }
      let items = sheets
        .filter((s) => s.period)
        .map((s) => ({ period: s.period as PeriodKey, rows: s.rows }));
      let invalid = sheets.reduce((a, s) => a + (s.period ? s.invalid : 0), 0);
      // Không sheet nào có tên GK1/CK1/GK2/CN: nhập sheet đầu tiên vào mốc đang chọn
      if (items.length === 0) {
        items = [{ period, rows: sheets[0].rows }];
        invalid = sheets[0].invalid;
      }
      if (
        runImport(items, invalid) &&
        !items.some((i) => i.period === period)
      ) {
        setPeriod(items[0].period);
        setPicked(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không đọc được file Excel");
    } finally {
      setImporting(false);
    }
  };

  /* ---------- Nhận xét ---------- */

  const markCommentDirty = (key: string) => {
    dirtyCommentsRef.current.add(key);
    setDirtyComments(new Set(dirtyCommentsRef.current));
  };

  const setCommentText = (sid: string, text: string) => {
    if (locked) return;
    const key = ckey(sid, period);
    setComments((prev) => ({
      ...prev,
      [key]: { text, source: "manual", status: "draft" },
    }));
    markCommentDirty(key);
  };

  const loadContext = async () => {
    if (!year) throw new Error("no year");
    const today = getTodayKey();
    const endKey = today < year.endDate ? today : year.endDate;
    const cacheKey = `${year.id}|${endKey}`;
    if (ctxRef.current?.key === cacheKey) return ctxRef.current;

    const start = new Date(`${year.startDate}T00:00:00`);
    const end = new Date(`${endKey}T23:59:59`);
    const [logSnap, attSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "activityLog"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
          orderBy("createdAt", "desc"),
        ),
      ),
      getDocs(
        query(
          collection(db, "attendanceRecords"),
          where("date", ">=", year.startDate),
          where("date", "<=", endKey),
        ),
      ),
    ]);
    ctxRef.current = {
      key: cacheKey,
      logs: logSnap.docs.map((d) => d.data() as ActivityLogLite),
      att: attSnap.docs.map((d) => d.data() as AttendanceLite),
    };
    return ctxRef.current;
  };

  const generateComment = async (st: StudentItem, p: PeriodKey) => {
    if (!year) throw new Error("no year");
    const ctx = await loadContext();

    const grades = subjectList.flatMap((sub) => {
      const c = getCell(data[st.id], sub, p);
      if (c.level === "MIEN") return [];
      const score = hasTest(sub, p) ? parseScore(c.score) : null;
      if (!c.level && score === null) return [];
      return [
        {
          subject: sub,
          level: c.level ? LEVEL_LABEL[c.level] : "",
          score,
        },
      ];
    });

    const traits = TRAITS.map((t) => {
      const v = getTrait(data[st.id], t.key, p);
      return { name: t.key, level: v ? TRAIT_LABEL[v] : "" };
    }).filter((t) => t.level);

    const myLogs = ctx.logs.filter(
      (l) =>
        l.type !== "attendance" &&
        (l.studentId ? l.studentId === st.id : l.name === st.name),
    );
    const plus = myLogs
      .filter((l) => l.delta > 0)
      .reduce((a, l) => a + l.delta, 0);
    const minus = myLogs
      .filter((l) => l.delta < 0)
      .reduce((a, l) => a + l.delta, 0);
    const notable = [...myLogs]
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 12)
      .map((l) => ({ label: l.label, delta: l.delta }));

    const attendance = { absent: 0, late: 0, excused: 0 };
    ctx.att
      .filter((a) => a.studentId === st.id)
      .forEach((a) => {
        if (a.status in attendance)
          attendance[a.status as keyof typeof attendance]++;
      });

    const res = await fetch(`${API_BASE}/api/student-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "semester",
        stage: "primary",
        grade: year.grade || undefined,
        tone,
        semesterName: year.name,
        periodName: periodLabel(p),
        studentName: getGivenName(st.name),
        position: st.position || "",
        grades,
        traits,
        teacherNote: getNote(data[st.id], p),
        stars: st.stars || 0,
        points: { plus, minus, notable },
        attendance,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.comment) throw new Error(json.error || "Lỗi AI");
    return json.comment as string;
  };

  const handleGenerateOne = async (st: StudentItem) => {
    if (locked) return;
    const p = period;
    const key = ckey(st.id, p);
    if (
      comments[key]?.text?.trim() &&
      !window.confirm("Nhận xét hiện tại sẽ bị thay bằng bản AI mới. Tiếp tục?")
    )
      return;
    setAiLoadingId(st.id);
    try {
      const text = await generateComment(st, p);
      setComments((prev) => ({
        ...prev,
        [key]: { text, source: "ai", status: "draft" },
      }));
      markCommentDirty(key);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tạo nhận xét AI, vui lòng thử lại!");
    } finally {
      setAiLoadingId("");
    }
  };

  const handleGenerateAll = async () => {
    if (locked) return;
    const p = period;
    const targets = students.filter(
      (s) => !comments[ckey(s.id, p)]?.text?.trim(),
    );
    if (targets.length === 0) {
      toast.warning("Tất cả học sinh đã có nhận xét ở mốc này");
      return;
    }
    cancelBatchRef.current = false;
    setBatchProgress({ done: 0, total: targets.length });
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      if (cancelBatchRef.current) break;
      try {
        const text = await generateComment(targets[i], p);
        const key = ckey(targets[i].id, p);
        setComments((prev) => ({
          ...prev,
          [key]: { text, source: "ai", status: "draft" },
        }));
        markCommentDirty(key);
      } catch {
        failed++;
      }
      setBatchProgress({ done: i + 1, total: targets.length });
    }
    setBatchProgress(null);
    if (failed > 0) toast.warning(`${failed} học sinh tạo lỗi, hãy thử lại`);
    else toast.success("Đã tạo xong nhận xét. Hãy xem lại rồi lưu!");
  };

  const handleToggleFinal = (sid: string) => {
    if (locked) return;
    const key = ckey(sid, period);
    setComments((prev) => {
      const cur = prev[key];
      if (!cur?.text.trim()) return prev;
      return {
        ...prev,
        [key]: { ...cur, status: cur.status === "final" ? "draft" : "final" },
      };
    });
    markCommentDirty(key);
  };

  const handleSaveComments = async () => {
    if (!year || dirtyComments.size === 0) return;
    setSavingComments(true);
    try {
      const batch = writeBatch(db);
      dirtyComments.forEach((key) => {
        const [sid, p] = key.split("|");
        const st = students.find((s) => s.id === sid);
        const c = comments[key];
        if (!st || !c) return;
        batch.set(doc(db, "semesterComments", `${year.id}_${sid}_${p}`), {
          semesterId: year.id,
          studentId: sid,
          period: p,
          name: st.name,
          text: c.text,
          source: c.source,
          status: c.status,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
      dirtyCommentsRef.current = new Set();
      setDirtyComments(new Set());
      toast.success("Đã lưu nhận xét!");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu nhận xét");
    } finally {
      setSavingComments(false);
    }
  };

  const activeStudent =
    students.find((s) => s.id === activeStudentId) ?? students[0];
  const activeKey = activeStudent ? ckey(activeStudent.id, period) : "";

  /* ======================= Giao diện ======================= */

  const tabBtn = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
        tab === key
          ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
          : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
      }`}
    >
      {label}
    </button>
  );

  const periodPills = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-bold text-amber-800 shrink-0">Mốc:</span>
      {PERIODS.map((p) => {
        const on = picked && period === p.key;
        return (
          <button
            key={p.key}
            type="button"
            disabled={batchProgress !== null}
            onClick={() => {
              if (on) {
                setPicked(false);
                setExpanded(false);
              } else {
                setPeriod(p.key);
                setPicked(true);
              }
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-full border cursor-pointer transition-all disabled:opacity-60 disabled:cursor-default ${
              on
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );

  const needPeriod = (
    <p className="text-xs text-slate-400 text-center py-10">
      Hãy chọn một mốc ở trên để bắt đầu.
    </p>
  );

  const needYear = (
    <p className="text-xs text-slate-400 text-center py-10">
      Chưa có năm học nào. Hãy tạo năm học ở tab &quot;Năm học&quot; trước.
    </p>
  );

  const saveLabel = (n: number, base: string, busy: boolean) =>
    busy ? "Đang lưu..." : n > 0 ? `${base} (${n})` : base;

  const exportBtn = (
    <button type="button" onClick={handleExport} className={BTN_GREEN}>
      Xuất Excel
    </button>
  );

  return (
    <div className="bg-white p-6 rounded-3xl border border-amber-200 shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold m-0 text-slate-800">
            Đánh giá học sinh theo năm học
          </h2>
        </div>

        {years.length > 0 && (
          <select
            value={year?.id || ""}
            disabled={batchProgress !== null}
            onChange={(e) => handleSelectYear(e.target.value)}
            className={`${SELECT} w-full sm:w-64`}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.status === "closed" ? "(đã chốt)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("years", "Năm học")}
        {tabBtn("grid", "Bảng đánh giá")}
        {tabBtn("comments", "Nhận xét")}
      </div>

      {locked && tab !== "years" && (
        <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 m-0">
          Năm học này đã chốt nên chỉ xem được. Vào tab &quot;Năm học&quot; để
          mở lại nếu cần sửa.
        </p>
      )}

      {/* ============ TAB: NĂM HỌC ============ */}
      {tab === "years" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-amber-50/40 p-5 rounded-3xl border border-amber-100/60 space-y-3 text-xs">
            <h3 className="text-sm font-extrabold text-slate-800 m-0">
              {editingId ? "Sửa thông tin năm học" : "Tạo năm học mới"}
            </h3>
            <div>
              <label className="font-semibold text-slate-600 block mb-1">
                Tên năm học *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Lớp
                </label>
                <input
                  type="text"
                  value={form.className}
                  placeholder="VD: 4A4"
                  onChange={(e) =>
                    setForm({ ...form, className: e.target.value })
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Trường
                </label>
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) =>
                    setForm({ ...form, schoolName: e.target.value })
                  }
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-600 block mb-1">
                Giáo viên chủ nhiệm
              </label>
              <input
                type="text"
                value={form.teacherName}
                onChange={(e) =>
                  setForm({ ...form, teacherName: e.target.value })
                }
                className={INPUT}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-600 block mb-1">
                Khối lớp
              </label>
              <select
                value={form.grade}
                disabled={!!editingId}
                onChange={(e) =>
                  setForm({ ...form, grade: Number(e.target.value) })
                }
                className={`${SELECT} w-full`}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Lớp {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Bắt đầu *
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                  className={INPUT}
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Kết thúc *
                </label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                  className={INPUT}
                />
              </div>
            </div>
            {editingId ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={creating}
                  className={`${BTN} flex-1 py-2.5 bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200`}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={creating}
                  className={`${BTN_AMBER} flex-1 py-2.5`}
                >
                  {creating ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCreateYear}
                disabled={creating}
                className={`${BTN_AMBER} w-full py-2.5`}
              >
                {creating ? "Đang tạo..." : "Tạo năm học"}
              </button>
            )}
          </div>

          <div className="lg:col-span-7 space-y-2">
            {years.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">
                Chưa có năm học nào.
              </p>
            ) : (
              years.map((y) => {
                const isActive = y.id === year?.id;
                return (
                  <div
                    key={y.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border px-4 py-3 ${
                      isActive
                        ? "bg-amber-50/60 border-amber-300"
                        : "bg-slate-50/70 border-slate-200/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm m-0 truncate">
                        {y.name}
                        {y.grade ? ` - Lớp ${y.grade}` : ""}
                        {y.className ? ` (${y.className})` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                        {formatDMY(y.startDate)} – {formatDMY(y.endDate)}
                        {y.schoolName ? ` · ${y.schoolName}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          y.status === "closed"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {y.status === "closed" ? "Đã chốt" : "Đang diễn ra"}
                      </span>
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSelectYear(y.id)}
                          className="px-3 py-1.5 text-[11px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:border-amber-300 cursor-pointer"
                        >
                          Chọn
                        </button>
                      )}
                      {isActive && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditInfo(y)}
                            disabled={editingId === y.id}
                            className="px-3 py-1.5 text-[11px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg hover:border-amber-300 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {editingId === y.id
                              ? "Đang sửa..."
                              : "Sửa lớp/trường"}
                          </button>
                          <button
                            type="button"
                            onClick={handleToggleStatus}
                            className="px-3 py-1.5 text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all cursor-pointer"
                          >
                            {y.status === "closed" ? "Mở lại" : "Chốt năm học"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(y)}
                        title="Xóa năm học"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============ TAB: BẢNG ĐÁNH GIÁ (giống file Excel) ============ */}
      {tab === "grid" &&
        (!year ? (
          needYear
        ) : (
          <div
            className={
              expanded
                ? "fixed inset-0 z-50 bg-white p-4 flex flex-col gap-3"
                : "space-y-4"
            }
          >
            {periodPills}

            {picked ? (
              <>
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm học sinh..."
                    className={SEARCH}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xlsm"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                    <button
                      type="button"
                      disabled={inputsOff || importing}
                      onClick={() => fileRef.current?.click()}
                      className={BTN_INDIGO}
                    >
                      {importing ? "Đang đọc..." : "Nhập file Excel"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      className={BTN_SOFT}
                    >
                      {expanded ? "✕ Thu nhỏ" : "⛶ Phóng to"}
                    </button>
                    {exportBtn}
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={locked || dirty.size === 0 || saving}
                      className={BTN_AMBER}
                    >
                      {saveLabel(dirty.size, "Lưu đánh giá", saving)}
                    </button>
                  </div>
                </div>

                <p
                  className={`text-[11px] text-slate-400 m-0 ${
                    expanded ? "hidden" : ""
                  }`}
                >
                  Môn: T = Hoàn thành tốt · H = Hoàn thành · C = Chưa hoàn thành
                  · Miễn = được miễn theo kế hoạch giáo dục cá nhân. Phẩm chất,
                  năng lực: T = Tốt · Đ = Đạt · C = Cần cố gắng. Điểm KTĐK là số
                  nguyên 0-10: có thể dán cả cột điểm từ Excel vào ô đầu tiên,
                  hoặc dùng Enter và mũi tên để xuống ô dưới.
                </p>

                <div
                  ref={tableRef}
                  className={`border border-slate-300 rounded-xl overflow-auto ${
                    expanded ? "flex-1 min-h-0" : "max-h-[80vh]"
                  }`}
                >
                  <table className="border-collapse text-xs">
                    <thead className="sticky top-0 z-30">
                      <tr>
                        <th
                          rowSpan={3}
                          className={`${TH_X} sticky left-0`}
                          style={{ minWidth: 48, width: 48 }}
                        >
                          STT
                        </th>
                        <th
                          rowSpan={3}
                          className={`${TH_X} sticky text-left!`}
                          style={{ left: 48, minWidth: 200 }}
                        >
                          HỌ VÀ TÊN HỌC SINH
                        </th>
                        <th rowSpan={3} className={`${TH_X} w-20`}>
                          Ngày, tháng, năm sinh
                        </th>
                        <th rowSpan={3} className={`${TH_X} w-8`}>
                          Nữ
                        </th>
                        <th colSpan={subjSpan} className={TH_X}>
                          Môn học và hoạt động giáo dục
                        </th>
                        <th
                          colSpan={traitsOf("Phẩm chất").length}
                          className={TH_X}
                        >
                          {TRAIT_GROUP_TITLE["Phẩm chất"]}
                        </th>
                        <th colSpan={coreTraits.length} className={TH_X}>
                          Năng lực cốt lõi
                        </th>
                        <th rowSpan={3} className={`${TH_X} min-w-48`}>
                          Ghi chú
                        </th>
                      </tr>
                      <tr>
                        {subjCols.map(({ sub, tested }) => (
                          <th
                            key={sub}
                            colSpan={tested ? 2 : 1}
                            className={TH_S}
                            style={{ minWidth: tested ? 120 : 60 }}
                          >
                            {subjectShort(sub)}
                          </th>
                        ))}
                        {traitsOf("Phẩm chất").map((t) => (
                          <th
                            key={t.key}
                            rowSpan={2}
                            className={TH_S}
                            style={{ minWidth: 64 }}
                          >
                            {t.key}
                          </th>
                        ))}
                        {(["Năng lực chung", "Năng lực đặc thù"] as const).map(
                          (g) => (
                            <th
                              key={g}
                              colSpan={traitsOf(g).length}
                              className={TH_X}
                            >
                              {TRAIT_GROUP_TITLE[g]}
                            </th>
                          ),
                        )}
                      </tr>
                      <tr>
                        {subjCols.map(({ sub, tested }) => (
                          <FragmentCells key={sub} tested={tested} />
                        ))}
                        {coreTraits.map((t) => (
                          <th
                            key={t.key}
                            className={TH_S}
                            style={{ minWidth: 64 }}
                          >
                            {t.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5 + subjSpan + TRAITS.length}
                            className="text-center text-slate-400 py-8"
                          >
                            Không tìm thấy học sinh phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((st, r) => {
                          const d = data[st.id];
                          return (
                            <tr
                              key={st.id}
                              className={
                                dirty.has(st.id)
                                  ? "bg-amber-50/50"
                                  : "hover:bg-slate-50/80"
                              }
                            >
                              <td
                                className={`${TD_X} sticky left-0 z-10 bg-white text-slate-500`}
                                style={{ minWidth: 48 }}
                              >
                                {r + 1}
                              </td>
                              <td
                                className={`${TD_X} sticky z-10 bg-white text-left! px-2 font-medium text-slate-800 whitespace-nowrap`}
                                style={{ left: 48, minWidth: 200 }}
                              >
                                {st.name}
                              </td>
                              <td className={`${TD_X} text-slate-600`}>
                                {st.birthDate}
                              </td>
                              <td className={`${TD_X} font-bold`}>
                                {st.female ? "X" : ""}
                              </td>

                              {subjCols.map(({ sub, tested }, ci) => {
                                const c = getCell(d, sub, period);
                                return (
                                  <FragmentCells key={sub} body>
                                    <td className={TD_X}>
                                      <select
                                        value={c.level}
                                        disabled={inputsOff}
                                        title={
                                          c.level
                                            ? LEVEL_LABEL[c.level]
                                            : undefined
                                        }
                                        onChange={(e) =>
                                          patchCell(st.id, sub, {
                                            level: e.target.value as
                                              | ""
                                              | LevelKey,
                                          })
                                        }
                                        className={`${CELL_INPUT} w-16 cursor-pointer font-bold ${
                                          c.level === "MIEN"
                                            ? "text-[11px]"
                                            : ""
                                        } ${c.level ? LEVEL_STYLE[c.level].on : ""}`}
                                      >
                                        <option value="">-</option>
                                        {LEVELS.map((l) => (
                                          <option key={l.key} value={l.key}>
                                            {l.key === "MIEN"
                                              ? "M"
                                              : LEVEL_CODE[l.key]}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    {tested && (
                                      <td className={TD_X}>
                                        <input
                                          data-score={`${ci}-${r}`}
                                          type="text"
                                          inputMode="numeric"
                                          value={c.score}
                                          disabled={
                                            inputsOff || c.level === "MIEN"
                                          }
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const v = e.target.value
                                              .replace(/\D/g, "")
                                              .slice(0, 2);
                                            if (v === "" || +v <= 10)
                                              patchCell(st.id, sub, {
                                                score: v,
                                              });
                                          }}
                                          onPaste={(e) => {
                                            const text =
                                              e.clipboardData.getData("text");
                                            if (!/[\n\t]/.test(text.trim()))
                                              return;
                                            e.preventDefault();
                                            pasteScores(sub, r, text);
                                          }}
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" ||
                                              e.key === "ArrowDown"
                                            ) {
                                              e.preventDefault();
                                              focusScore(ci, r + 1);
                                            } else if (e.key === "ArrowUp") {
                                              e.preventDefault();
                                              focusScore(ci, r - 1);
                                            }
                                          }}
                                          className={`${CELL_INPUT} w-16 text-center font-semibold`}
                                        />
                                      </td>
                                    )}
                                  </FragmentCells>
                                );
                              })}

                              {TRAITS.map((t) => {
                                const v = getTrait(d, t.key, period);
                                return (
                                  <td key={t.key} className={TD_X}>
                                    <select
                                      value={v}
                                      disabled={inputsOff}
                                      title={v ? TRAIT_LABEL[v] : undefined}
                                      onChange={(e) =>
                                        setTraitLevel(
                                          st.id,
                                          t.key,
                                          toTraitLevel(e.target.value),
                                        )
                                      }
                                      className={`${CELL_INPUT} w-14 cursor-pointer font-bold ${
                                        v === "C"
                                          ? "bg-rose-500 text-white border-rose-500"
                                          : v === "T"
                                            ? "bg-emerald-500 text-white border-emerald-500"
                                            : v === "D"
                                              ? "bg-sky-500 text-white border-sky-500"
                                              : ""
                                      }`}
                                    >
                                      <option value="">-</option>
                                      {(["T", "D", "C"] as const).map((k) => (
                                        <option key={k} value={k}>
                                          {TRAIT_CODE[k]}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              })}

                              <td className={TD_X}>
                                <input
                                  type="text"
                                  value={getNote(d, period)}
                                  disabled={inputsOff}
                                  onChange={(e) =>
                                    setNote(st.id, e.target.value)
                                  }
                                  placeholder="Ghi chú..."
                                  className={`${CELL_INPUT} w-full min-w-64`}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              needPeriod
            )}
          </div>
        ))}

      {/* ============ TAB: NHẬN XÉT (AI) ============ */}
      {tab === "comments" &&
        (!year ? (
          needYear
        ) : (
          <div className="space-y-4">
            {periodPills}

            {picked ? (
              <>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-amber-800 shrink-0">
                      Giọng văn:
                    </span>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value as CommentTone)}
                      className={`${SELECT} w-full max-w-xs`}
                    >
                      {(Object.keys(TONE_LABEL) as CommentTone[]).map((k) => (
                        <option key={k} value={k}>
                          {TONE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {batchProgress ? (
                      <button
                        type="button"
                        onClick={() => (cancelBatchRef.current = true)}
                        className={BTN_ROSE}
                      >
                        Dừng ({batchProgress.done}/{batchProgress.total})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleGenerateAll}
                        disabled={locked || aiLoadingId !== ""}
                        className={BTN_INDIGO}
                      >
                        ✨ Tạo cho cả lớp
                      </button>
                    )}
                    {exportBtn}
                    <button
                      type="button"
                      onClick={handleSaveComments}
                      disabled={
                        locked ||
                        dirtyComments.size === 0 ||
                        savingComments ||
                        batchProgress !== null
                      }
                      className={BTN_AMBER}
                    >
                      {saveLabel(
                        dirtyComments.size,
                        "Lưu nhận xét",
                        savingComments,
                      )}
                    </button>
                  </div>
                </div>

                {batchProgress && (
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all"
                      style={{
                        width: `${(batchProgress.done / batchProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-4 border border-slate-200 rounded-xl overflow-y-auto max-h-[60vh] divide-y divide-slate-100">
                    {students.map((s) => {
                      const key = ckey(s.id, period);
                      const c = comments[key];
                      const isActive = s.id === activeStudent?.id;
                      const dot = !c?.text
                        ? "bg-slate-200"
                        : c.status === "final"
                          ? "bg-emerald-500"
                          : "bg-amber-400";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveStudentId(s.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs cursor-pointer transition-colors ${
                            isActive ? "bg-amber-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="font-semibold text-slate-800 truncate">
                            {s.name}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {dirtyComments.has(key) && (
                              <span className="text-[10px] font-bold text-amber-600">
                                chưa lưu
                              </span>
                            )}
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${dot}`}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-8 space-y-3">
                    {activeStudent && (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-extrabold text-slate-800 m-0">
                            {activeStudent.name} - {periodLabel(period)}
                          </h3>
                          <span className="text-[11px] text-slate-400">
                            {comments[activeKey]?.source === "ai"
                              ? "Bản nháp từ AI"
                              : comments[activeKey]?.text
                                ? "Đã chỉnh tay"
                                : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {subjectList.map((sub) => {
                            const c = getCell(
                              data[activeStudent.id],
                              sub,
                              period,
                            );
                            if (!c.level) return null;
                            const score = hasTest(sub, period)
                              ? parseScore(c.score)
                              : null;
                            return (
                              <span
                                key={sub}
                                className={`text-[11px] font-bold border rounded-full px-2.5 py-0.5 ${LEVEL_STYLE[c.level].chip}`}
                              >
                                {subjectShort(sub)}:{" "}
                                {LEVELS.find((l) => l.key === c.level)?.short}
                                {score !== null ? ` (${score}đ)` : ""}
                              </span>
                            );
                          })}
                          {TRAITS.filter(
                            (t) =>
                              getTrait(
                                data[activeStudent.id],
                                t.key,
                                period,
                              ) === "C",
                          ).map((t) => (
                            <span
                              key={t.key}
                              className="text-[11px] font-bold border rounded-full px-2.5 py-0.5 bg-rose-50 text-rose-700 border-rose-200"
                            >
                              {t.key}: cần cố gắng
                            </span>
                          ))}
                        </div>

                        <textarea
                          rows={9}
                          value={comments[activeKey]?.text || ""}
                          disabled={
                            locked ||
                            savingComments ||
                            aiLoadingId === activeStudent.id
                          }
                          onChange={(e) =>
                            setCommentText(activeStudent.id, e.target.value)
                          }
                          placeholder="Nhập nhận xét hoặc bấm “Tạo bằng AI”..."
                          className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-400 resize-y leading-relaxed disabled:bg-slate-50"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleGenerateOne(activeStudent)}
                            disabled={
                              locked ||
                              aiLoadingId !== "" ||
                              batchProgress !== null ||
                              comments[activeKey]?.status === "final"
                            }
                            title={
                              comments[activeKey]?.status === "final"
                                ? "Hãy bỏ chốt trước khi tạo lại"
                                : undefined
                            }
                            className={BTN_INDIGO}
                          >
                            ✨{" "}
                            {aiLoadingId === activeStudent.id
                              ? "AI đang viết..."
                              : comments[activeKey]?.text
                                ? "Tạo lại bằng AI"
                                : "Tạo bằng AI"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleFinal(activeStudent.id)}
                            disabled={
                              locked || !comments[activeKey]?.text?.trim()
                            }
                            className={BTN_SOFT}
                          >
                            {comments[activeKey]?.status === "final"
                              ? "Bỏ chốt"
                              : "Chốt nhận xét"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const t = comments[activeKey]?.text;
                              if (!t) return;
                              navigator.clipboard.writeText(t);
                              toast.success("Đã sao chép nhận xét!");
                            }}
                            disabled={!comments[activeKey]?.text}
                            className={`${BTN} bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200`}
                          >
                            Sao chép
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 m-0">
                  Chấm xám: chưa có · vàng: bản nháp · xanh: đã chốt. Mỗi mốc
                  lưu một nhận xét riêng. &quot;Tạo cho cả lớp&quot; chỉ viết
                  cho học sinh chưa có nhận xét ở mốc đang chọn. AI chỉ nhận tên
                  gọi, mức đạt, điểm, ghi chú, điểm danh và lịch sử cộng trừ
                  điểm từ đầu năm đến hôm nay, không nhận SĐT hay thông tin cá
                  nhân. Hãy đọc lại trước khi chốt.
                </p>
              </>
            ) : (
              needPeriod
            )}
          </div>
        ))}

      {/* POPUP XÁC NHẬN XÓA NĂM HỌC */}
      {confirmDelete && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa năm học này?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                <strong className="text-slate-800">
                  &quot;{confirmDelete.name}&quot;
                </strong>{" "}
                cùng toàn bộ đánh giá và nhận xét của năm học này sẽ bị xóa.
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteYear}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper nhỏ để dựng các ô theo cặp "Mức đạt được | Điểm KTĐK":
 * - Ở đầu bảng (không có `body`): trả về ô tiêu đề dòng 3.
 * - Ở thân bảng (`body`): chỉ bọc children.
 */
function FragmentCells({
  tested,
  body,
  children,
}: {
  tested?: boolean;
  body?: boolean;
  children?: React.ReactNode;
}) {
  if (body) return <>{children}</>;
  return (
    <>
      <th className={TH_S}>Mức</th>
      {tested && <th className={TH_S}>Điểm</th>}
    </>
  );
}
