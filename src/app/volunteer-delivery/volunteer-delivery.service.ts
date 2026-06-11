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
} from './volunteer-delivery.types';

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
  private broadcastChannel: BroadcastChannel | null = null;
  private storageListener!: (e: StorageEvent) => void;

  constructor() {
    this.loadStorage();
    this.storageListener = (e: StorageEvent) => {
      if (e.key === LS_DELIVERY_DATA_KEY && e.newValue !== e.oldValue) {
        try {
          const remoteData = JSON.parse(e.newValue || '{}');
          this.storageData = remoteData;
        } catch {
          this.storageData = {};
        }
      }
    };
    window.addEventListener('storage', this.storageListener);
    try {
      this.broadcastChannel = new BroadcastChannel('zfl-4-delivery-sync');
      this.broadcastChannel.onmessage = () => {
        this.loadStorage();
      };
    } catch {
      this.broadcastChannel = null;
    }
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.storageListener);
    if (this.broadcastChannel) this.broadcastChannel.close();
  }

  private loadStorage() {
    const raw = localStorage.getItem(LS_DELIVERY_DATA_KEY);
    if (raw) {
      try {
        this.storageData = JSON.parse(raw);
      } catch {
        this.storageData = {};
      }
    }
  }

  private saveStorage() {
    localStorage.setItem(LS_DELIVERY_DATA_KEY, JSON.stringify(this.storageData));
    this.broadcastChannel?.postMessage({ type: 'delivery-updated' });
  }

  private getStoredStatus(date: string, taskId: string) {
    return this.storageData[date]?.[taskId] || {
      status: '待配送' as DeliveryStatus,
      exceptionNote: '',
      statusUpdatedAt: '',
      exceptionRecorded: false,
      notificationAdded: false,
    };
  }

  private setStoredStatus(
    date: string,
    taskId: string,
    data: {
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
    this.storageData[date][taskId] = data;
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
  ): VolunteerDailySummary | null {
    const volunteer = volunteers.find(v => v.id === volunteerId);
    if (!volunteer) return null;

    const volunteerRef: VolunteerRef = {
      id: volunteer.id,
      name: volunteer.name,
      phone: volunteer.phone,
      area: volunteer.area,
    };

    const dateTasks = tasks.filter(t => t.date === date && t.volunteerId === volunteerId);
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
      const elder = elderMap.get(task.elderId);
      if (!elder) return null;

      const stored = this.getStoredStatus(date, task.id);
      const lastVisit = this.getElderLastVisit(elder.id, visitRecords);
      const isPaused = elder.pauseDates?.includes(date) || false;

      const elderTags: ElderDeliveryRef['mealTags'] = elder.mealTags
        .map(tid => tagMap.get(tid))
        .filter((t): t is MealTag => !!t);

      return {
        id: `delivery-${date}-${task.id}`,
        taskId: task.id,
        routeOrder: index + 1,
        volunteer: volunteerRef,
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
        visitReminder: !!lastVisit?.nextAttention,
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

  getDeliveryStatusColor(status: DeliveryStatus): string {
    return DELIVERY_STATUS_COLORS[status];
  }
}
