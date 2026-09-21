"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import {
  buildWeeklyDeltaMap,
  getMonday,
  getSunday,
  WEEKLY_BASE_POINTS,
} from "@/lib/weeklyScore";

interface StudentItem {
  id?: string;
  name: string;
  group: string;
  gender: string;
  dob?: string;
  nation?: string;
  statusText?: string;
  parentPhone?: string;
  position?: string;
  stars?: number;
  status?: string;
  avatarUrl?: string;
}

interface ActivityLogItem {
  name: string;
  label: string;
  delta: number;
  createdAt?: unknown;
}

interface AdminStudentsProps {
  onUpdated?: () => void;
  onAdded?: () => void;
}

interface CriteriaItem {
  id: string;
  type: "pos" | "neg";
  icon: string;
  label: string;
  points: number;
}

const GROUPS = ["Tổ 1", "Tổ 2", "Tổ 3"];
const POSITIONS = [
  "Chưa cập nhật",
  "Lớp trưởng",
  "Lớp phó học tập",
  "Lớp phó kỷ luật",
  "Tổ trưởng",
  "Thành viên",
];

const STATUS_META: Record<
  string,
  { label: string; active: string; icon: string }
> = {
  present: {
    label: "Có mặt",
    active: "bg-emerald-500 text-white border-emerald-500",
    icon: "✅",
  },
  excused: {
    label: "Có phép",
    active: "bg-sky-500 text-white border-sky-500",
    icon: "🟡",
  },
  absent: {
    label: "Vắng",
    active: "bg-rose-500 text-white border-rose-500",
    icon: "🔴",
  },
  late: {
    label: "Đi muộn",
    active: "bg-amber-500 text-white border-amber-500",
    icon: "🕒",
  },
};

// Màu tượng trưng cho từng tổ - đồng bộ với trang Điểm danh / Thi đua tổ
const GROUP_STYLES: Record<
  string,
  { badgeBg: string; badgeText: string; badgeBorder: string }
> = {
  "Tổ 1": {
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-100",
  },
  "Tổ 2": {
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-100",
  },
  "Tổ 3": {
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-100",
  },
};

// Chuẩn hóa tên tổ về đúng format "Tổ x", bất kể dữ liệu gốc lưu
// hoa/thường/khoảng trắng khác nhau (VD: "tổ 2", "TỔ 2", "Tổ2"...).
const normalizeGroupName = (groupName?: string) => {
  if (!groupName) return "Tổ 1";
  const match = groupName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (num >= 1 && num <= 4) return `Tổ ${num}`;
  }
  return groupName.trim();
};

// Chuẩn hóa giới tính về đúng "Nam"/"Nữ" bất kể dữ liệu gốc viết hoa/thường khác nhau.
const normalizeGenderLabel = (gender?: string) => {
  if (!gender) return "Nam";
  const g = gender.trim().toLowerCase();
  if (g.includes("nữ") || g.includes("nu") || g === "f" || g === "female")
    return "Nữ";
  return "Nam";
};

