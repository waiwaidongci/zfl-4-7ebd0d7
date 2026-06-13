import { Injectable } from '@angular/core';
import {
  PrepStatus,
  PrepItem,
  PrepBatch,
  DailyPrepSummary,
  ElderRef,
  VolunteerRef,
  LS_PREP_DATA_KEY,
  PREP_STATUSES,
  TagBreakdownStat,
  PausedTagStat,
  PausedSummary,
  KitchenPrintViewData,
  PrintGroup,
  PrintItem,
  PrintGroupType,
} from './meal-prep.types';
import { SYNC_INSTANCE, SyncConflictGroup, SyncNotification } from '../sync.service';
import {
  TemporaryDeliveryChange,
  MealTag,
  Elder,
  Volunteer,
  MealTask,
  ExceptionCategory,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionSource,
  ExceptionRecord,
  NotificationStatus,
  NotificationTargetType,
  PhoneNotification,
  PrepStorageData,
} from '../shared.types';

export type {
  TemporaryDeliveryChange,
  MealTag,
  Elder,
  Volunteer,
  MealTask,
  ExceptionCategory,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionSource,
  ExceptionRecord,
  NotificationStatus,
  NotificationTargetType,
  PhoneNotification,
  PrepStorageData,
} from '../shared.types';

@Injectable({ providedIn: 'root' })
export class MealPrepService {
  private storageData: PrepStorageData = {};
  private sync = SYNC_INSTANCE();
  private syncUnsub?: () => void;

  constructor() {
    this.loadStorage();
    this.syncUnsub = this.sync.subscribe((n) => {
      if (n.type === 'conflicts' && n.conflicts) {
        const prepConflict = n.conflicts.find((c) => c.dataType === 'prepData');
        if (prepConflict) {
          this.resolvePrepConflicts(prepConflict);
        }
      } else if (n.type === 'synced' && n.dataType === 'prepData') {
          this.loadStorage();
        }
    });
  }

  private resolvePrepConflicts(group: SyncConflictGroup) {
    const merged = this.sync.mergeConflicts(group, this.storageData);
    this.storageData = merged;
    this.saveStorage(true);
  }

  private loadStorage() {
    const raw = this.sync.readLocalData<any>('prepData');
    if (raw) {
      this.storageData = raw;
    } else {
      this.storageData = {};
    }
    this.sync.captureLocalSnapshot('prepData', this.storageData);
  }

  private saveStorage(silent: boolean = false) {
    this.sync.writeLocalData('prepData', this.storageData);
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
    mealTags: MealTag[],
    volunteers: Volunteer[] = [],
    temporaryDeliveryChanges: TemporaryDeliveryChange[] = [],
  ): DailyPrepSummary {
    const elderMap = new Map(elders.map(e => [e.id, e]));
    const tagMap = new Map(mealTags.map(t => [t.id, t]));
    const volunteerMap = new Map(volunteers.map(v => [v.id, v]));
    const tempChangeMap = new Map<string, TemporaryDeliveryChange>();
    for (const tc of temporaryDeliveryChanges) {
      if (tc.date === date) {
        tempChangeMap.set(tc.elderId, tc);
      }
    }
    const dateTasks = tasks.filter(t => t.date === date);
    const dateTaskElderIds = new Set(dateTasks.map(t => t.elderId));

    const applyTempChange = (elder: Elder): Elder => {
      const change = tempChangeMap.get(elder.id);
      if (!change) return elder;
      return {
        ...elder,
        address: change.address !== undefined ? change.address : elder.address,
        contact: change.contact !== undefined ? change.contact : elder.contact,
        mealTags: change.mealTagIds !== undefined ? change.mealTagIds : elder.mealTags,
        specialMealNote: change.specialMealNote !== undefined ? change.specialMealNote : elder.specialMealNote,
      };
    };

    const taskItems: PrepItem[] = dateTasks.map(task => {
      const rawElder = elderMap.get(task.elderId);
      if (!rawElder) return null;
      const elder = applyTempChange(rawElder);

      const stored = this.getStoredStatus(date, task.id);
      const isPaused = elder.pauseDates?.includes(date) || false;
      const elderRef: ElderRef = {
        id: elder.id,
        name: elder.name,
        address: elder.address,
        contact: elder.contact,
      };

      const effectiveVolunteerId = tempChangeMap.get(elder.id)?.volunteerId || task.volunteerId;
      const volunteerRaw = volunteerMap.get(effectiveVolunteerId);
      const volunteerRef: VolunteerRef | undefined = volunteerRaw ? {
        id: volunteerRaw.id,
        name: volunteerRaw.name,
        phone: volunteerRaw.phone,
        area: volunteerRaw.area,
      } : undefined;

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
        volunteer: volunteerRef,
      } as PrepItem;
    }).filter((item): item is PrepItem => item !== null);

