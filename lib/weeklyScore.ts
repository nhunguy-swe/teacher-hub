// lib/weeklyScore.ts
// Dùng chung cho toàn bộ app: tính "điểm tuần" (mỗi học sinh 100đ/tuần,
// tuần tính từ Thứ 2 -> Chủ nhật) dựa trên collection "activityLog" đã có sẵn.
// Không cần thêm field mới vào Firestore cho học sinh hay tổ.

export const WEEKLY_BASE_POINTS = 100;

export interface ActivityLogLike {
  name: string;
  delta: number;
  createdAt?: { toDate: () => Date } | null;
}

// Thứ 2 đầu tuần (chuẩn ISO: tuần bắt đầu từ Thứ 2, kết thúc Chủ nhật)
export function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = CN ... 6 = T7
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Chủ nhật cuối tuần, tính từ Thứ 2 đầu tuần
export function getSunday(monday: Date) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

// YYYY-MM-DD theo giờ địa phương (tránh lệch múi giờ khi dùng toISOString)
export function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Gom toàn bộ delta trong 1 tuần theo "name" (có thể là tên học sinh HOẶC
 * tên tổ, vì activityLog dùng chung field `name` cho cả 2 trường hợp trong
 * app này - ví dụ cộng/trừ sao học sinh và cộng/trừ điểm thi đua tổ).
 * Trả về map { [name]: tổng delta trong tuần }.
 */
export function buildWeeklyDeltaMap(
  logs: ActivityLogLike[],
  monday: Date,
  sunday: Date,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const log of logs) {
    if (!log.createdAt || typeof log.createdAt.toDate !== "function") continue;
    const d = log.createdAt.toDate();
    if (d < monday || d > sunday) continue;
    map[log.name] = (map[log.name] || 0) + (log.delta || 0);
  }
  return map;
}

// Điểm tuần của 1 học sinh = 100 + tổng cộng/trừ trong tuần
export function weeklyScoreOf(
  deltaMap: Record<string, number>,
  studentName: string,
) {
  return WEEKLY_BASE_POINTS + (deltaMap[studentName] || 0);
}