export default function AdminStudents({
  onUpdated,
  onAdded,
}: AdminStudentsProps) {
  const toast = useToast();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const [editItem, setEditItem] = useState<StudentItem | null>(null);
  const [attendanceModalStudent, setAttendanceModalStudent] =
    useState<StudentItem | null>(null);
  const [infoModalStudent, setInfoModalStudent] = useState<StudentItem | null>(
    null,
  );
  const [historyModalStudent, setHistoryModalStudent] =
    useState<StudentItem | null>(null);
  const [studentLogs, setStudentLogs] = useState<ActivityLogItem[]>([]);

  const [sortBy, setSortBy] = useState<string>("name-asc");

  // Modal Thêm học sinh đầy đủ
  const [addModalOpen, setAddModalOpen] = useState(false);
  // Thêm dòng này vào phần khai báo state của component AdminStudents
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [deleteSearchQuery, setDeleteSearchQuery] = useState("");
  const [newStudentData, setNewStudentData] = useState({
    name: "",
    group: GROUPS[0],
    gender: "Nam",
    dob: "",
    parentPhone: "",
    position: "Chưa cập nhật",
    avatarUrl: "",
    nation: "Kinh",
    statusText: "Đang học",
  });

  // Modal Cộng/Trừ điểm sao
  const [starModal, setStarModal] = useState<{
    type: "plus" | "minus";
    student: StudentItem;
  } | null>(null);
  const [, setCustomReason] = useState("");
  const [, setCustomPoints] = useState<number>(1);

  // Modal Nhập Excel thật
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelPreviewData, setExcelPreviewData] = useState<
    Record<string, unknown>[]
  >([]);

  // Thêm vào trong component của bạn:
  const [criteriaList, setCriteriaList] = useState<CriteriaItem[]>([]);
  const [normalizing, setNormalizing] = useState(false);

  // State cho popup xác nhận xóa 1 học sinh
  const [confirmDeleteStudent, setConfirmDeleteStudent] =
    useState<StudentItem | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(
    null,
  );

  // State cho popup xác nhận xóa hàng loạt học sinh
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Toàn bộ activityLog (dùng để tính "Điểm tuần" 100đ/tuần cho mỗi thẻ học sinh)
  const [weeklyActivityLogs, setWeeklyActivityLogs] = useState<
    { name: string; delta: number; createdAt?: { toDate: () => Date } | null }[]
  >([]);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentItem[]; // Đổi thành StudentItem
      setStudents(studentList);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWeeklyActivityLogs(
        snapshot.docs.map((docSnap) => docSnap.data()) as {
          name: string;
          delta: number;
          createdAt?: { toDate: () => Date } | null;
        }[],
      );
    });
    return () => unsubscribe();
  }, []);

  const weekMonday = useMemo(() => getMonday(new Date()), []);
  const weekSunday = useMemo(() => getSunday(weekMonday), [weekMonday]);
  const weeklyDeltaMap = useMemo(
    () => buildWeeklyDeltaMap(weeklyActivityLogs, weekMonday, weekSunday),
    [weeklyActivityLogs, weekMonday, weekSunday],
  );

  useEffect(() => {
    const q = query(collection(db, "criteria"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as CriteriaItem[];
      setCriteriaList(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        stars: 0,
        status: "present",
        ...docSnap.data(),
      })) as StudentItem[];
      setStudents(data);
    });
    return () => unsubscribe();
  }, []);

  // Lấy lịch sử hoạt động của học sinh khi mở modal lịch sử
  useEffect(() => {
    if (!historyModalStudent) return;
    const q = query(
      collection(db, "activityLog"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs
        .map((docSnap) => docSnap.data() as ActivityLogItem)
        .filter((log) => log.name === historyModalStudent.name);
      setStudentLogs(logs);
    });
    return () => unsubscribe();
  }, [historyModalStudent]);

  const filtered = useMemo(() => {
    const result = students.filter(
      (s) =>
        (groupFilter === "all" ||
          normalizeGroupName(s.group) === groupFilter) &&
        s.name.toLowerCase().includes(search.toLowerCase().trim()),
    );

    result.sort((a, b) => {
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      } else if (sortBy === "group") {
        const groupA = normalizeGroupName(a.group);
        const groupB = normalizeGroupName(b.group);
        if (groupA !== groupB) return groupA.localeCompare(groupB);
        return a.name.localeCompare(b.name);
      } else if (sortBy === "stars-desc") {
        return (b.stars || 0) - (a.stars || 0);
      }
      return 0;
    });

    return result;
  }, [students, search, groupFilter, sortBy]);

  const attendanceCount = useMemo(() => {
    const c = { present: 0, excused: 0, absent: 0, late: 0 };
    students.forEach((s) => {
      if (s.status && s.status in c) c[s.status as keyof typeof c]++;
    });
    return c;
  }, [students]);

  // Tạo hàm tải dữ liệu từ Firestore
  const fetchStudentsData = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "students"));
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudentItem[];
      setStudents(list);
    } catch (error) {
      console.error("Lỗi tải danh sách:", error);
    }
  };

  // Gọi nó trong useEffect khi component vừa load lên
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStudentsData();
  }, []);

  const handleAddStudentFull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentData.name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "students"), {
        name: newStudentData.name.trim(),
        group: newStudentData.group,
        gender: newStudentData.gender,
        stars: 0,
        status: "present",
        avatarUrl: newStudentData.avatarUrl || "",
        dob: newStudentData.dob || "Chưa cập nhật",
        parentPhone: newStudentData.parentPhone || "Chưa cập nhật",
        position: newStudentData.position || "Chưa cập nhật",
        nation: newStudentData.nation || "Kinh",
        statusText: newStudentData.statusText || "Đang học",
        createdAt: serverTimestamp(),
      });
      toast.success(`Đã thêm học sinh "${newStudentData.name.trim()}"!`);
      setNewStudentData({
        name: "",
        group: GROUPS[0] || "",
        gender: "Nam",
        dob: "",
        parentPhone: "",
        position: POSITIONS[0] || "",
        avatarUrl: "",
        nation: "Kinh",
        statusText: "Đang học",
      });
      setAddModalOpen(false);
      if (onAdded) onAdded();
    } catch {
      toast.error("Lỗi khi thêm học sinh");
    } finally {
      setLoading(false);
    }
  };

  // Xóa hàng loạt học sinh (được gọi từ popup xác nhận)
  const handleBatchDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    setBatchDeleting(true);
    try {
      // Xóa đồng thời các học sinh đã chọn trên Firestore
      const count = selectedStudentIds.length;
      await Promise.all(
        selectedStudentIds.map((id) => deleteDoc(doc(db, "students", id))),
      );

      toast.success(`Đã xóa ${count} học sinh khỏi hệ thống!`);
      setDeleteModalOpen(false); // Đóng popup danh sách
      setSelectedStudentIds([]); // Reset danh sách đã chọn
      fetchStudentsData(); // Tải lại bảng dữ liệu
    } catch (error) {
      console.error("Lỗi khi xóa hàng loạt:", error);
      toast.error("Có lỗi xảy ra khi xóa học sinh.");
    } finally {
      setBatchDeleting(false);
      setConfirmBatchDelete(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        const rows = data.slice(6); // Bỏ qua 6 dòng tiêu đề trên cùng

        const formattedStudents = rows
          .map((row) => {
            if (!row) return null;

            // Sửa lại index 3 (Cột D) chính là Họ tên học sinh
            const name = String(row[3] || "").trim();

            if (
              !name ||
              name === "Họ tên" ||
              name === "STT" ||
              name.toLowerCase().includes("người lập biểu") ||
              name.toLowerCase().includes("ký và ghi rõ") ||
              /^\d+$/.test(name)
            ) {
              return null;
            }

            return {
              name: name,
              group: "Tổ 1",
              dob: String(row[4] || ""), // Cột E (index 4): Ngày sinh
              gender: String(row[5] || ""), // Cột F (index 5): Giới tính
              nation: String(row[6] || "Kinh"), // Cột G (index 6): Dân tộc
              statusText: String(row[7] || "Đang học"), // Cột H (index 7): Trạng thái
            };
          })
          .filter(
            (
              s,
            ): s is {
              name: string;
              group: string;
              dob: string;
              gender: string;
              nation: string;
              statusText: string;
            } => s !== null,
          );

        setExcelPreviewData(formattedStudents);
        toast.success(`Đã đọc ${formattedStudents.length} học sinh từ file!`);
      } catch (error) {
        console.error(error);
        toast.error("Không thể đọc file Excel này!");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportExcelToFirebase = async () => {
    if (excelPreviewData.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      excelPreviewData.forEach((row: Record<string, unknown>) => {
        const name = row["name"];
        if (name && String(name).trim() !== "") {
          const ref = doc(collection(db, "students"));
          batch.set(ref, {
            name: String(name).trim(),
            group: String(row["group"] || GROUPS[0]),
            gender: String(row["gender"] || "Nam"),
            dob: String(row["dob"] || "Chưa cập nhật"),
            nation: String(row["nation"] || "Kinh"), // Thêm dân tộc
            statusText: String(row["statusText"] || "Đang học"), // Thêm trạng thái
            stars: 0,
            status: "present",
            avatarUrl: "",
            parentPhone: "Chưa cập nhật",
            position: "Thành viên",
            createdAt: serverTimestamp(),
          });
        }
      });
      await batch.commit();
      setExcelPreviewData([]);
      setExcelModalOpen(false);
      toast.success("Đã nhập danh sách học sinh từ Excel thành công!");
      if (onAdded) onAdded();
    } catch {
      toast.error("Lỗi khi lưu dữ liệu lên hệ thống");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem || !editItem.id) return; // Kiểm tra kỹ id không được undefined

    setLoading(true);
    try {
      const studentRef = doc(db, "students", editItem.id!);
      await updateDoc(studentRef, {
        name: editItem.name,
        group: editItem.group,
        gender: editItem.gender || "Nam",
        dob: editItem.dob || "Chưa cập nhật",
        nation: editItem.nation || "Kinh",
        statusText: editItem.statusText || "Đang học",
        avatarUrl: editItem.avatarUrl || "",
        parentPhone: editItem.parentPhone || "Chưa cập nhật",
        position: editItem.position || "Thành viên",
      });

      toast.success("Cập nhật thành công!");
      setEditItem(null);

      fetchStudentsData();

      if (onUpdated) {
        onUpdated();
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi cập nhật học sinh");
    } finally {
      setLoading(false);
    }
  };

  // Xóa 1 học sinh (được gọi từ popup xác nhận)
  const handleConfirmDeleteStudent = async () => {
    if (!confirmDeleteStudent?.id) return;
    setDeletingStudentId(confirmDeleteStudent.id);
    try {
      await deleteDoc(doc(db, "students", confirmDeleteStudent.id));
      toast.success(`Đã xóa học sinh "${confirmDeleteStudent.name}"!`);
      if (onAdded) onAdded();
    } catch (error) {
      console.error("Lỗi khi xóa học sinh:", error);
      toast.error("Xóa học sinh thất bại, vui lòng thử lại!");
    } finally {
      setDeletingStudentId(null);
      setConfirmDeleteStudent(null);
    }
  };

  // Quét toàn bộ học sinh và ghi lại "group"/"gender" đúng chuẩn ("Tổ x", "Nam"/"Nữ")
  // trực tiếp vào Firestore, chỉ cập nhật những bản ghi đang lưu sai định dạng.
  const handleNormalizeAllStudents = async () => {
    setNormalizing(true);
    try {
      const snapshot = await getDocs(collection(db, "students"));
      const batch = writeBatch(db);
      let changedCount = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as StudentItem;
        const fixedGroup = normalizeGroupName(data.group);
        const fixedGender = normalizeGenderLabel(data.gender);
        const needsFix =
          data.group !== fixedGroup || data.gender !== fixedGender;

        if (needsFix) {
          changedCount++;
          batch.update(doc(db, "students", docSnap.id), {
            group: fixedGroup,
            gender: fixedGender,
          });
        }
      });

      if (changedCount === 0) {
        toast.success(
          "Dữ liệu Tổ & Giới tính đã chuẩn, không cần sửa gì thêm!",
        );
      } else {
        await batch.commit();
        toast.success(`Đã chuẩn hóa ${changedCount} học sinh trong hệ thống!`);
        fetchStudentsData();
      }
    } catch (error) {
      console.error("Lỗi khi chuẩn hóa dữ liệu:", error);
      toast.error("Không thể chuẩn hóa dữ liệu Tổ & Giới tính.");
    } finally {
      setNormalizing(false);
    }
  };

  const handleSetStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "students", id), { status });
      toast.success(
        `Đã cập nhật điểm danh: ${STATUS_META[status]?.label || status}`,
      );
      setAttendanceModalStudent(null);
    } catch {
      toast.error("Không thể cập nhật điểm danh");
    }
  };

  const handleApplyPoints = async (deltaPoints: number, reasonText: string) => {
    if (!starModal) return;
    const { student, type } = starModal;
    const actualDelta =
      type === "plus" ? Math.abs(deltaPoints) : -Math.abs(deltaPoints);
    const nextStars = (student.stars || 0) + actualDelta;

    try {
      if (!student.id) return;
      await updateDoc(doc(db, "students", student.id!), { stars: nextStars });
      await addDoc(collection(db, "activityLog"), {
        name: student.name,
        label: `${actualDelta > 0 ? "Cộng điểm ⭐" : "Trừ điểm ⭐"} (${reasonText})`,
        delta: actualDelta,
        createdAt: serverTimestamp(),
      });
      toast.success(
        `Đã ${actualDelta > 0 ? "cộng" : "trừ"} ${Math.abs(actualDelta)} điểm cho ${student.name}!`,
      );
      setStarModal(null);
      setCustomReason("");
      setCustomPoints(1);
    } catch {
      toast.error("Lỗi khi cập nhật điểm sao");
    }
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    isNew: boolean = false,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isNew) {
          setNewStudentData({
            ...newStudentData,
            avatarUrl: reader.result as string,
          });
        } else if (editItem) {
          setEditItem({ ...editItem, avatarUrl: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl  border border-amber-200  shadow-lg shadow-amber-950/5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2.5 m-0 text-slate-800">
          <svg
            className="text-amber-600 shrink-0"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Học sinh &amp; Điểm danh
        </h2>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Nút Thêm học sinh */}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="shrink-0"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Thêm học sinh
          </button>

          {/* Nút Xóa nhanh */}
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="shrink-0"
              width="16"
              height="16"
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
            Xóa nhanh
          </button>

          {/* Nút Nhập danh sách excel (đã chuẩn mẫu của bạn) */}
          <button
            type="button"
            onClick={() => setExcelModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-import shrink-0"
            >
              <path d="M12 3v12" />
              <path d="m8 11 4 4 4-4" />
              <path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" />
            </svg>
            Nhập danh sách excel
          </button>

          {/* Nút Chuẩn hóa dữ liệu Tổ & Giới tính */}
          <button
            type="button"
            onClick={handleNormalizeAllStudents}
            disabled={normalizing}
            title="Ghi lại đúng định dạng Tổ x / Nam-Nữ cho toàn bộ học sinh trong hệ thống"
            className="px-3.5 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="shrink-0"
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {normalizing ? (
              "Đang chuẩn hóa..."
            ) : (
              <>
                <span className="sm:hidden">Chuẩn hóa</span>
                <span className="hidden sm:inline">
                  Chuẩn hóa Tổ & Giới tính
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-emerald-700 m-0">
            {attendanceCount.present}
          </p>
          <p className="text-[11px] font-semibold text-emerald-700/70 m-0">
            Có mặt
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-sky-700 m-0">
            {attendanceCount.excused}
          </p>
          <p className="text-[11px] font-semibold text-sky-700/70 m-0">
            Có phép
          </p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-rose-700 m-0">
            {attendanceCount.absent}
          </p>
          <p className="text-[11px] font-semibold text-rose-700/70 m-0">Vắng</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-3xl px-4 py-3 text-center">
          <p className="text-lg font-extrabold text-amber-700 m-0">
            {attendanceCount.late}
          </p>
          <p className="text-[11px] font-semibold text-amber-700/70 m-0">
            Đi muộn
          </p>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Ô tìm kiếm chiếm 2 cột trên màn hình vừa/lớn */}
        <div className="relative sm:col-span-2">
          <input
            type="text"
            placeholder="Tìm kiếm học sinh..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500 font-medium transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Ô lọc theo tổ (chiếm 1 cột) */}
        <div>
          <select
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="all">Tất cả các tổ</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Ô sắp xếp (chiếm 1 cột) */}
        <div>
          <select
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:border-amber-400 focus:outline-none"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name-asc">Họ tên (A → Z)</option>
            <option value="name-desc">Họ tên (Z → A)</option>
            <option value="group">Sắp xếp theo Tổ</option>
            <option value="stars-desc">Sao tích lũy (Nhiều nhất)</option>
          </select>
        </div>
      </div>

      {/* Danh sách thẻ học sinh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6 sm:col-span-2 lg:col-span-3">
            Không tìm thấy học sinh phù hợp.
          </p>
        ) : (
          filtered.map((s) => {
            const cleanName = s.name.replace(/[0-9]/g, "").trim();
            const nameWords = cleanName.split(" ").filter(Boolean);
            const initials =
              nameWords.length >= 2
                ? (
                    nameWords[nameWords.length - 2][0] +
                    nameWords[nameWords.length - 1][0]
                  ).toUpperCase()
                : (nameWords[0]?.[0] || "HS").toUpperCase();

            const currentStatusMeta = STATUS_META[s.status || "present"];
            const studentGender = normalizeGenderLabel(s.gender);
            const studentGroup = normalizeGroupName(s.group);
            const groupStyle = GROUP_STYLES[studentGroup] || {
              badgeBg: "bg-sky-50",
              badgeText: "text-sky-700",
              badgeBorder: "border-sky-200/60",
            };

            return (
              <div
                key={s.id}
                className="bg-white p-6 rounded-3xl  border border-sky-100 shadow-lg shadow-sky-900/5 space-y-4 flex flex-col justify-between transition-all hover:shadow-xl"
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-linear-to-tr from-sky-400 to-indigo-500 text-white font-extrabold flex items-center justify-center text-base shadow-md shadow-sky-500/20">
                    {s.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={s.avatarUrl}
                        alt={s.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-base m-0">
                      {s.name}
                    </h4>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <span
                        className={`px-2.5 py-0.5 ${groupStyle.badgeBg} border ${groupStyle.badgeBorder} rounded-full text-[11px] font-bold ${groupStyle.badgeText}`}
                      >
                        {studentGroup}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          studentGender === "Nữ"
                            ? "bg-pink-50 border-pink-200 text-pink-700"
                            : "bg-indigo-50 border-indigo-200 text-indigo-700"
                        }`}
                      >
                        {studentGender}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setInfoModalStudent(s)}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-3xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs"
                  >
                    <svg
                      className="w-4 h-4 text-amber-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Thông tin
                  </button>
                  <button
                    onClick={() => setHistoryModalStudent(s)}
                    className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-3xl flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 transition-all shadow-2xs"
                  >
                    <svg
                      className="w-4 h-4 text-amber-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4"
                      />
                    </svg>
                    Lịch sử
                  </button>
                </div>

                <div className="bg-amber-50/40 p-3.5 rounded-3xl border border-amber-100/60 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">
                      Điểm tuần
                    </span>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                      {WEEKLY_BASE_POINTS + (weeklyDeltaMap[s.name] || 0)} đ
                      <span
                        className={`text-[10px] font-bold ${
                          (weeklyDeltaMap[s.name] || 0) > 0
                            ? "text-emerald-600"
                            : (weeklyDeltaMap[s.name] || 0) < 0
                              ? "text-rose-600"
                              : "text-slate-400"
                        }`}
                      >
                        (
                        {(weeklyDeltaMap[s.name] || 0) > 0
                          ? `+${weeklyDeltaMap[s.name] || 0}`
                          : weeklyDeltaMap[s.name] || 0}
                        )
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">
                      ⭐ Tích lũy
                    </span>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      {s.stars} ⭐
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Chức vụ</span>
                    <span className="font-bold text-slate-800">
                      {s.position || "Chưa cập nhật"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100/60">
                    <span className="text-slate-500 font-medium">
                      Điều chỉnh sao:
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          setStarModal({ type: "minus", student: s })
                        }
                        className="w-6 h-6 rounded-lg border border-amber-200 bg-white text-slate-600 font-bold text-xs hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center"
                      >
                        −
                      </button>
                      <button
                        onClick={() =>
                          setStarModal({ type: "plus", student: s })
                        }
                        className="w-6 h-6 rounded-lg border border-amber-200 bg-white text-slate-600 font-bold text-xs hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">Điểm danh:</span>
                  <button
                    onClick={() => setAttendanceModalStudent(s)}
                    className={`font-bold px-2.5 py-1 rounded-lg border text-[11px] flex items-center gap-1 transition ${currentStatusMeta.active}`}
                  >
                    {currentStatusMeta.icon} {currentStatusMeta.label}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => setEditItem(s)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-100 transition-all cursor-pointer"
                    title="Sửa"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteStudent(s)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all cursor-pointer"
                    title="Xóa"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
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

      {/* Modal Thêm Học Sinh */}
      {/* POPUP THÊM HỌC SINH MỚI */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Thêm học sinh mới
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStudentFull} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ và tên..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                  value={newStudentData.name}
                  onChange={(e) =>
                    setNewStudentData({
                      ...newStudentData,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1 text-xs">
                  Ảnh đại diện (Chọn file hoặc nhập URL)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, true)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Tổ
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={newStudentData.group}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        group: e.target.value,
                      })
                    }
                  >
                    {GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Giới tính
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={newStudentData.gender}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        gender: e.target.value,
                      })
                    }
                  >
                    <option>Nam</option>
                    <option>Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={newStudentData.dob}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        dob: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    SĐT Phụ huynh
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0912345678"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                    value={newStudentData.parentPhone}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        parentPhone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Dân tộc
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Kinh"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                    value={newStudentData.nation || ""}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        nation: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Trạng thái
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={newStudentData.statusText || "Đang học"}
                    onChange={(e) =>
                      setNewStudentData({
                        ...newStudentData,
                        statusText: e.target.value,
                      })
                    }
                  >
                    <option value="Đang học">Đang học</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="nghỉ học">nghỉ học</option>
                    <option value="Chuyển trường">Chuyển trường</option>
                    <option value="Chuyển đến trong hè">
                      Chuyển đến trong hè
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Chức vụ
                </label>
                <select
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                  value={newStudentData.position}
                  onChange={(e) =>
                    setNewStudentData({
                      ...newStudentData,
                      position: e.target.value,
                    })
                  }
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  Thêm học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP XÓA NHANH DANH SÁCH HỌC SINH */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[85vh] animate-fadeIn">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Xóa học sinh
              </h3>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Thanh tìm kiếm và nút Chọn tất cả */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Tìm kiếm học sinh theo tên..."
                  value={deleteSearchQuery || ""}
                  onChange={(e) => setDeleteSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-rose-300 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const filtered = students.filter((s) =>
                    s.name
                      .toLowerCase()
                      .includes((deleteSearchQuery || "").toLowerCase()),
                  );
                  const filteredIds = filtered.map((s) => s.id!);
                  const allSelected = filteredIds.every((id) =>
                    selectedStudentIds.includes(id),
                  );

                  if (allSelected) {
                    // Bỏ chọn các item đang hiển thị trong kết quả lọc
                    setSelectedStudentIds(
                      selectedStudentIds.filter(
                        (id) => !filteredIds.includes(id),
                      ),
                    );
                  } else {
                    // Chọn tất cả item đang hiển thị trong kết quả lọc
                    const newSet = new Set([
                      ...selectedStudentIds,
                      ...filteredIds,
                    ]);
                    setSelectedStudentIds(Array.from(newSet));
                  }
                }}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
              >
                {(() => {
                  const filtered = students.filter((s) =>
                    s.name
                      .toLowerCase()
                      .includes((deleteSearchQuery || "").toLowerCase()),
                  );
                  if (filtered.length === 0) return "Chọn tất cả";
                  const allSelected = filtered.every((s) =>
                    selectedStudentIds.includes(s.id!),
                  );
                  return allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả";
                })()}
              </button>
            </div>

            {/* Danh sách học sinh dạng cuộn */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-1 max-h-87.5">
              {students.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">
                  Không có học sinh nào trong hệ thống.
                </p>
              ) : (
                students
                  .filter((student) =>
                    student.name
                      .toLowerCase()
                      .includes((deleteSearchQuery || "").toLowerCase()),
                  )
                  .map((student) => {
                    const isSelected = selectedStudentIds.includes(student.id!);
                    return (
                      <div
                        key={student.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStudentIds(
                              selectedStudentIds.filter(
                                (id) => id !== student.id,
                              ),
                            );
                          } else {
                            setSelectedStudentIds([
                              ...selectedStudentIds,
                              student.id!,
                            ]);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-rose-50/60 border-rose-200 text-rose-900"
                            : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                          />
                          <div>
                            <p className="font-bold text-sm">{student.name}</p>
                            <p className="text-xs text-slate-400">
                              {normalizeGroupName(student.group)} -{" "}
                              {normalizeGenderLabel(student.gender)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-medium text-slate-600">
                          {student.statusText || "Đang học"}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
              <span className="text-xs font-semibold text-slate-500">
                Đã chọn:{" "}
                <strong className="text-rose-600">
                  {selectedStudentIds.length}
                </strong>{" "}
                học sinh
              </span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBatchDelete(true)}
                  disabled={selectedStudentIds.length === 0}
                  className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-md ${
                    selectedStudentIds.length > 0
                      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                      : "bg-slate-300 cursor-not-allowed shadow-none"
                  }`}
                >
                  Xóa các mục đã chọn ({selectedStudentIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhập File Excel */}
      {excelModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-lg border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Nhập danh sách từ File Excel
              </h3>
              <button
                type="button"
                onClick={() => setExcelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600 m-0">
                File Excel cần có hàng tiêu đề chứa các cột như:{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">
                  Họ và tên
                </code>
                ,{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">
                  Tổ
                </code>
                ,{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">
                  Giới tính
                </code>
                ,{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">
                  Ngày sinh
                </code>
                ,{" "}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">
                  SĐT Phụ huynh
                </code>
                ...
              </p>
            </div>

            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer bg-white border border-slate-200 rounded-xl p-2"
            />

            {excelPreviewData.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-emerald-700 m-0">
                  ✅ Đã đọc thành công {excelPreviewData.length} học sinh từ
                  file. Xem trước:
                </p>
                <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 text-[11px] space-y-1">
                  {excelPreviewData.map(
                    (row: Record<string, unknown>, idx: number) => {
                      const studentName = String(
                        row.name || row["Họ và tên"] || "Chưa có tên",
                      );
                      const studentGroup = String(
                        row.group || row["Tổ"] || "Tổ 1",
                      );
                      return (
                        <div
                          key={idx}
                          className="border-b border-slate-100 pb-1 flex justify-between"
                        >
                          <span className="font-bold text-slate-800">
                            {studentName}
                          </span>
                          <span className="text-slate-500">{studentGroup}</span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                onClick={() => {
                  setExcelModalOpen(false);
                  setExcelPreviewData([]);
                }}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
              >
                Hủy
              </button>
              <button
                onClick={handleImportExcelToFirebase}
                disabled={loading || excelPreviewData.length === 0}
                className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
              >
                {loading
                  ? "Đang lưu..."
                  : `Lưu ${excelPreviewData.length} học sinh vào hệ thống`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cộng/Trừ Điểm Sao */}
      {starModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-lg border border-slate-100 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3
                className={`text-base font-extrabold m-0 ${starModal.type === "plus" ? "text-emerald-700" : "text-rose-700"}`}
              >
                {starModal.type === "plus" ? "Cộng điểm" : "Trừ điểm"}:{" "}
                {starModal.student.name.toUpperCase()}
              </h3>
              <button
                onClick={() => setStarModal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none">
              {criteriaList
                .filter((item) =>
                  starModal.type === "plus"
                    ? item.type === "pos"
                    : item.type === "neg",
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleApplyPoints(Math.abs(item.points), item.label)
                    }
                    className={`p-3 rounded-3xl border text-left flex flex-col justify-between transition hover:scale-[1.02] ${
                      starModal.type === "plus"
                        ? "bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50 text-emerald-900"
                        : "bg-rose-50/40 border-rose-100 hover:bg-rose-50 text-rose-900"
                    }`}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="text-sm shrink-0">{item.icon}</span>
                      <span className="text-xs font-bold leading-snug">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-extrabold mt-2 ${
                        starModal.type === "plus"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }`}
                    >
                      {starModal.type === "plus"
                        ? `+${Math.abs(item.points)} điểm`
                        : `-${Math.abs(item.points)} điểm`}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Popup Xem Lịch Sử Điểm Sao */}
      {historyModalStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 ">
              <h3 className="text-sm font-extrabold text-slate-800 m-0 flex items-center gap-2">
                Lịch sử điểm: {historyModalStudent.name}
              </h3>
              <button
                onClick={() => setHistoryModalStudent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar:none space-y-2 bg-white p-3 rounded-3xl border border-amber-100 text-xs">
              {studentLogs.length === 0 ? (
                <p className="text-slate-400 text-center py-4 m-0">
                  Chưa có lịch sử cộng trừ điểm.
                </p>
              ) : (
                studentLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span className="text-slate-700 font-medium">
                      {log.label}
                    </span>
                    <span
                      className={`font-bold ${log.delta > 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {log.delta > 0 ? `+${log.delta}` : log.delta} ⭐
                    </span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setHistoryModalStudent(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-500/20"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Popup Xem Thông Tin Chi Tiết */}
      {infoModalStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl w-full max-w-sm border border-[#EFE8D8] shadow-xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 ">
              <h3 className="text-sm font-extrabold text-slate-800 m-0">
                Thông tin: {infoModalStudent.name}
              </h3>
              <button
                onClick={() => setInfoModalStudent(null)}
                className="w-7 h-7 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center text-xs font-bold text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs bg-white p-4 rounded-3xl border border-amber-100">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tổ</span>
                <span className="font-bold text-slate-800">
                  {normalizeGroupName(infoModalStudent.group)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Giới tính</span>
                <span className="font-bold text-slate-800">
                  {normalizeGenderLabel(infoModalStudent.gender)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Ngày sinh</span>
                <span className="font-bold text-slate-800">
                  {infoModalStudent.dob || "Chưa cập nhật"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dân tộc</span>
                <span className="font-bold text-slate-800">
                  {infoModalStudent.nation || "Kinh"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Trạng thái</span>
                <span className="font-bold text-emerald-600">
                  {infoModalStudent.statusText || "Đang học"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Phụ huynh</span>
                <span className="font-bold text-slate-800">
                  {infoModalStudent.parentPhone || "Chưa cập nhật"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Chức vụ</span>
                <span className="font-bold text-slate-800">
                  {infoModalStudent.position || "Chưa cập nhật"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setInfoModalStudent(null)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Popup Điểm danh */}
      {attendanceModalStudent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-xs border border-[#EFE8D8] shadow-xl space-y-4 text-center">
            <h3 className="text-sm font-bold text-slate-800 m-0">
              Điểm danh: {attendanceModalStudent.name}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUS_META).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() =>
                    handleSetStatus(attendanceModalStudent.id!, key)
                  }
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs border flex items-center justify-center gap-1.5 transition ${
                    attendanceModalStudent.status === key
                      ? m.active
                      : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"
                  }`}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAttendanceModalStudent(null)}
              className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Modal Cập nhật thông tin chi tiết */}
      {editItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white p-6 rounded-3xl  w-full max-w-md border border-[#EFE8D8] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <h3 className="text-base font-bold text-slate-800 m-0">
                Cập nhật thông tin học sinh
              </h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Họ và tên *
                </label>
                <input
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                  value={editItem.name || ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1 text-xs">
                  Ảnh đại diện
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, false)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Tổ
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={normalizeGroupName(editItem.group) || ""}
                    onChange={(e) =>
                      setEditItem({ ...editItem, group: e.target.value })
                    }
                  >
                    {GROUPS.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Giới tính
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={normalizeGenderLabel(editItem.gender)}
                    onChange={(e) =>
                      setEditItem({ ...editItem, gender: e.target.value })
                    }
                  >
                    <option>Nam</option>
                    <option>Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={(() => {
                      const val = editItem.dob;
                      if (!val || val === "Chưa cập nhật") return "";
                      // Nếu đã đúng chuẩn YYYY-MM-DD
                      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
                      // Nếu đang lưu dạng DD/MM/YYYY (ví dụ: 15/05/2012)
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                        const [day, month, year] = val.split("/");
                        return `${year}-${month}-${day}`;
                      }
                      return "";
                    })()}
                    onChange={(e) =>
                      setEditItem({ ...editItem, dob: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    SĐT Phụ huynh
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0912345678"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                    value={
                      editItem.parentPhone &&
                      editItem.parentPhone !== "Chưa cập nhật"
                        ? editItem.parentPhone
                        : ""
                    }
                    onChange={(e) =>
                      setEditItem({ ...editItem, parentPhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Dân tộc
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Kinh"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-300 focus:outline-none"
                    value={editItem?.nation || ""}
                    onChange={(e) =>
                      setEditItem((prev) =>
                        prev ? { ...prev, nation: e.target.value } : null,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Trạng thái
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                    value={editItem?.statusText || "Đang học"}
                    onChange={(e) =>
                      setEditItem((prev) =>
                        prev ? { ...prev, statusText: e.target.value } : null,
                      )
                    }
                  >
                    <option value="Đang học">Đang học</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="nghỉ học">nghỉ học</option>
                    <option value="Chuyển trường">Chuyển trường</option>
                    <option value="Chuyển đến trong hè">
                      Chuyển đến trong hè
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Chức vụ
                </label>
                <select
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none"
                  value={editItem.position || "Chưa cập nhật"}
                  onChange={(e) =>
                    setEditItem({ ...editItem, position: e.target.value })
                  }
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                onClick={() => setEditItem(null)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-200 hover:border-slate-200 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleUpdate}
                className="px-3.5 py-2 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white hover:border-amber-600 transition-all shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA 1 HỌC SINH */}
      {confirmDeleteStudent && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa học sinh?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc muốn xóa học sinh{" "}
                <strong className="text-slate-800">
                  &quot;{confirmDeleteStudent.name}&quot;
                </strong>{" "}
                khỏi lớp? Toàn bộ điểm số và lịch sử liên quan sẽ không hiển thị
                nữa. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(null)}
                disabled={deletingStudentId === confirmDeleteStudent.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStudent}
                disabled={deletingStudentId === confirmDeleteStudent.id}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {deletingStudentId === confirmDeleteStudent.id
                  ? "Đang xóa..."
                  : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA HÀNG LOẠT HỌC SINH */}
      {confirmBatchDelete && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-sm p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Xóa {selectedStudentIds.length} học sinh đã chọn?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Toàn bộ{" "}
                <strong className="text-slate-800">
                  {selectedStudentIds.length}
                </strong>{" "}
                học sinh đã chọn sẽ bị xóa khỏi lớp. Hành động này không thể
                hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmBatchDelete(false)}
                disabled={batchDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={batchDeleting}
                className="flex-1 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center"
              >
                {batchDeleting
                  ? "Đang xóa..."
                  : `Xóa ${selectedStudentIds.length} học sinh`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
