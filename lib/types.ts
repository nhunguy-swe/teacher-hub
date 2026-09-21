// lucky-draw/types.ts
// Shared types, constants and small helpers used by AdminLuckySpin,
// LuckyDrawCard and LuckyFlipCard.

export interface StudentItem {
  id: string;
  name: string;
  group: string;
}

export interface WinnerHistoryItem {
  id: string;
  studentName: string;
  subject: string;
  timestamp: string;
  // Optional: which tool produced this win ("spin" | "card" | "flip").
  // Safe to ignore if you don't need to distinguish sources in the UI.
  source?: string;
}

export const DEFAULT_SUBJECTS = [
  "Toán học",
  "Ngữ văn",
  "Tiếng Anh",
  "Khoa học tự nhiên",
  "Lịch sử & Địa lý",
  "Tin học",
];

export const COLORS = [
  "#EF4444",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

// Danh sách các đặc quyền mẫu khi học sinh bấm vào nút "Đặc quyền"
export const PRIVILEGES_LIST = [
  "⭐ Miễn 1 bài tập về nhà",
  "🎯 Cộng 1 điểm vào bài kiểm tra",
  "🪑 Được chọn chỗ ngồi yêu thích",
  "👑 Trợ lý lớp học 1 ngày",
  "🎁 Nhận 1 phần quà đặc biệt",
  "⏰ Được miễn kiểm tra bài cũ",
  "💡 Quyền trợ giúp từ bạn bè",
  "🌟 Xóa 1 lần nhắc nhở sổ đầu bài",
];

export const getRandomItem = <T>(arr: T[]): { item: T; index: number } => {
  const index = Math.floor(Math.random() * arr.length);
  return { item: arr[index], index };
};

export const randomInRange = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};
