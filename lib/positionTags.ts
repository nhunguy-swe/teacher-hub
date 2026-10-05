// Các chức vụ không cần hiện tag
export const HIDDEN_POSITION_TAGS = ["Thành viên", "Chưa cập nhật"];

// Cùng phong cách pastel với tag Tổ / Giới tính, mỗi chức vụ một tông riêng
const POSITION_TAG_STYLES: Record<string, string> = {
  "Lớp trưởng": "bg-red-50 border-red-200 text-red-700",
  "Lớp phó học tập": "bg-purple-50 border-purple-200 text-purple-700",
  "Lớp phó kỷ luật": "bg-slate-100 border-slate-300 text-slate-700",
  "Lớp phó văn thể mỹ": "bg-orange-50 border-orange-200 text-orange-700",
  "Tổ trưởng": "bg-cyan-50 border-cyan-200 text-cyan-700",
  "Tổ phó": "bg-lime-50 border-lime-200 text-lime-700",
};

export const getPositionTagStyle = (position: string) =>
  POSITION_TAG_STYLES[position] ||
  "bg-stone-50 border-stone-200 text-stone-700";