    const pausedOnlyItems: PrepItem[] = elders
      .filter(elder => elder.pauseDates?.includes(date) && !dateTaskElderIds.has(elder.id))
      .map(rawElder => {
        const elder = applyTempChange(rawElder);
        return {
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
        };
      });

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
      source: '备餐缺餐',
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
      source: '备餐缺餐',
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

  buildDedupKeyForPrepException(taskId: string, category = '餐食问题'): string {
    return this.sync.buildDedupKeyForException({ taskId, source: '备餐缺餐', category });
  }

  buildDedupKeyForPrepNotification(taskId: string, targetId: string): string {
    return this.sync.buildDedupKeyForNotification({ taskId, source: '备餐缺餐', targetId });
  }

  isExceptionDuplicate(taskId: string, existingRecords: ExceptionRecord[]): boolean {
    const key = this.buildDedupKeyForPrepException(taskId);
    return existingRecords.some((r) =>
      r.source === '备餐缺餐' && r.taskId === taskId &&
      this.sync.buildDedupKeyForException(r) === key
    );
  }

  isNotificationDuplicate(taskId: string, targetId: string, existingNotifications: PhoneNotification[]): boolean {
    const key = this.buildDedupKeyForPrepNotification(taskId, targetId);
    return existingNotifications.some((n) =>
      n.source === '备餐缺餐' && n.taskId === taskId && n.targetId === targetId &&
      this.sync.buildDedupKeyForNotification(n) === key
    );
  }

  detectPrepDataConflicts(remoteData: PrepStorageData): SyncConflictGroup {
    const base = this.sync.getLocalSnapshot('prepData');
    return this.sync.detectConflicts('prepData', base, remoteData, this.storageData);
  }

  mergeResolvedConflicts(group: SyncConflictGroup): PrepStorageData {
    const merged = this.sync.mergeConflicts(group, this.storageData);
    this.storageData = merged;
    this.saveStorage();
    return merged;
  }

  generateKitchenPrintViewData(
    summary: DailyPrepSummary,
    mealTags: MealTag[],
  ): KitchenPrintViewData {
    const tagMap = new Map(mealTags.map(t => [t.id, t]));
    const now = new Date();
    const generatedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const allItems = summary.batches.flatMap(b => b.items);
    const activeItems = allItems.filter(i => !i.isPaused);
    const pausedItems = allItems.filter(i => i.isPaused);
    const missingItems = activeItems.filter(i => i.status === '缺餐异常');
    const specialItems = activeItems.filter(i => i.specialMealNote && i.specialMealNote.trim());

    const toPrintItem = (item: PrepItem): PrintItem => {
      const tags = item.mealTagIds
        .map(tid => tagMap.get(tid))
        .filter((t): t is MealTag => !!t)
        .map(t => ({ id: t.id, name: t.name, color: t.color }));

      return {
        id: item.id,
        elderName: item.elder.name,
        address: item.elder.address,
        contact: item.elder.contact,
        mealTags: tags,
        specialMealNote: item.specialMealNote,
        isPaused: item.isPaused,
        isMissing: item.status === '缺餐异常',
        missingNote: item.missingNote,
        volunteerName: item.volunteer?.name || '',
        volunteerPhone: item.volunteer?.phone || '',
        volunteerArea: item.volunteer?.area || '',
        status: item.status,
      };
    };

    const groups: PrintGroup[] = [];

    const tagGroups = new Map<string, PrepItem[]>();
    const standardItems: PrepItem[] = [];

    for (const item of activeItems) {
      if (item.specialMealNote && item.specialMealNote.trim()) continue;
      if (item.mealTagIds.length === 0) {
        standardItems.push(item);
      } else {
        const primaryTag = item.mealTagIds[0];
        if (!tagGroups.has(primaryTag)) {
          tagGroups.set(primaryTag, []);
        }
        tagGroups.get(primaryTag)!.push(item);
      }
    }

    for (const [tagId, items] of tagGroups.entries()) {
      const tag = tagMap.get(tagId);
      if (!tag || items.length === 0) continue;
      groups.push({
        groupKey: `tag-${tagId}`,
        groupLabel: tag.name,
        groupType: 'tag',
        tagId,
        color: tag.color,
        items: items.map(toPrintItem),
        totalCount: items.length,
      });
    }

    groups.sort((a, b) => {
      if (a.groupType === 'tag' && b.groupType === 'tag') {
        return b.totalCount - a.totalCount;
      }
      return 0;
    });

    if (standardItems.length > 0) {
      groups.push({
        groupKey: 'standard',
        groupLabel: '标准餐（无特殊标签）',
        groupType: 'all',
        color: '#5a8fd9',
        items: standardItems.map(toPrintItem),
        totalCount: standardItems.length,
      });
    }

    let specialGroup: PrintGroup | undefined;
    if (specialItems.length > 0) {
      specialGroup = {
        groupKey: 'special',
        groupLabel: '特殊餐食备注',
        groupType: 'special',
        color: '#b36a2e',
        items: specialItems.map(toPrintItem),
        totalCount: specialItems.length,
      };
      groups.push(specialGroup);
    }

    let pausedGroup: PrintGroup | undefined;
    if (pausedItems.length > 0) {
      pausedGroup = {
        groupKey: 'paused',
        groupLabel: '暂停送餐',
        groupType: 'paused',
        color: '#8a9783',
        items: pausedItems.map(toPrintItem),
        totalCount: pausedItems.length,
      };
      groups.push(pausedGroup);
    }

    let missingGroup: PrintGroup | undefined;
    if (missingItems.length > 0) {
      missingGroup = {
        groupKey: 'missing',
        groupLabel: '缺餐异常',
        groupType: 'missing',
        color: '#c75454',
        items: missingItems.map(toPrintItem),
        totalCount: missingItems.length,
      };
      groups.push(missingGroup);
    }

    return {
      date: summary.date,
      generatedAt,
      totalMeals: activeItems.length + pausedItems.length,
      totalActive: activeItems.length,
      totalPaused: pausedItems.length,
      totalMissing: missingItems.length,
      totalSpecial: specialItems.length,
      groups,
      missingGroup,
      pausedGroup,
      specialGroup,
    };
  }

