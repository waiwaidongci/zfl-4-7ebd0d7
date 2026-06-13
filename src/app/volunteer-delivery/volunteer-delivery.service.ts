import { Injectable, OnDestroy } from '@angular/core';
import {
  DeliveryStatus,
  DeliveryTask,
  VolunteerDailySummary,
  ElderDeliveryRef,
  VolunteerRef,
  DeliveryStorageData,
  LS_DELIVERY_DATA_KEY,
  DELIVERY_STATUS_COLORS,
  OfflineDeliveryDraft,
  OfflineDraftType,
  OfflineDraftStatus,
  OfflineDraftMergeResult,
  LS_OFFLINE_DRAFT_KEY,
  DeliveryStoredStatus,
} from './volunteer-delivery.types';
import { SYNC_INSTANCE, SyncConflictGroup, SyncNotification } from '../sync.service';

export type TemporaryDeliveryChange = {
  id: string;
  elderId: string;
  date: string;
  address?: string;
  contact?: string;
  mealTagIds?: string[];
  specialMealNote?: string;
  volunteerId?: string;
  reason: string;
  createdAt: string;
};

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

export type Volunteer = {
  id: string;
  name: string;
  phone: string;
  capacity: number;
  area: string;
  availableDays: number[];
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

export type VisitRecord = {
  id: string;
  elderId: string;
  visitDate: string;
  visitMethod: '电话' | '上门' | '视频' | '其他';
  healthFeedback: string;
  mealFeedback: string;
  nextAttention: string;
  createdAt: string;
};

export type ExceptionSource = '备餐缺餐' | '配送异常' | '未接通' | '手动登记';

export type ExceptionRecord = {
  id: string;
  taskId: string;
  elderId: string;
  date: string;
  category: '无人应答' | '地址错误' | '老人拒收' | '餐食问题' | '配送延误' | '老人身体不适' | '其他';
  severity: '一般' | '较重' | '紧急';
  description: string;
  handler: string;
  status: '待处理' | '处理中' | '已解决';
  result: string;
  source: ExceptionSource;
  createdAt: string;
  updatedAt: string;
};

export type PhoneNotification = {
  id: string;
  date: string;
  targetType: 'elder' | 'volunteer';
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: '未通知' | '已通知' | '未接通' | '稍后再拨';
  remark: string;
  source: ExceptionSource;
  updatedAt: string;
};

export type KanbanSortMap = Record<string, Record<string, string[]>>;

export type TaskWritebackResult = {
  taskUpdated?: MealTask;
  exceptionCreated?: ExceptionRecord;
  notificationCreated?: PhoneNotification;
};

@Injectable({ providedIn: 'root' })
export class VolunteerDeliveryService implements OnDestroy {
  private storageData: DeliveryStorageData = {};
  private offlineDrafts: OfflineDeliveryDraft[] = [];
  private syncAvailable = true;
  private lastSyncCheck = 0;
  private sync = SYNC_INSTANCE();
  private syncUnsub?: () => void;
  private readonly SYNC_CHECK_INTERVAL = 5000;
  private readonly ONLINE_CHECK_KEY = 'zfl-4-sync-online-check';

  constructor() {
    this.loadStorage();
    this.loadOfflineDrafts();
    this.syncUnsub = this.sync.subscribe((n) => {
      if (n.type === 'conflicts' && n.conflicts) {
        const delivConflict = n.conflicts.find((c) => c.dataType === 'deliveryData');
        if (delivConflict) {
          this.resolveDeliveryConflicts(delivConflict);
        }
        const draftConflict = n.conflicts.find((c) => c.dataType === 'offlineDeliveryDrafts');
        if (draftConflict) {
          this.resolveDraftConflicts(draftConflict);
        }
      } else if (n.type === 'synced' && n.dataType === 'deliveryData') {
        this.loadStorage();
      } else if (n.type === 'synced' && n.dataType === 'offlineDeliveryDrafts') {
        this.loadOfflineDrafts();
      } else if (n.type === 'error') {
        this.syncAvailable = false;
      }
    });
    this.startSyncMonitoring();
  }

  ngOnDestroy() {
    if (this.syncUnsub) this.syncUnsub();
  }

  private resolveDeliveryConflicts(group: SyncConflictGroup) {
    const merged = this.sync.mergeConflicts(group, this.storageData);
    this.storageData = merged;
    this.saveStorage();
  }

  private loadStorage() {
    const raw = this.sync.readLocalData<DeliveryStorageData>('deliveryData');
    if (raw) {
      this.storageData = raw;
    } else {
      this.storageData = {};
    }
    this.sync.captureLocalSnapshot('deliveryData', this.storageData);
  }

  private saveStorage() {
    this.sync.writeLocalData('deliveryData', this.storageData);
  }

  private getStoredStatus(date: string, taskId: string): DeliveryStoredStatus {
    const defaults: DeliveryStoredStatus = {
      status: '待配送' as DeliveryStatus,
      exceptionNote: '',
      statusUpdatedAt: '',
      exceptionRecorded: false,
      notificationAdded: false,
      phoneCallResults: [],
      visitReminderHandled: false,
      visitReminderNote: '',
    };
    return {
      ...defaults,
      ...(this.storageData[date]?.[taskId] as Partial<DeliveryStoredStatus> | undefined),
    };
  }

  private setStoredStatus(
    date: string,
    taskId: string,
    data: Partial<DeliveryStoredStatus> & {
      status: DeliveryStatus;
      exceptionNote: string;
      statusUpdatedAt: string;
      exceptionRecorded: boolean;
      notificationAdded: boolean;
    }
  ) {
    if (!this.storageData[date]) {
      this.storageData[date] = {};
    }
    const existing = this.getStoredStatus(date, taskId);
    this.storageData[date][taskId] = {
      ...existing,
      ...data,
    };
    this.saveStorage();
  }

  exportStorageData(): DeliveryStorageData {
    return JSON.parse(JSON.stringify(this.storageData));
  }

  importStorageData(data: DeliveryStorageData, merge: boolean = true) {
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

  clearDeliveryStateForTaskIds(date: string, taskIds: string[]): void {
    for (const taskId of taskIds) {
      const stored = this.getStoredStatus(date, taskId);
      if (stored.status !== '已送达') {
        this.setStoredStatus(date, taskId, {
          status: '待配送',
          exceptionNote: '',
          statusUpdatedAt: '',
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

  getElderLastVisit(elderId: string, visits: VisitRecord[]) {
    const elderVisits = visits.filter(v => v.elderId === elderId);
    if (elderVisits.length === 0) return undefined;
    elderVisits.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
    return elderVisits[0];
  }

  mapDeliveryStatusToTaskStatus(status: DeliveryStatus): MealTask['status'] {
    switch (status) {
      case '配送中': return '配送中';
      case '已送达': return '已送达';
      case '异常':
      case '未接通': return '异常';
      default: return '待分配';
    }
  }

  generateVolunteerSummary(
    date: string,
    volunteerId: string,
    tasks: MealTask[],
    volunteers: Volunteer[],
    elders: Elder[],
    mealTags: MealTag[],
    visitRecords: VisitRecord[],
    kanbanSort?: KanbanSortMap,
    temporaryDeliveryChanges: TemporaryDeliveryChange[] = [],
  ): VolunteerDailySummary | null {
    const volunteer = volunteers.find(v => v.id === volunteerId);
    if (!volunteer) return null;

    const volunteerRef: VolunteerRef = {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      area: volunteer.area,
    };

    const tempChangeMap = new Map<string, TemporaryDeliveryChange>();
    for (const tc of temporaryDeliveryChanges) {
      if (tc.date === date) {
        tempChangeMap.set(tc.elderId, tc);
      }
    }

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

    const allTempChangeElderIds = new Set<string>();
    for (const tc of temporaryDeliveryChanges) {
      if (tc.date === date && tc.volunteerId === volunteerId) {
        allTempChangeElderIds.add(tc.elderId);
      }
    }

    const dateTasks = tasks.filter(t => t.date === date && (t.volunteerId === volunteerId || allTempChangeElderIds.has(t.elderId)));
    const elderMap = new Map(elders.map(e => [e.id, e]));
    const tagMap = new Map(mealTags.map(t => [t.id, t]));

    const sortOrder = kanbanSort?.[date]?.[volunteerId];
    let orderedTasks = [...dateTasks];
    if (sortOrder && sortOrder.length > 0) {
      orderedTasks = dateTasks.sort((a, b) => {
        const idxA = sortOrder.indexOf(a.id);
        const idxB = sortOrder.indexOf(b.id);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }

    const deliveryTasks: DeliveryTask[] = orderedTasks.map((task, index) => {
      const rawElder = elderMap.get(task.elderId);
      if (!rawElder) return null;
      const elder = applyTempChange(rawElder);

      const stored = this.getStoredStatus(date, task.id);
      const lastVisit = this.getElderLastVisit(elder.id, visitRecords);
      const isPaused = elder.pauseDates?.includes(date) || false;

      const elderTags: ElderDeliveryRef['mealTags'] = elder.mealTags
        .map(tid => tagMap.get(tid))
        .filter((t): t is MealTag => !!t);

      const effectiveVolunteerId = tempChangeMap.get(elder.id)?.volunteerId || task.volunteerId;
      const effectiveVolunteer = effectiveVolunteerId === volunteerId ? volunteer : volunteers.find(v => v.id === effectiveVolunteerId);

      return {
        id: `delivery-${date}-${task.id}`,
        taskId: task.id,
        routeOrder: index + 1,
        volunteer: effectiveVolunteer ? {
          id: effectiveVolunteer.id,
          name: effectiveVolunteer.name,
          phone: effectiveVolunteer.phone,
          area: effectiveVolunteer.area,
        } : volunteerRef,
        elder: {
          id: elder.id,
          name: elder.name,
          address: elder.address,
          contact: elder.contact,
          mealTags: elderTags,
          specialMealNote: task.specialMealNote || elder.specialMealNote || '',
          lastVisit: lastVisit ? {
            date: lastVisit.visitDate,
            method: lastVisit.visitMethod,
            nextAttention: lastVisit.nextAttention || undefined,
          } : undefined,
        },
        status: isPaused ? '待配送' : stored.status,
        exceptionNote: stored.exceptionNote,
        statusUpdatedAt: stored.statusUpdatedAt,
        date,
        exceptionRecorded: stored.exceptionRecorded,
        notificationAdded: stored.notificationAdded,
        visitReminder: !!lastVisit?.nextAttention && !stored.visitReminderHandled,
        visitReminderHandled: stored.visitReminderHandled,
        visitReminderNote: stored.visitReminderNote,
      } as DeliveryTask;
    }).filter((t): t is DeliveryTask => !!t);

    return {
      volunteer: volunteerRef,
      date,
      totalTasks: deliveryTasks.length,
      completedTasks: deliveryTasks.filter(t => t.status === '已送达').length,
      inProgressTasks: deliveryTasks.filter(t => t.status === '配送中').length,
      pendingTasks: deliveryTasks.filter(t => t.status === '待配送').length,
      exceptionTasks: deliveryTasks.filter(t => t.status === '异常').length,
      unreachableTasks: deliveryTasks.filter(t => t.status === '未接通').length,
      tasks: deliveryTasks,
    };
  }

  getAllVolunteerRouteGroups(
    date: string,
    tasks: MealTask[],
    volunteers: Volunteer[],
  ): Array<{ volunteer: VolunteerRef; taskCount: number; completedCount: number }> {
    const result: Array<{ volunteer: VolunteerRef; taskCount: number; completedCount: number }> = [];

    for (const v of volunteers) {
      const vTasks = tasks.filter(t => t.date === date && t.volunteerId === v.id);
      if (vTasks.length === 0) continue;

      let completedCount = 0;
      for (const task of vTasks) {
        const stored = this.getStoredStatus(date, task.id);
        if (stored.status === '已送达') completedCount++;
      }

      result.push({
        volunteer: {
          id: v.id,
          name: v.name,
          phone: v.phone,
          area: v.area,
        },
        taskCount: vTasks.length,
        completedCount,
      });
    }

    return result;
  }

  updateDeliveryStatus(
    date: string,
    taskId: string,
    status: DeliveryStatus,
    exceptionNote: string = '',
  ): TaskWritebackResult {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const existing = this.getStoredStatus(date, taskId);
    const wasException = existing.status === '异常' || existing.status === '未接通';
    const isException = status === '异常' || status === '未接通';

    this.setStoredStatus(date, taskId, {
      status,
      exceptionNote,
      statusUpdatedAt: timeStr,
      exceptionRecorded: isException ? existing.exceptionRecorded : false,
      notificationAdded: isException ? existing.notificationAdded : false,
    });

    const mappedTaskStatus = this.mapDeliveryStatusToTaskStatus(status);
    const result: TaskWritebackResult = {};

    result.taskUpdated = {
      id: taskId,
      elderId: '',
      date,
      volunteerId: '',
      status: mappedTaskStatus,
      exception: isException ? (exceptionNote || (status === '未接通' ? '配送时未接通电话' : '配送异常')) : '',
      isManuallyModified: true,
      specialMealNote: '',
    };

    return result;
  }

  createDeliveryExceptionRecord(
    task: MealTask,
    elder: Elder,
    deliveryStatus: DeliveryStatus,
    exceptionNote: string,
  ): ExceptionRecord {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let category: ExceptionRecord['category'] = '配送延误';
    let severity: ExceptionRecord['severity'] = '一般';

    if (deliveryStatus === '未接通') {
      category = '无人应答';
      severity = '一般';
    } else if (exceptionNote.includes('拒收')) {
      category = '老人拒收';
    } else if (exceptionNote.includes('地址')) {
      category = '地址错误';
    } else if (exceptionNote.includes('身体') || exceptionNote.includes('不适')) {
      category = '老人身体不适';
      severity = '较重';
    }

    const description = deliveryStatus === '未接通'
      ? `志愿者配送上门未接通：${exceptionNote || '电话无人接听'}`
      : `志愿者配送异常：${exceptionNote || '配送过程中出现异常'}`;

    return {
      id: crypto.randomUUID(),
      taskId: task.id,
      elderId: elder.id,
      date: task.date,
      category,
      severity,
      description,
      handler: '',
      status: '待处理',
      result: '',
      source: deliveryStatus === '未接通' ? '未接通' : '配送异常',
      createdAt: timeStr,
      updatedAt: timeStr,
    };
  }

  createDeliveryPhoneNotification(
    task: MealTask,
    elder: Elder,
    deliveryStatus: DeliveryStatus,
    exceptionNote: string,
  ): PhoneNotification {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const match = elder.contact.match(/1[3-9]\d{9}/);
    const phone = match ? match[0] : elder.contact;

    const notificationStatus: PhoneNotification['notificationStatus'] = deliveryStatus === '未接通' ? '未接通' : '未通知';
    const remark = deliveryStatus === '未接通'
      ? `配送未接通通知：${exceptionNote || '电话无人接听，需再次联系'}`
      : `配送异常通知：${exceptionNote || '需联系老人及家属'}`;

    return {
      id: crypto.randomUUID(),
      date: task.date,
      targetType: 'elder',
      targetId: elder.id,
      phone,
      taskId: task.id,
      notificationStatus,
      remark,
      source: deliveryStatus === '未接通' ? '未接通' : '配送异常',
      updatedAt: timeStr,
    };
  }

  private createPhoneCallResultNotification(
    task: MealTask,
    elder: Elder,
    result: '已通知' | '未接通' | '稍后再拨',
    remark: string = '',
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
      notificationStatus: result,
      remark: remark || '志愿者配送端电话拨打结果',
      source: '手动登记',
      updatedAt: timeStr,
    };
  }

  markDeliveryExceptionRecorded(date: string, taskId: string) {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      ...existing,
      exceptionRecorded: true,
    });
  }

  markDeliveryNotificationAdded(date: string, taskId: string) {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      ...existing,
      notificationAdded: true,
    });
  }

  recordPhoneCallResult(
    date: string,
    taskId: string,
    notificationId: string,
    result: '已通知' | '未接通' | '稍后再拨',
    remark: string = ''
  ): void {
    const existing = this.getStoredStatus(date, taskId);
    const newResult = {
      notificationId,
      result,
      remark,
      timestamp: this.nowString(),
    };
    this.setStoredStatus(date, taskId, {
      ...existing,
      phoneCallResults: [...(existing.phoneCallResults || []), newResult],
    });
  }

  markVisitReminderHandled(
    date: string,
    taskId: string,
    note: string = ''
  ): void {
    const existing = this.getStoredStatus(date, taskId);
    this.setStoredStatus(date, taskId, {
      ...existing,
      visitReminderHandled: true,
      visitReminderNote: note,
    });
  }

  getPhoneCallResults(date: string, taskId: string) {
    return this.getStoredStatus(date, taskId).phoneCallResults || [];
  }

  isVisitReminderHandled(date: string, taskId: string): boolean {
    return this.getStoredStatus(date, taskId).visitReminderHandled || false;
  }

  getDeliveryStatusColor(status: DeliveryStatus): string {
    return DELIVERY_STATUS_COLORS[status];
  }

  buildDedupKeyForDeliveryException(taskId: string, source: '配送异常' | '未接通', category?: string): string {
    return this.sync.buildDedupKeyForException({ taskId, source, category });
  }

  buildDedupKeyForDeliveryNotification(taskId: string, source: '配送异常' | '未接通', targetId: string): string {
    return this.sync.buildDedupKeyForNotification({ taskId, source, targetId });
  }

  isDeliveryExceptionDuplicate(taskId: string, source: '配送异常' | '未接通', existingRecords: ExceptionRecord[]): boolean {
    return existingRecords.some((r) =>
      r.taskId === taskId && r.source === source
    );
  }

  isDeliveryNotificationDuplicate(taskId: string, source: '配送异常' | '未接通', targetId: string, existingNotifications: PhoneNotification[]): boolean {
    return existingNotifications.some((n) =>
      n.taskId === taskId && n.source === source && n.targetId === targetId
    );
  }

  detectDeliveryDataConflicts(remoteData: DeliveryStorageData): SyncConflictGroup {
    const base = this.sync.getLocalSnapshot('deliveryData');
    return this.sync.detectConflicts('deliveryData', base, remoteData, this.storageData);
  }

  mergeResolvedConflicts(group: SyncConflictGroup): DeliveryStorageData {
    const merged = this.sync.mergeConflicts(group, this.storageData);
    this.storageData = merged;
    this.saveStorage();
    return merged;
  }

  private loadOfflineDrafts() {
    const raw = this.sync.readLocalData<OfflineDeliveryDraft[]>('offlineDeliveryDrafts');
    if (raw && Array.isArray(raw)) {
      this.offlineDrafts = raw;
    } else {
      this.offlineDrafts = [];
    }
    this.sync.captureLocalSnapshot('offlineDeliveryDrafts', this.offlineDrafts);
  }

  private saveOfflineDrafts() {
    this.sync.writeLocalData('offlineDeliveryDrafts', this.offlineDrafts);
  }

  private resolveDraftConflicts(group: SyncConflictGroup) {
    const merged = this.sync.mergeConflicts(group, this.offlineDrafts);
    this.offlineDrafts = merged;
    this.saveOfflineDrafts();
  }

  private startSyncMonitoring() {
    setInterval(() => this.checkSyncAvailability(), this.SYNC_CHECK_INTERVAL);
    window.addEventListener('online', () => {
      this.syncAvailable = true;
      this.attemptMergePendingDrafts();
    });
    window.addEventListener('offline', () => {
      this.syncAvailable = false;
    });
  }

  private checkSyncAvailability(): boolean {
    const now = Date.now();
    if (now - this.lastSyncCheck < this.SYNC_CHECK_INTERVAL) {
      return this.syncAvailable;
    }
    this.lastSyncCheck = now;

    try {
      const testKey = `${this.ONLINE_CHECK_KEY}-${this.sync.windowId}`;
      const testValue = String(now);
      localStorage.setItem(testKey, testValue);
      const readBack = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      this.syncAvailable = readBack === testValue && navigator.onLine !== false;
    } catch {
      this.syncAvailable = false;
    }

    return this.syncAvailable;
  }

  isSyncAvailable(): boolean {
    return this.checkSyncAvailability();
  }

  getPendingDraftCount(): number {
    return this.offlineDrafts.filter(d => d.draftStatus === 'pending').length;
  }

  getConflictDraftCount(): number {
    return this.offlineDrafts.filter(d => d.draftStatus === 'conflict').length;
  }

  getOfflineDrafts(status?: OfflineDraftStatus): OfflineDeliveryDraft[] {
    const drafts = [...this.offlineDrafts];
    if (status) {
      return drafts.filter(d => d.draftStatus === status);
    }
    return drafts;
  }

  getDraftsForTask(taskId: string): OfflineDeliveryDraft[] {
    return this.offlineDrafts.filter(d => d.taskId === taskId && d.draftStatus !== 'synced' && d.draftStatus !== 'discarded');
  }

  private nowString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private createOfflineDraft(
    draftType: OfflineDraftType,
    taskId: string,
    date: string,
    volunteerId: string,
    data: Partial<OfflineDeliveryDraft>
  ): OfflineDeliveryDraft {
    const draft: OfflineDeliveryDraft = {
      id: crypto.randomUUID(),
      draftType,
      taskId,
      date,
      volunteerId,
      createdAt: this.nowString(),
      draftStatus: 'pending',
      ...data,
    };
    this.offlineDrafts.push(draft);
    this.saveOfflineDrafts();
    return draft;
  }

  createStatusUpdateDraft(
    taskId: string,
    date: string,
    volunteerId: string,
    status: DeliveryStatus,
    exceptionNote: string = ''
  ): OfflineDeliveryDraft {
    return this.createOfflineDraft('status-update', taskId, date, volunteerId, {
      deliveryStatus: status,
      exceptionNote,
    });
  }

  createExceptionNoteDraft(
    taskId: string,
    date: string,
    volunteerId: string,
    exceptionNote: string
  ): OfflineDeliveryDraft {
    return this.createOfflineDraft('exception-note', taskId, date, volunteerId, {
      exceptionNote,
    });
  }

  createPhoneCallResultDraft(
    taskId: string,
    date: string,
    volunteerId: string,
    phoneNotificationId: string,
    result: '已通知' | '未接通' | '稍后再拨',
    remark: string = ''
  ): OfflineDeliveryDraft {
    return this.createOfflineDraft('phone-call-result', taskId, date, volunteerId, {
      phoneNotificationId,
      phoneCallResult: result,
      phoneCallRemark: remark,
    });
  }

  createVisitReminderHandledDraft(
    taskId: string,
    date: string,
    volunteerId: string,
    note: string = ''
  ): OfflineDeliveryDraft {
    return this.createOfflineDraft('visit-reminder-handled', taskId, date, volunteerId, {
      visitReminderHandled: true,
      visitReminderNote: note,
    });
  }

  private isStatusProtected(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): boolean {
    if (currentStatus === '已送达' && newStatus !== '已送达') {
      return true;
    }
    return false;
  }

  private getLatestDraftForTask(taskId: string, drafts: OfflineDeliveryDraft[]): OfflineDeliveryDraft | null {
    const taskDrafts = drafts.filter(d => d.taskId === taskId && d.draftType === 'status-update');
    if (taskDrafts.length === 0) return null;
    return taskDrafts.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }

  detectDraftConflicts(
    tasks: MealTask[],
    existingExceptions: ExceptionRecord[],
    existingNotifications: PhoneNotification[]
  ): OfflineDeliveryDraft[] {
    const conflicts: OfflineDeliveryDraft[] = [];
    const pendingDrafts = this.offlineDrafts.filter(d => d.draftStatus === 'pending');

    for (const draft of pendingDrafts) {
      if (draft.draftType === 'status-update' && draft.deliveryStatus) {
        const task = tasks.find(t => t.id === draft.taskId);
        if (task) {
          if (this.isStatusProtected(task.status as DeliveryStatus, draft.deliveryStatus)) {
            draft.draftStatus = 'conflict';
            draft.conflictInfo = {
              remoteStatus: task.status as DeliveryStatus,
              conflictType: 'status-override',
            };
            conflicts.push(draft);
            continue;
          }
        }

        const stored = this.getStoredStatus(draft.date, draft.taskId);
        if (stored.status && stored.status !== '待配送') {
          const storedTime = stored.statusUpdatedAt ? new Date(stored.statusUpdatedAt).getTime() : 0;
          const draftTime = new Date(draft.createdAt).getTime();
          if (storedTime > draftTime && this.isStatusProtected(stored.status, draft.deliveryStatus)) {
            draft.draftStatus = 'conflict';
            draft.conflictInfo = {
              remoteStatus: stored.status,
              remoteUpdatedAt: stored.statusUpdatedAt,
              conflictType: 'concurrent-modification',
            };
            conflicts.push(draft);
          }
        }
      }
    }

    if (conflicts.length > 0) {
      this.saveOfflineDrafts();
    }

    return conflicts;
  }

  resolveDraftConflict(draftId: string, resolution: 'keep-local' | 'adopt-remote') {
    const draft = this.offlineDrafts.find(d => d.id === draftId);
    if (!draft) return;

    if (resolution === 'adopt-remote') {
      draft.draftStatus = 'discarded';
    } else if (draft.conflictInfo) {
      draft.conflictInfo.resolution = 'keep-local';
      draft.draftStatus = 'pending';
    }

    this.saveOfflineDrafts();
  }

  attemptMergePendingDrafts(
    tasks?: MealTask[],
    elders?: Elder[],
    existingExceptions?: ExceptionRecord[],
    existingNotifications?: PhoneNotification[]
  ): OfflineDraftMergeResult {
    const result: OfflineDraftMergeResult = {
      conflicts: [],
      mergedCount: 0,
      skippedCount: 0,
    };

    if (!this.isSyncAvailable()) {
      return result;
    }

    let pendingDrafts = this.offlineDrafts.filter(d => d.draftStatus === 'pending');
    pendingDrafts.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (tasks && existingExceptions && existingNotifications) {
      const conflicts = this.detectDraftConflicts(tasks, existingExceptions, existingNotifications);
      result.conflicts = conflicts;
      pendingDrafts = pendingDrafts.filter(d => d.draftStatus === 'pending');
    }

    const processedTaskIds = new Set<string>();

    for (const draft of pendingDrafts) {
      if (processedTaskIds.has(draft.taskId) && draft.draftType === 'status-update') {
        const latest = this.getLatestDraftForTask(draft.taskId, pendingDrafts);
        if (latest && latest.id !== draft.id) {
          draft.draftStatus = 'discarded';
          result.skippedCount++;
          continue;
        }
      }

      const mergeSuccess = this.mergeSingleDraft(draft, tasks, elders, existingExceptions, existingNotifications, result);
      if (mergeSuccess) {
        draft.draftStatus = 'synced';
        draft.syncedAt = this.nowString();
        result.mergedCount++;
        processedTaskIds.add(draft.taskId);
      } else {
        result.skippedCount++;
      }
    }

    this.saveOfflineDrafts();
    return result;
  }

  private mergeSingleDraft(
    draft: OfflineDeliveryDraft,
    tasks?: MealTask[],
    elders?: Elder[],
    existingExceptions?: ExceptionRecord[],
    existingNotifications?: PhoneNotification[],
    result?: OfflineDraftMergeResult
  ): boolean {
    switch (draft.draftType) {
      case 'status-update':
        return this.mergeStatusUpdateDraft(draft, tasks, elders, existingExceptions, existingNotifications, result);
      case 'exception-note':
        return this.mergeExceptionNoteDraft(draft, tasks);
      case 'phone-call-result':
        return this.mergePhoneCallResultDraft(draft, tasks, elders, existingNotifications, result);
      case 'visit-reminder-handled':
        return this.mergeVisitReminderHandledDraft(draft, result);
      default:
        return false;
    }
  }

  private mergeStatusUpdateDraft(
    draft: OfflineDeliveryDraft,
    tasks?: MealTask[],
    elders?: Elder[],
    existingExceptions?: ExceptionRecord[],
    existingNotifications?: PhoneNotification[],
    result?: OfflineDraftMergeResult
  ): boolean {
    if (!draft.deliveryStatus) return false;

    const updateResult = this.updateDeliveryStatus(
      draft.date,
      draft.taskId,
      draft.deliveryStatus,
      draft.exceptionNote || ''
    );

    if (result) {
      if (updateResult.taskUpdated) {
        result.taskUpdated = {
          taskId: updateResult.taskUpdated.id,
          status: updateResult.taskUpdated.status,
          exception: updateResult.taskUpdated.exception,
        };
      }

      const isException = draft.deliveryStatus === '异常' || draft.deliveryStatus === '未接通';
      const task = tasks?.find(t => t.id === draft.taskId);
      const elder = elders?.find(e => e.id === task?.elderId);

      if (isException && task && elder && existingExceptions && existingNotifications) {
        const stored = this.getStoredStatus(draft.date, draft.taskId);
        if (!stored.exceptionRecorded) {
          const exc = this.createDeliveryExceptionRecord(task, elder, draft.deliveryStatus, draft.exceptionNote || '');
          const isDuplicate = existingExceptions.some(r =>
            r.taskId === exc.taskId && r.source === exc.source
          );
          if (!isDuplicate) {
            result.exceptionCreated = exc;
            this.markDeliveryExceptionRecorded(draft.date, draft.taskId);
          }
        }
        if (!stored.notificationAdded) {
          const notif = this.createDeliveryPhoneNotification(task, elder, draft.deliveryStatus, draft.exceptionNote || '');
          const isDuplicate = existingNotifications.some(n =>
            n.taskId === notif.taskId && n.source === notif.source && n.targetId === notif.targetId
          );
          if (!isDuplicate) {
            result.notificationCreated = notif;
            this.markDeliveryNotificationAdded(draft.date, draft.taskId);
          }
        }
      }
    }

    return true;
  }

  private mergeExceptionNoteDraft(
    draft: OfflineDeliveryDraft,
    tasks?: MealTask[]
  ): boolean {
    if (!draft.exceptionNote) return false;

    const existing = this.getStoredStatus(draft.date, draft.taskId);
    this.setStoredStatus(draft.date, draft.taskId, {
      ...existing,
      exceptionNote: draft.exceptionNote,
    });

    return true;
  }

  private mergePhoneCallResultDraft(
    draft: OfflineDeliveryDraft,
    tasks?: MealTask[],
    elders?: Elder[],
    existingNotifications?: PhoneNotification[],
    result?: OfflineDraftMergeResult
  ): boolean {
    if (!draft.phoneCallResult) return false;

    let notificationId = draft.phoneNotificationId || '';
    if (!notificationId) {
      const task = tasks?.find(t => t.id === draft.taskId);
      const elder = elders?.find(e => e.id === task?.elderId);
      if (!task || !elder) return false;

      const existing = existingNotifications?.find(n =>
        n.taskId === draft.taskId
        && n.targetId === elder.id
        && n.source === '手动登记'
      );

      if (existing) {
        notificationId = existing.id;
      } else {
        const notification = this.createPhoneCallResultNotification(
          task,
          elder,
          draft.phoneCallResult,
          draft.phoneCallRemark || ''
        );
        notificationId = notification.id;
        if (result) {
          result.notificationCreated = notification;
        }
      }
      draft.phoneNotificationId = notificationId;
    }

    this.recordPhoneCallResult(
      draft.date,
      draft.taskId,
      notificationId,
      draft.phoneCallResult,
      draft.phoneCallRemark
    );

    if (result) {
      result.notificationUpdated = {
        notificationId,
        status: draft.phoneCallResult,
        remark: draft.phoneCallRemark,
      };
    }

    return true;
  }

  private mergeVisitReminderHandledDraft(
    draft: OfflineDeliveryDraft,
    result?: OfflineDraftMergeResult
  ): boolean {
    if (!draft.visitReminderHandled) return false;

    this.markVisitReminderHandled(
      draft.date,
      draft.taskId,
      draft.visitReminderNote
    );

    if (result) {
      result.visitReminderHandled = {
        taskId: draft.taskId,
        note: draft.visitReminderNote || '',
      };
    }

    return true;
  }

  clearSyncedDrafts() {
    this.offlineDrafts = this.offlineDrafts.filter(d => d.draftStatus !== 'synced' && d.draftStatus !== 'discarded');
    this.saveOfflineDrafts();
  }

  discardDraft(draftId: string) {
    const draft = this.offlineDrafts.find(d => d.id === draftId);
    if (draft) {
      draft.draftStatus = 'discarded';
      this.saveOfflineDrafts();
    }
  }

  getDraftSummary(): {
    pending: number;
    synced: number;
    conflict: number;
    discarded: number;
  } {
    return {
      pending: this.offlineDrafts.filter(d => d.draftStatus === 'pending').length,
      synced: this.offlineDrafts.filter(d => d.draftStatus === 'synced').length,
      conflict: this.offlineDrafts.filter(d => d.draftStatus === 'conflict').length,
      discarded: this.offlineDrafts.filter(d => d.draftStatus === 'discarded').length,
    };
  }
}
