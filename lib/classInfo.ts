import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface ClassInfo {
  className: string; // vd: "3A"
  schoolYear: string; // vd: "2025 - 2026"
  effectiveDate: string; // dạng yyyy-mm-dd (từ <input type="date">)
}

export const DEFAULT_CLASS_INFO: ClassInfo = {
  className: "",
  schoolYear: "",
  effectiveDate: "",
};

/** yyyy-mm-dd -> dd/mm/yyyy */
export const formatVNDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** Tiêu đề dùng cho Excel / PDF */
export const buildTimetableTitle = (info: ClassInfo) => {
  const name = info.className ? ` ${info.className}` : "";
  const date = info.effectiveDate
    ? ` (Áp dụng từ ${formatVNDate(info.effectiveDate)})`
    : "";
  return `THỜI KHÓA BIỂU LỚP${name}${date}`;
};

/** Đọc một lần (dùng khi bấm xuất file) */
export const fetchClassInfo = async (): Promise<ClassInfo> => {
  const snap = await getDoc(doc(db, "settings", "general"));
  return snap.exists()
    ? { ...DEFAULT_CLASS_INFO, ...(snap.data() as Partial<ClassInfo>) }
    : DEFAULT_CLASS_INFO;
};
