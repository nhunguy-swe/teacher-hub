export const TOTAL_GROUPS = 3;

export const getGroupLabel = (index: number) => `Tổ ${index + 1}`;

export const GROUPS = Array.from({ length: TOTAL_GROUPS }, (_, i) =>
  getGroupLabel(i),
);

/** Lấy chỉ số cột từ seatKey dạng "groupIndex-row-side" */
export const getSeatGroupIndex = (seatKey: string) =>
  parseInt(seatKey.split("-")[0], 10);

/**
 * Trả về chỉ số tổ (0..2), hoặc -1 nếu không nhận dạng được.
 * customTitles dùng để đọc lại dữ liệu cũ đã lưu theo tên tùy chỉnh (vd "Tổ Sao").
 */
export const getGroupIndex = (
  groupName?: string,
  customTitles: string[] = [],
): number => {
  const raw = groupName?.trim();
  if (!raw) return -1;

  const byTitle = customTitles.findIndex(
    (t) => t.trim().toLowerCase() === raw.toLowerCase(),
  );
  if (byTitle !== -1) return byTitle;

  const match = raw.match(/\d+/);
  if (match) {
    const n = parseInt(match[0], 10);
    if (n >= 1 && n <= TOTAL_GROUPS) return n - 1;
  }
  return -1;
};

/** Luôn trả về "Tổ 1" | "Tổ 2" | "Tổ 3" (không nhận dạng được thì về Tổ 1) */
export const normalizeGroupName = (
  groupName?: string,
  customTitles: string[] = [],
) => {
  const i = getGroupIndex(groupName, customTitles);
  return getGroupLabel(i === -1 ? 0 : i);
};