  onTempChangeCancelled(change: TemporaryDeliveryChange, elderIdToTaskIdMap?: Map<string, Map<string, string>>): string[] {
    const cleanedTaskIds: string[] = [];
    const taskId = elderIdToTaskIdMap?.get(change.elderId)?.get(change.date);
    if (!taskId) return cleanedTaskIds;
    const stored = this.getStoredStatus(change.date, taskId);
    if (stored.status === '备餐中' || stored.status === '缺餐异常') {
      cleanedTaskIds.push(taskId);
    }
    return cleanedTaskIds;
  }

  onTempChangesCancelledBatch(changes: TemporaryDeliveryChange[], elderIdToTaskIdMap?: Map<string, Map<string, string>>): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const change of changes) {
      const cleaned = this.onTempChangeCancelled(change, elderIdToTaskIdMap);
      if (cleaned.length > 0) {
        result.set(change.id, cleaned);
      }
    }
    return result;
  }

  clearPrepStateForTaskIds(date: string, taskIds: string[]): void {
    for (const taskId of taskIds) {
      const stored = this.getStoredStatus(date, taskId);
      if (stored.status !== '已完成') {
        this.setStoredStatus(date, taskId, {
          status: '待备餐',
          missingNote: '',
          exceptionRecorded: stored.exceptionRecorded,
          notificationAdded: stored.notificationAdded,
        });
      }
    }
  }

  cleanupOrphanedStorageForDate(date: string, validTaskIds: Set<string>): void {
    if (!this.storageData[date]) return;
    const storedIds = Object.keys(this.storageData[date]);
    let changed = false;
    for (const taskId of storedIds) {
      if (!validTaskIds.has(taskId)) {
        delete this.storageData[date][taskId];
        changed = true;
      }
    }
    if (changed) {
      if (Object.keys(this.storageData[date]).length === 0) {
        delete this.storageData[date];
      }
      this.saveStorage();
    }
  }

  getTempChangePrepImpactSummary(changes: TemporaryDeliveryChange[], date: string): {
    affectedCount: number;
    tagChangedCount: number;
    addressChangedCount: number;
    specialNoteChangedCount: number;
    volunteerChangedCount: number;
  } {
    const dateChanges = changes.filter(c => c.date === date);
    return {
      affectedCount: dateChanges.length,
      tagChangedCount: dateChanges.filter(c => c.mealTagIds !== undefined).length,
      addressChangedCount: dateChanges.filter(c => c.address !== undefined).length,
      specialNoteChangedCount: dateChanges.filter(c => c.specialMealNote !== undefined).length,
      volunteerChangedCount: dateChanges.filter(c => c.volunteerId !== undefined).length,
    };
  }
}
