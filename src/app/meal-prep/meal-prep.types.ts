export type PrepStatus = '待备餐' | '备餐中' | '已完成' | '缺餐异常';

export type ElderRef = {
  id: string;
  name: string;
  address: string;
  contact: string;
};

export type PrepItem = {
  id: string;
  taskId: string;
  elder: ElderRef;
  mealTagIds: string[];
  specialMealNote: string;
  isPaused: boolean;
  status: PrepStatus;
  missingNote: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
};

export type PrepBatch = {
  batchKey: string;
  batchLabel: string;
  batchType: 'tag' | 'special' | 'paused' | 'standard';
  tagId?: string;
  color: string;
  items: PrepItem[];
  totalCount: number;
  completedCount: number;
  missingCount: number;
  inProgressCount: number;
};

export type DailyPrepSummary = {
  date: string;
  totalMeals: number;
  completedMeals: number;
  inProgressMeals: number;
  missingMeals: number;
  pausedMeals: number;
  batches: PrepBatch[];
  standardItems: PrepItem[];
  specialItems: PrepItem[];
  pausedItems: PrepItem[];
  itemsById: Record<string, PrepItem>;
};

export const PREP_STATUSES: PrepStatus[] = ['待备餐', '备餐中', '已完成', '缺餐异常'];

export const LS_PREP_DATA_KEY = 'zfl-4-meal-prep-data';
