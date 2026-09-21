"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  getDocs,
  where,
  writeBatch,
} from "firebase/firestore";
import { StudentItem, WinnerHistoryItem, DEFAULT_SUBJECTS } from "@/lib/types";

// Đổi tên môn học thành id an toàn để dùng làm document id trên Firestore
// (Firestore không cho phép "/" trong id).
function subjectToDocId(subject: string) {
  return subject.replace(/\//g, "-").trim() || "unknown-subject";
}

interface LuckyDrawContextValue {
  // Firestore source list (all students, unfiltered)
  students: StudentItem[];

  // Subjects
  subjectsList: string[];
  setSubjectsList: React.Dispatch<React.SetStateAction<string[]>>;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  renameSubject: (oldName: string, newName: string) => boolean; // false if name taken
  deleteSubject: (name: string) => void;

  // Active (still-eligible) students for the currently selected subject
  activeStudents: StudentItem[];
  removeStudentFromActive: (studentId: string) => void;
  addManualNames: (rawNames: string) => void;
  fetchDbStudents: () => void;
  resetList: () => void;

  // Winner history (shared across all three tools, đồng bộ qua Firestore)
  winnerHistories: WinnerHistoryItem[];
  addWinnerToHistory: (student: StudentItem, source?: string) => void;
  clearHistoryForSelectedSubject: () => void;

  // Cross-tool draw lock — prevents two draws firing at once even if the
  // user double-clicks or switches tabs mid-animation.
  isDrawing: boolean;
  beginDraw: () => boolean; // returns false if a draw is already in progress
  endDraw: () => void;
}

const LuckyDrawContext = createContext<LuckyDrawContextValue | null>(null);

export function LuckyDrawProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>(DEFAULT_SUBJECTS);
  const [selectedSubject, setSelectedSubjectState] = useState(
    DEFAULT_SUBJECTS[0],
  );

  const [activeStudentsBySubject, setActiveStudentsBySubject] = useState<
    Record<string, StudentItem[]>
  >({});

  const [winnerHistories, setWinnerHistories] = useState<WinnerHistoryItem[]>(
    [],
  );

  // --- Đồng bộ lịch sử trúng thưởng qua Firestore (real-time) ----------
  useEffect(() => {
    const q = query(
      collection(db, "luckyDrawHistory"),
      orderBy("sortKey", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          studentName: data.studentName,
          subject: data.subject,
          timestamp: data.timestamp,
          source: data.source,
        } as WinnerHistoryItem;
      });
      setWinnerHistories(list);
    });
    return () => unsubscribe();
  }, []);

  // --- Đồng bộ danh sách "còn lại trong vòng quay" theo từng môn học ---
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "luckyDrawActiveList"),
      (snapshot) => {
        setActiveStudentsBySubject((prev) => {
          const updated = { ...prev };
          snapshot.docChanges().forEach((change) => {
            const subjectName = change.doc.data().subjectName as string;
            if (change.type === "removed") {
              delete updated[subjectName];
            } else {
              updated[subjectName] = (change.doc.data().students ||
                []) as StudentItem[];
            }
          });
          return updated;
        });
      },
    );
    return () => unsubscribe();
  }, []);

  // Firestore subscription — populated once, shared by every tool.
  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as StudentItem[];
      setStudents(list);

      // Với môn học nào chưa có danh sách "còn lại" trên Firestore,
      // khởi tạo bằng toàn bộ học sinh.
      for (const sub of subjectsList) {
        setActiveStudentsBySubject((prev) => {
          if (!prev[sub] || prev[sub].length === 0) {
            setDoc(doc(db, "luckyDrawActiveList", subjectToDocId(sub)), {
              subjectName: sub,
              students: list,
            }).catch((e) => console.error(e));
          }
          return prev;
        });
      }
    });
    return () => unsubscribe();
  }, [subjectsList]);

  const setSelectedSubject = useCallback((subject: string) => {
    setSelectedSubjectState(subject);
  }, []);

  const renameSubject = useCallback(
    (oldName: string, newName: string): boolean => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return true;
      if (subjectsList.includes(trimmed)) return false;

      setSubjectsList((prev) =>
        prev.map((sub) => (sub === oldName ? trimmed : sub)),
      );

      const oldList = activeStudentsBySubject[oldName] || [];
      setDoc(doc(db, "luckyDrawActiveList", subjectToDocId(trimmed)), {
        subjectName: trimmed,
        students: oldList,
      }).catch((e) => console.error(e));
      import("firebase/firestore").then(({ deleteDoc: del }) =>
        del(doc(db, "luckyDrawActiveList", subjectToDocId(oldName))).catch(
          (e) => console.error(e),
        ),
      );

      setSelectedSubjectState(trimmed);
      return true;
    },
    [subjectsList, activeStudentsBySubject],
  );

  const deleteSubject = useCallback(
    (name: string) => {
      const nextSubjects = subjectsList.filter((s) => s !== name);
      setSubjectsList(nextSubjects);
      import("firebase/firestore").then(({ deleteDoc: del }) =>
        del(doc(db, "luckyDrawActiveList", subjectToDocId(name))).catch((e) =>
          console.error(e),
        ),
      );
      setSelectedSubjectState(nextSubjects[0] || "Môn học");
    },
    [subjectsList],
  );

  const activeStudents = activeStudentsBySubject[selectedSubject] || [];

  const saveActiveList = useCallback((subject: string, list: StudentItem[]) => {
    setDoc(doc(db, "luckyDrawActiveList", subjectToDocId(subject)), {
      subjectName: subject,
      students: list,
    }).catch((e) => console.error(e));
  }, []);

  const removeStudentFromActive = useCallback(
    (studentId: string) => {
      const currentList = activeStudentsBySubject[selectedSubject] || [];
      const nextList = currentList.filter((s) => s.id !== studentId);
      saveActiveList(selectedSubject, nextList);
    },
    [selectedSubject, activeStudentsBySubject, saveActiveList],
  );

  const addManualNames = useCallback(
    (rawNames: string) => {
      if (!rawNames.trim()) return;
      const lines = rawNames
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      const newItems: StudentItem[] = lines.map((name, idx) => ({
        id: `manual-${Date.now()}-${idx}`,
        name,
        group: "Nhóm thủ công",
      }));

      const currentList = activeStudentsBySubject[selectedSubject] || [];
      saveActiveList(selectedSubject, [...currentList, ...newItems]);
    },
    [selectedSubject, activeStudentsBySubject, saveActiveList],
  );

  const fetchDbStudents = useCallback(() => {
    saveActiveList(selectedSubject, students);
  }, [selectedSubject, students, saveActiveList]);

  const resetList = fetchDbStudents;

  const addWinnerToHistory = useCallback(
    (student: StudentItem, source?: string) => {
      const now = new Date();
      const dateString = `${String(now.getDate()).padStart(2, "0")}/${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}/${now.getFullYear()}`;

      addDoc(collection(db, "luckyDrawHistory"), {
        studentName: student.name,
        subject: selectedSubject,
        timestamp: dateString,
        source: source || null,
        sortKey: Date.now(),
      }).catch((e) => console.error(e));
    },
    [selectedSubject],
  );

  const clearHistoryForSelectedSubject = useCallback(async () => {
    const q = query(
      collection(db, "luckyDrawHistory"),
      where("subject", "==", selectedSubject),
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit().catch((e) => console.error(e));
  }, [selectedSubject]);

  // --- Cross-tool draw lock -------------------------------------------
  const drawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const beginDraw = useCallback((): boolean => {
    if (drawingRef.current) return false;
    drawingRef.current = true;
    setIsDrawing(true);
    return true;
  }, []);

  const endDraw = useCallback(() => {
    drawingRef.current = false;
    setIsDrawing(false);
  }, []);

  const value: LuckyDrawContextValue = {
    students,
    subjectsList,
    setSubjectsList,
    selectedSubject,
    setSelectedSubject,
    renameSubject,
    deleteSubject,
    activeStudents,
    removeStudentFromActive,
    addManualNames,
    fetchDbStudents,
    resetList,
    winnerHistories,
    addWinnerToHistory,
    clearHistoryForSelectedSubject,
    isDrawing,
    beginDraw,
    endDraw,
  };

  return (
    <LuckyDrawContext.Provider value={value}>
      {children}
    </LuckyDrawContext.Provider>
  );
}

export function useLuckyDraw() {
  const ctx = useContext(LuckyDrawContext);
  if (!ctx) {
    throw new Error("useLuckyDraw must be used inside <LuckyDrawProvider>");
  }
  return ctx;
}
