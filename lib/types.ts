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
  "🛡️ Được miễn 1 lần dò bài",
  "🔄 Được trả lời lại 1 lần nếu sai",
  "🆘 Quyền gọi bạn trợ giúp khi trả bài",
  "📖 Được xem sách 1 phút trước khi trả lời",
  "🎯 Được chọn câu hỏi dễ hơn",
  "🔁 Được hoãn dò bài sang buổi sau",
  "🏆 +1 điểm cộng vào bài kiểm tra miệng",
  "🎤 Được chọn bạn lên trả bài tiếp theo",
];

export const getRandomItem = <T>(arr: T[]): { item: T; index: number } => {
  const index = Math.floor(Math.random() * arr.length);
  return { item: arr[index], index };
};

export const randomInRange = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};
