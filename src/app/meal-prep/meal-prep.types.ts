import type { PrepStatus } from '../shared.types';
export type { PrepStatus } from '../shared.types';

export type VolunteerRef = {
  id: string;
  name: string;
  phone: string;
  area: string;
};

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
  volunteer?: VolunteerRef;
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

export type PrintGroupType = 'tag' | 'special' | 'paused' | 'missing' | 'all';

export type PrintGroup = {
  groupKey: string;
  groupLabel: string;
  groupType: PrintGroupType;
  tagId?: string;
  color: string;
  items: PrintItem[];
  totalCount: number;
};

export type PrintItem = {
  id: string;
  elderName: string;
  address: string;
  contact: string;
  mealTags: Array<{ id: string; name: string; color: string }>;
  specialMealNote: string;
  isPaused: boolean;
  isMissing: boolean;
  missingNote: string;
  volunteerName: string;
  volunteerPhone: string;
  volunteerArea: string;
  status: PrepStatus;
};

export type KitchenPrintViewData = {
  date: string;
  generatedAt: string;
  totalMeals: number;
  totalActive: number;
  totalPaused: number;
  totalMissing: number;
  totalSpecial: number;
  groups: PrintGroup[];
  missingGroup?: PrintGroup;
  pausedGroup?: PrintGroup;
  specialGroup?: PrintGroup;
};

export type TagBreakdownStat = {
  tagId: string;
  tagName: string;
  tagColor: string;
  order: number;
  totalCount: number;
  uniqueElderCount: number;
  pausedCount: number;
  activeCount: number;
  completedCount: number;
  inProgressCount: number;
  missingCount: number;
  withSpecialNoteCount: number;
  overlapTags: Array<{ tagId: string; tagName: string; count: number }>;
};

export type PausedTagStat = {
  tagId: string;
  tagName: string;
  tagColor: string;
  count: number;
};

export type PausedSummary = {
  totalPaused: number;
  activeTotal: number;
  pauseRate: number;
  byTags: PausedTagStat[];
  pausedWithSpecialNote: PrepItem[];
  pausedElderList: Array<{ elderName: string; address: string; contact: string; tagNames: string[]; specialNote: string }>;
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
  tagBreakdown: TagBreakdownStat[];
  pausedSummary: PausedSummary;
  standardOnlyCount: number;
  noTagCount: number;
};

export const PREP_STATUSES: PrepStatus[] = ['待备餐', '备餐中', '已完成', '缺餐异常'];

export const LS_PREP_DATA_KEY = 'zfl-4-meal-prep-data';
