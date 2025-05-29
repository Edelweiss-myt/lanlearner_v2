export const addDays = (dateStr: string, days: number): Date => {
  const date = new Date(dateStr);
  const utcDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate;
};

export const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = (today.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = today.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const timeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000; // years

  if (interval > 1) return Math.floor(interval) + " 年前";
  interval = seconds / 2592000; // months
  if (interval > 1) return Math.floor(interval) + " 个月前";
  interval = seconds / 86400; // days
  if (interval > 1) return Math.floor(interval) + " 天前";
  interval = seconds / 3600; // hours
  if (interval > 1) return Math.floor(interval) + " 小时前";
  interval = seconds / 60; // minutes
  if (interval > 1) return Math.floor(interval) + " 分钟前";
  if (seconds < 10) return "刚刚";
  return Math.floor(seconds) + " 秒前";
};