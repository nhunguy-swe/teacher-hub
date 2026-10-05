// Các chức vụ không cần hiện tag
export const HIDDEN_POSITION_TAGS = ["Thành viên", "Chưa cập nhật"];

// Cùng phong cách pastel với tag Tổ / Giới tính, mỗi chức vụ một tông riêng
const POSITION_TAG_STYLES: Record<string, string> = {
  "Lớp trưởng":
    "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300",
  "Lớp phó học tập":
    "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/50 dark:border-purple-800 dark:text-purple-300",
  "Lớp phó kỷ luật":
    "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300",
  "Lớp phó văn thể mỹ":
    "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-300",
  "Tổ trưởng":
    "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/50 dark:border-cyan-800 dark:text-cyan-300",
  "Tổ phó":
    "bg-lime-50 border-lime-200 text-lime-700 dark:bg-lime-950/50 dark:border-lime-800 dark:text-lime-300",
};

export const getPositionTagStyle = (position: string) =>
  POSITION_TAG_STYLES[position] ||
  "bg-stone-50 border-stone-200 text-stone-700";
