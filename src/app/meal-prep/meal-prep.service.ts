import { Injectable } from '@angular/core';
import {
  PrepStatus,
  PrepItem,
  PrepBatch,
  DailyPrepSummary,
  ElderRef,
  LS_PREP_DATA_KEY,
  PREP_STATUSES,
  TagBreakdownStat,
  PausedTagStat,
  PausedSummary,
} from './meal-prep.types';

export type MealTag = {
  id: string;
  name: string;
  color: string;
};

export type Elder = {
  id: string;
  name: string;
  preference: string;
  mealTags: string[];
  address: string;
  contact: string;
  note: string;
  deliveryDays: number[];
  pauseDates: string[];
  specialMealNote: string;
};

export type MealTask = {
  id: string;
  elderId: string;
  date: string;
  volunteerId: string;
  status: '待分配' | '配送中' | '已送达' | '异常';
  exception: string;
  isManuallyModified: boolean;
  specialMealNote: string;
};

export type ExceptionCategory = '无人应答' | '地址错误' | '老人拒收' | '餐食问题' | '配送延误' | '老人身体不适' | '其他';
export type ExceptionSeverity = '一般' | '较重' | '紧急';
export type ExceptionStatus = '待处理' | '处理中' | '已解决';

export type ExceptionRecord = {
  id: string;
  taskId: string;
  elderId: string;
  date: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  description: string;
  handler: string;
  status: ExceptionStatus;
  result: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationStatus = '未通知' | '已通知' | '未接通' | '稍后再拨';
export type NotificationTargetType = 'elder' | 'volunteer';

export type PhoneNotification = {
  id: string;
  date: string;
  targetType: NotificationTargetType;
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: NotificationStatus;
  remark: string;
  updatedAt: string;
};

export type PrepStorageData = Record<string, Record<string, {
  status: PrepStatus;
  missingNote: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
}>>;

@Injectable({ providedIn: 'root' })
export class MealPrepService {
  private storageData: PrepStorageData = {};

  constructor() {
    this.loadStorage();
  }

  private loadStorage() {
    const raw = localStorage.getItem(LS_PREP_DATA_KEY);
    if (raw) {
      try {
        this.storageData = JSON.parse(raw);
      } catch {
        this.storageData = {};
      }
    }
  }

  private saveStorage() {
    localStorage.setItem(LS_PREP_DATA_KEY, JSON.stringify(this.storageData));
  }

  exportStorageData(): PrepStorageData {
    return JSON.parse(JSON.stringify(this.storageData));
  }

  importStorageData(data: PrepStorageData, merge: boolean = true) {
    if (merge) {
      for (const date of Object.keys(data)) {
        if (!this.storageData[date]) {
          this.storageData[date] = {};
        }
        for (const taskId of Object.keys(data[date])) {
          this.storageData[date][taskId] = data[date][taskId];
        }
      }
    } else {
      this.storageData = JSON.parse(JSON.stringify(data));
    }
    this.saveStorage();
  }

  private getStoredStatus(date: string, taskId: string): {
    status: PrepStatus;
    missingNote: string;
    exceptionRecorded: boolean;
    notificationAdded: boolean;
  } {
    return this.storageData[date]?.[taskId] || {
      status: '待备餐',
      missingNote: '',
      exceptionRecorded: false,
      notificationAdded: false,
    };
  }

  private setStoredStatus(
    date: string,
    taskId: string,
    data: { status: PrepStatus; missingNote: string; exceptionRecorded: boolean; notificationAdded: boolean }
  ) {
    if (!this.storageData[date]) {
      this.storageData[date] = {};
    }
    this.storageData[date][taskId] = data;
    this.saveStorage();
  }

  generateDailySummary(
    date: string,
    tasks: MealTask[],
    elders: Elder[],
    mealTags: MealTag[]
  ): DailyPrepSummary {
    const elderMap = new Map(elders.map(e => [e.id, e]));
    const tagMap = new Map(mealTags.map(t => [t.id, t]));
    const dateTasks = tasks.filter(t => t.date === date);
    const dateTaskElderIds = new Set(dateTasks.map(t => t.elderId));

    const taskItems: PrepItem[] = dateTasks.map(task => {
      const elder = elderMap.get(task.elderId);
      if (!elder) return null;

      const stored = this.getStoredStatus(date, task.id);
      const isPaused = elder.pauseDates?.includes(date) || false;
      const elderRef: ElderRef = {
        id: elder.id,
        name: elder.name,
        address: elder.address,
        contact: elder.contact,
      };

      return {
        id: crypto.randomUUID() as string,
        taskId: task.id,
        elder: elderRef,
        mealTagIds: elder.mealTags || [],
        specialMealNote: task.specialMealNote || elder.specialMealNote || '',
        isPaused,
        status: isPaused ? '待备餐' : stored.status,
        missingNote: stored.missingNote,
        exceptionRecorded: stored.exceptionRecorded,
        notificationAdded: stored.notificationAdded,
      } as PrepItem;
    }).filter((item): item is PrepItem => item !== null);

    const pausedOnlyItems: PrepItem[] = elders
      .filter(elder => elder.pauseDates?.includes(date) && !dateTaskElderIds.has(elder.id))
      .map(elder => ({
        id: `paused-${date}-${elder.id}`,
        taskId: `paused-${date}-${elder.id}`,
        elder: {
          id: elder.id,
          name: elder.name,
          address: elder.address,
          contact: elder.contact,
        },
        mealTagIds: elder.mealTags || [],
        specialMealNote: elder.specialMealNote || '',
        isPaused: true,
        status: '待备餐' as PrepStatus,
        missingNote: '',
        exceptionRecorded: false,
        notificationAdded: false,
      }));

    const items = [...taskItems, ...pausedOnlyItems];

    const pausedItems = items.filter(i => i.isPaused);
    const activeItems = items.filter(i => !i.isPaused);

    const specialItems = activeItems.filter(i => i.specialMealNote && i.specialMealNote.trim());
    const nonSpecialItems = activeItems.filter(i => !i.specialMealNote || !i.specialMealNote.trim());

    const tagBatches = new Map<string, PrepItem[]>();
    const standardItems: PrepItem[] = [];

    for (const item of nonSpecialItems) {
      if (item.mealTagIds.length === 0) {
        standardItems.push(item);
      } else {
        const primaryTag = item.mealTagIds[0];
        if (!tagBatches.has(primaryTag)) {
          tagBatches.set(primaryTag, []);
        }
        tagBatches.get(primaryTag)!.push(item);
      }
    }

    const batches: PrepBatch[] = [];

    for (const [tagId, batchItems] of tagBatches.entries()) {
      const tag = tagMap.get(tagId);
      if (!tag) continue;
      batches.push(this.createBatch(
        `tag-${tagId}`,
        tag.name,
        'tag',
        tag.color,
        tagId,
        batchItems,
      ));
    }

    if (specialItems.length > 0) {
      batches.push(this.createBatch(
        'special-notes',
        '特殊餐食备注',
        'special',
        '#b36a2e',
        undefined,
        specialItems,
      ));
    }

    if (standardItems.length > 0) {
      batches.push(this.createBatch(
        'standard',
        '标准餐',
        'standard',
        '#5a8fd9',
        undefined,
        standardItems,
      ));
    }

    if (pausedItems.length > 0) {
      batches.push(this.createBatch(
        'paused',
        '暂停送餐',
        'paused',
        '#8a9783',
        undefined,
        pausedItems,
      ));
    }

    const itemsById: Record<string, PrepItem> = {};
    for (const item of items) {
      itemsById[item.taskId] = item;
    }

    const activeNonPaused = items.filter(i => !i.isPaused);
    const standardOnlyCount = standardItems.length;
    const noTagCount = activeNonPaused.filter(i => i.mealTagIds.length === 0).length;

    const tagBreakdown = this.computeTagBreakdown(items, mealTags);
    const pausedSummary = this.computePausedSummary(pausedItems, activeNonPaused, mealTags);

    return {
      date,
      totalMeals: activeNonPaused.length,
      completedMeals: activeNonPaused.filter(i => i.status === '已完成').length,
      inProgressMeals: activeNonPaused.filter(i => i.status === '备餐中').length,
      missingMeals: activeNonPaused.filter(i => i.status === '缺餐异常').length,
      pausedMeals: pausedItems.length,
      batches,
      standardItems,
      specialItems,
      pausedItems,
      itemsById,
      tagBreakdown,
      pausedSummary,
      standardOnlyCount,
      noTagCount,
    };
  }

  private computeTagBreakdown(
    allItems: PrepItem[],
    mealTags: MealTag[],
  ): TagBreakdownStat[] {
    const tagMap = new Map(mealTags.map(t => [t.id, t]));
    const stats = new Map<string, {
      totalCount: number;
      uniqueElderIds: Set<string>;
      pausedCount: number;
      activeCount: number;
      completedCount: number;
      inProgressCount: number;
      missingCount: number;
      withSpecialNoteCount: number;
      elderIdToOtherTags: Map<string, Set<string>>;
      order: number;
    }>();

    mealTags.forEach((tag, idx) => {
      stats.set(tag.id, {
        totalCount: 0,
        uniqueElderIds: new Set<string>(),
        pausedCount: 0,
        activeCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        missingCount: 0,
        withSpecialNoteCount: 0,
        elderIdToOtherTags: new Map<string, Set<string>>(),
        order: idx,
      });
    });

    for (const item of allItems) {
      for (const tagId of item.mealTagIds) {
        const s = stats.get(tagId);
        if (!s) continue;
        s.totalCount++;
        s.uniqueElderIds.add(item.elder.id);
        if (item.isPaused) {
          s.pausedCount++;
        } else {
          s.activeCount++;
          switch (item.status) {
            case '已完成': s.completedCount++; break;
            case '备餐中': s.inProgressCount++; break;
            case '缺餐异常': s.missingCount++; break;
          }
        }
        if (item.specialMealNote && item.specialMealNote.trim()) {
          s.withSpecialNoteCount++;
        }
        const otherTags = item.mealTagIds.filter(t => t !== tagId);
        if (otherTags.length > 0) {
          const existing = s.elderIdToOtherTags.get(item.elder.id) || new Set<string>();
          otherTags.forEach(t => existing.add(t));
          s.elderIdToOtherTags.set(item.elder.id, existing);
        }
      }
    }

    const result: TagBreakdownStat[] = [];
    for (const [tagId, s] of stats.entries()) {
      const tag = tagMap.get(tagId);
      if (!tag || s.totalCount === 0) continue;

      const overlapCountMap = new Map<string, number>();
      for (const otherTagIds of s.elderIdToOtherTags.values()) {
        for (const ot of otherTagIds) {
          overlapCountMap.set(ot, (overlapCountMap.get(ot) || 0) + 1);
        }
      }
      const overlapTags: TagBreakdownStat['overlapTags'] = [];
      for (const [otId, cnt] of overlapCountMap.entries()) {
        const ot = tagMap.get(otId);
        if (ot) {
          overlapTags.push({ tagId: otId, tagName: ot.name, count: cnt });
        }
      }
      overlapTags.sort((a, b) => b.count - a.count);

      result.push({
        tagId,
        tagName: tag.name,
        tagColor: tag.color,
        order: s.order,
        totalCount: s.totalCount,
        uniqueElderCount: s.uniqueElderIds.size,
        pausedCount: s.pausedCount,
        activeCount: s.activeCount,
        completedCount: s.completedCount,
        inProgressCount: s.inProgressCount,
        missingCount: s.missingCount,
        withSpecialNoteCount: s.withSpecialNoteCount,
        overlapTags,
      });
    }

    result.sort((a, b) => {
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
      return a.order - b.order;
    });
    return result;
  }

  private computePausedSummary(
    pausedItems: PrepItem[],
    activeItems: PrepItem[],
    mealTags: MealTag[],
  ): PausedSummary {
    const tagMap = new Map(mealTags.map(t => [t.id, t]));
    const totalPaused = pausedItems.length;
    const activeTotal = activeItems.length;
    const pauseRate = totalPaused + activeTotal === 0 ? 0 :
      Math.round((totalPaused / (totalPaused + activeTotal)) * 1000) / 10;

    const tagCounts = new Map<string, number>();
    for (const item of pausedItems) {
      for (const tid of item.mealTagIds) {
        tagCounts.set(tid, (tagCounts.get(tid) || 0) + 1);
      }
    }
    const byTags: PausedTagStat[] = [];
    for (const [tid, cnt] of tagCounts.entries()) {
      const tag = tagMap.get(tid);
      if (tag) {
        byTags.push({ tagId: tid, tagName: tag.name, tagColor: tag.color, count: cnt });
      }
    }
    byTags.sort((a, b) => b.count - a.count);

    const pausedWithSpecialNote = pausedItems.filter(
      i => i.specialMealNote && i.specialMealNote.trim()
    );

    const pausedElderList = pausedItems.map(item => {
      const tagNames = item.mealTagIds
        .map(tid => tagMap.get(tid)?.name)
        .filter((n): n is string => !!n);
      return {
        elderName: item.elder.name,
        address: item.elder.address,
        contact: item.elder.contact,
        tagNames,
        specialNote: item.specialMealNote,
      };
    });

    return {
      totalPaused,
      activeTotal,
      pauseRate,
      byTags,
      pausedWithSpecialNote,
      pausedElderList,
    };
  }

  private createBatch(
    batchKey: string,
    batchLabel: string,
    batchType: PrepBatch['batchType'],
    color: string,
    tagId: string | undefined,
    items: PrepItem[],
  ): PrepBatch {
    return {
      batchKey,
      batchLabel,
      batchType,
      tagId,
      color,
      items,
      totalCount: items.length,
      completedCount: items.filter(i => i.status === '已完成').length,
      missingCount: items.filter(i => i.status === '缺餐异常').length,
      inProgressCount: items.filter(i => i.status === '备餐中').length,
    };
  }

  updateItemStatus(
    date: string,
    taskId: string,
    status: PrepStatus,
    missingNote: string = '',
  ) {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      status,
      missingNote,
      exceptionRecorded: status === '缺餐异常' ? existing.exceptionRecorded : false,
      notificationAdded: status === '缺餐异常' ? existing.notificationAdded : false,
    });
  }

  markExceptionRecorded(date: string, taskId: string) {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      ...existing,
      exceptionRecorded: true,
    });
  }

  markNotificationAdded(date: string, taskId: string) {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      ...existing,
      notificationAdded: true,
    });
  }

  createExceptionRecord(
    task: MealTask,
    elder: Elder,
    missingNote: string,
  ): ExceptionRecord {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return {
      id: crypto.randomUUID(),
      taskId: task.id,
      elderId: elder.id,
      date: task.date,
      category: '餐食问题',
      severity: missingNote.includes('无法') || missingNote.includes('紧急') ? '较重' : '一般',
      description: `厨房备餐缺餐：${missingNote || '未提供备餐'}`,
      handler: '',
      status: '待处理',
      result: '',
      createdAt: timeStr,
      updatedAt: timeStr,
    };
  }

  createPhoneNotification(
    task: MealTask,
    elder: Elder,
    missingNote: string,
  ): PhoneNotification {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const match = elder.contact.match(/1[3-9]\d{9}/);
    const phone = match ? match[0] : elder.contact;
    return {
      id: crypto.randomUUID(),
      date: task.date,
      targetType: 'elder',
      targetId: elder.id,
      phone,
      taskId: task.id,
      notificationStatus: '未通知',
      remark: `备餐缺餐通知：${missingNote || '今日无法备餐'}`,
      updatedAt: timeStr,
    };
  }

  batchUpdateStatus(
    date: string,
    taskIds: string[],
    status: PrepStatus,
  ) {
    for (const taskId of taskIds) {
      this.updateItemStatus(date, taskId, status);
    }
  }

  getPrepStatusColor(status: PrepStatus): string {
    switch (status) {
      case '待备餐': return '#8a9783';
      case '备餐中': return '#5a8fd9';
      case '已完成': return '#4a9f6d';
      case '缺餐异常': return '#c75454';
      default: return '#8a9783';
    }
  }
}
