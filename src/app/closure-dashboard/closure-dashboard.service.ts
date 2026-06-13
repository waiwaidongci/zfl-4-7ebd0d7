import { Injectable } from '@angular/core';
import {
  ClosureTaskRow,
  DashboardFilters,
  DashboardSummaryStats,
  StageTimelineItem,
  TaskStage,
  MealTag,
  Elder,
  Volunteer,
  MealTask,
  ExceptionRecord,
  VisitRecord,
  PhoneNotification,
  CallbackTask,
  TemporaryDeliveryChange,
  ExceptionSource,
  ExceptionStatus,
  PrepStatus,
  DeliveryStatus,
  PrepStorageData,
  DeliveryStorageData,
} from './closure-dashboard.types';

const TASK_STAGES: TaskStage[] = [
  '任务生成',
  '自动分配',
  '备餐阶段',
  '配送阶段',
  '异常处置',
  '回访关注',
];

const STAGE_CONFIG: Record<TaskStage, { icon: string; color: string; bgColor: string }> = {
  任务生成: { icon: '📋', color: '#8a9783', bgColor: '#f0f2ec' },
  自动分配: { icon: '🤖', color: '#5a8fd9', bgColor: '#e8f0fa' },
  备餐阶段: { icon: '🍳', color: '#d9a84a', bgColor: '#fdf3e0' },
  配送阶段: { icon: '🚴', color: '#4a9f6d', bgColor: '#e8f5ec' },
  异常处置: { icon: '⚠️', color: '#c75454', bgColor: '#fde8e8' },
  回访关注: { icon: '📞', color: '#9a6bd9', bgColor: '#f3e8fa' },
};

@Injectable({ providedIn: 'root' })
export class ClosureDashboardService {
  aggregateClosureRows(
    date: string,
    tasks: MealTask[],
    elders: Elder[],
    volunteers: Volunteer[],
    mealTags: MealTag[],
    exceptionRecords: ExceptionRecord[],
    visitRecords: VisitRecord[],
    phoneNotifications: PhoneNotification[],
    callbackTasks: CallbackTask[],
    temporaryDeliveryChanges: TemporaryDeliveryChange[],
    prepStorageData: PrepStorageData,
    deliveryStorageData: DeliveryStorageData,
  ): ClosureTaskRow[] {
    const rows: ClosureTaskRow[] = [];
    const dayTasks = tasks.filter((t) => t.date === date);
    const dayExceptions = exceptionRecords.filter((e) => e.date === date);
    const dayNotifications = phoneNotifications.filter((n) => n.date === date);
    const dayCallbacks = callbackTasks.filter((c) => c.date === date);
    const dayTempChanges = temporaryDeliveryChanges.filter((tc) => tc.date === date);

    for (const elder of elders) {
      const isPaused = elder.pauseDates?.includes(date);
      const elderMealTags = this.getElderMealTags(elder.id, date, elders, mealTags, dayTempChanges);
      const elderSpecialNote = this.getElderSpecialNote(elder.id, date, elders, dayTempChanges);
      const tempChange = dayTempChanges.find((tc) => tc.elderId === elder.id);
      const task = dayTasks.find((t) => t.elderId === elder.id);

      if (!task && !isPaused) continue;

      const volunteer = task ? volunteers.find((v) => v.id === task.volunteerId) : undefined;
      const elderExceptions = dayExceptions.filter((e) => e.elderId === elder.id);
      const elderNotifications = dayNotifications.filter((n) => n.targetId === elder.id);
      const elderCallbacks = dayCallbacks.filter((c) => c.elderId === elder.id);
      const elderVisits = visitRecords.filter((v) => v.elderId === elder.id);
      const lastVisit = elderVisits.sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0];

      const prepData = task ? prepStorageData[date]?.[task.id] : undefined;
      const deliveryData = task ? deliveryStorageData[date]?.[task.id] : undefined;

      const row: ClosureTaskRow = {
        taskId: task ? task.id : `paused-${elder.id}-${date}`,
        date,
        elderId: elder.id,
        elderName: elder.name,
        elderAddress: this.getElderAddress(elder.id, date, elders, dayTempChanges),
        elderContact: this.getElderContact(elder.id, date, elders, dayTempChanges),
        elderPreference: elder.preference,
        elderMealTags,
        elderSpecialNote,
        volunteerId: volunteer?.id || '',
        volunteerName: volunteer?.name || '未分配',
        volunteerPhone: volunteer?.phone || '',
        volunteerArea: volunteer?.area || '',
        taskStatus: isPaused ? '待分配' : task?.status || '待分配',
        taskException: task?.exception || '',
        isManuallyModified: task?.isManuallyModified || false,
        hasTempChange: !!tempChange,
        tempChangeSummary: tempChange ? this.summarizeTempChange(tempChange, elder) : '',
        prepStatus: isPaused ? '' : prepData?.status || '',
        prepMissingNote: prepData?.missingNote || '',
        deliveryStatus: isPaused ? '' : deliveryData?.status || '',
        deliveryExceptionNote: deliveryData?.exceptionNote || '',
        currentStage: this.determineCurrentStage(
          task,
          prepData?.status,
          deliveryData?.status,
          elderExceptions,
          lastVisit,
          isPaused,
          date,
        ),
        exceptionRecords: elderExceptions,
        hasUnresolvedException: elderExceptions.some((e) => e.status !== '已解决'),
        phoneNotifications: elderNotifications,
        callbackTasks: elderCallbacks,
        hasPendingCallback: elderCallbacks.some(
          (c) => c.status === '待回拨' || c.status === '回拨中',
        ),
        lastVisit,
        visitReminder: this.needsVisitReminder(lastVisit, date),
        createdAt: task?.id ? task.id.split('-').slice(0, 3).join('-') : date,
        assignedAt: task?.volunteerId ? date : '',
      };

      rows.push(row);
    }

    return rows.sort((a, b) => a.elderName.localeCompare(b.elderName));
  }

  private getElderMealTags(
    elderId: string,
    date: string,
    elders: Elder[],
    allTags: MealTag[],
    tempChanges: TemporaryDeliveryChange[],
  ): MealTag[] {
    const elder = elders.find((e) => e.id === elderId);
    const tempChange = tempChanges.find((tc) => tc.elderId === elderId);

    let tagIds: string[] = [];
    if (tempChange?.mealTagIds !== undefined) {
      tagIds = tempChange.mealTagIds;
    } else {
      tagIds = elder?.mealTags || [];
    }

    return allTags.filter((t) => tagIds.includes(t.id));
  }

  private getElderSpecialNote(
    elderId: string,
    date: string,
    elders: Elder[],
    tempChanges: TemporaryDeliveryChange[],
  ): string {
    const elder = elders.find((e) => e.id === elderId);
    const tempChange = tempChanges.find((tc) => tc.elderId === elderId);

    if (tempChange?.specialMealNote !== undefined) {
      return tempChange.specialMealNote;
    }
    return elder?.specialMealNote || '';
  }

  private getElderAddress(
    elderId: string,
    date: string,
    elders: Elder[],
    tempChanges: TemporaryDeliveryChange[],
  ): string {
    const elder = elders.find((e) => e.id === elderId);
    const tempChange = tempChanges.find((tc) => tc.elderId === elderId);

    if (tempChange?.address !== undefined) {
      return tempChange.address;
    }
    return elder?.address || '';
  }

  private getElderContact(
    elderId: string,
    date: string,
    elders: Elder[],
    tempChanges: TemporaryDeliveryChange[],
  ): string {
    const elder = elders.find((e) => e.id === elderId);
    const tempChange = tempChanges.find((tc) => tc.elderId === elderId);

    if (tempChange?.contact !== undefined) {
      return tempChange.contact;
    }
    return elder?.contact || '';
  }

  private summarizeTempChange(tempChange: TemporaryDeliveryChange, elder: Elder): string {
    const parts: string[] = [];
    if (tempChange.address) parts.push('地址变更');
    if (tempChange.contact) parts.push('联系方式变更');
    if (tempChange.mealTagIds?.length) parts.push('餐食标签变更');
    if (tempChange.specialMealNote) parts.push('特殊餐食备注');
    if (tempChange.volunteerId) parts.push('指定志愿者');
    return parts.length > 0 ? parts.join('、') : '临时变更';
  }

  private determineCurrentStage(
    task: MealTask | undefined,
    prepStatus: PrepStatus | undefined,
    deliveryStatus: DeliveryStatus | undefined,
    exceptions: ExceptionRecord[],
    lastVisit: VisitRecord | undefined,
    isPaused: boolean,
    date: string,
  ): TaskStage {
    if (isPaused || !task) return '任务生成';

    const hasUnresolvedException = exceptions.some((e) => e.status !== '已解决');
    if (hasUnresolvedException) return '异常处置';

    if (deliveryStatus === '已送达' || task.status === '已送达') {
      return this.needsVisitReminder(lastVisit, date) ? '回访关注' : '配送阶段';
    }

    if (
      deliveryStatus === '配送中' ||
      deliveryStatus === '异常' ||
      deliveryStatus === '未接通' ||
      task.status === '配送中' ||
      task.status === '异常'
    ) {
      return '配送阶段';
    }

    if (prepStatus === '备餐中' || prepStatus === '已完成' || prepStatus === '缺餐异常') {
      return '备餐阶段';
    }

    if (task.volunteerId) {
      return '备餐阶段';
    }

    return '自动分配';
  }

  private needsVisitReminder(lastVisit: VisitRecord | undefined, asOfDate: string): boolean {
    if (!lastVisit) return true;

    const visitDate = new Date(lastVisit.visitDate);
    const now = new Date(asOfDate);
    const diffDays = Math.floor((now.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));

    return diffDays >= 7;
  }

  computeSummaryStats(rows: ClosureTaskRow[]): DashboardSummaryStats {
    const stats: DashboardSummaryStats = {
      totalTasks: rows.length,
      assignedTasks: rows.filter((r) => r.volunteerId).length,
      unassignedTasks: rows.filter((r) => !r.volunteerId && !r.taskId.startsWith('paused-')).length,
      pausedTasks: rows.filter((r) => r.taskId.startsWith('paused-')).length,
      specialMealTasks: rows.filter((r) => r.elderSpecialNote || r.elderMealTags.length > 0).length,
      prepCompleted: rows.filter((r) => r.prepStatus === '已完成').length,
      prepInProgress: rows.filter((r) => r.prepStatus === '备餐中').length,
      prepPending: rows.filter((r) => r.prepStatus === '待备餐' || (!r.prepStatus && r.volunteerId))
        .length,
      prepMissing: rows.filter((r) => r.prepStatus === '缺餐异常').length,
      deliveryCompleted: rows.filter(
        (r) => r.deliveryStatus === '已送达' || r.taskStatus === '已送达',
      ).length,
      deliveryInProgress: rows.filter(
        (r) => r.deliveryStatus === '配送中' || r.taskStatus === '配送中',
      ).length,
      deliveryPending: rows.filter(
        (r) => !r.deliveryStatus && r.volunteerId && r.taskStatus !== '已送达',
      ).length,
      deliveryException: rows.filter((r) => r.deliveryStatus === '异常').length,
      deliveryUnreachable: rows.filter((r) => r.deliveryStatus === '未接通').length,
      totalExceptions: rows.reduce((sum, r) => sum + r.exceptionRecords.length, 0),
      pendingExceptions: rows.filter((r) => r.exceptionRecords.some((e) => e.status === '待处理'))
        .length,
      inProgressExceptions: rows.filter((r) =>
        r.exceptionRecords.some((e) => e.status === '处理中'),
      ).length,
      resolvedExceptions: rows.filter(
        (r) =>
          r.exceptionRecords.length > 0 && r.exceptionRecords.every((e) => e.status === '已解决'),
      ).length,
      pendingNotifications: rows.reduce(
        (sum, r) =>
          sum + r.phoneNotifications.filter((n) => n.notificationStatus === '未通知').length,
        0,
      ),
      pendingCallbacks: rows.reduce(
        (sum, r) => sum + r.callbackTasks.filter((c) => c.status === '待回拨').length,
        0,
      ),
      activeCallbacks: rows.reduce(
        (sum, r) => sum + r.callbackTasks.filter((c) => c.status === '回拨中').length,
        0,
      ),
      completedCallbacks: rows.reduce(
        (sum, r) => sum + r.callbackTasks.filter((c) => c.status === '已完成').length,
        0,
      ),
      visitReminderCount: rows.filter((r) => r.visitReminder).length,
    };

    return stats;
  }

  buildStageTimeline(rows: ClosureTaskRow[]): StageTimelineItem[] {
    const total = rows.length;
    const timeline: StageTimelineItem[] = [];

    for (const stage of TASK_STAGES) {
      const count = rows.filter((r) => r.currentStage === stage).length;
      const config = STAGE_CONFIG[stage];

      timeline.push({
        stage,
        label: stage,
        icon: config.icon,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: config.color,
        bgColor: config.bgColor,
      });
    }

    return timeline;
  }

  collectAvailableFilters(rows: ClosureTaskRow[]): {
    volunteers: { id: string; name: string }[];
    elders: { id: string; name: string }[];
    mealTags: MealTag[];
    exceptionSources: ExceptionSource[];
    exceptionStatuses: ExceptionStatus[];
  } {
    const volunteerSet = new Map<string, { id: string; name: string }>();
    const elderSet = new Map<string, { id: string; name: string }>();
    const mealTagSet = new Map<string, MealTag>();
    const excSourceSet = new Set<ExceptionSource>();
    const excStatusSet = new Set<ExceptionStatus>();

    for (const row of rows) {
      if (row.volunteerId) {
        volunteerSet.set(row.volunteerId, { id: row.volunteerId, name: row.volunteerName });
      }
      elderSet.set(row.elderId, { id: row.elderId, name: row.elderName });
      for (const tag of row.elderMealTags) {
        mealTagSet.set(tag.id, tag);
      }
      for (const exc of row.exceptionRecords) {
        excSourceSet.add(exc.source);
        excStatusSet.add(exc.status);
      }
    }

    return {
      volunteers: Array.from(volunteerSet.values()).sort((a, b) => a.name.localeCompare(b.name)),
      elders: Array.from(elderSet.values()).sort((a, b) => a.name.localeCompare(b.name)),
      mealTags: Array.from(mealTagSet.values()).sort((a, b) => a.name.localeCompare(b.name)),
      exceptionSources: Array.from(excSourceSet).sort(),
      exceptionStatuses: Array.from(excStatusSet).sort(),
    };
  }

  filterRows(rows: ClosureTaskRow[], filters: DashboardFilters): ClosureTaskRow[] {
    return rows.filter((row) => {
      if (filters.volunteerIds.length > 0) {
        if (!filters.volunteerIds.includes(row.volunteerId)) return false;
      }
      if (filters.elderIds.length > 0) {
        if (!filters.elderIds.includes(row.elderId)) return false;
      }
      if (filters.mealTagIds.length > 0) {
        const rowTagIds = row.elderMealTags.map((t) => t.id);
        const hasMatch = filters.mealTagIds.some((tid) => rowTagIds.includes(tid));
        if (!hasMatch) return false;
      }
      if (filters.exceptionSources.length > 0) {
        const rowSources = row.exceptionRecords.map((e) => e.source);
        const hasMatch = filters.exceptionSources.some((s) => rowSources.includes(s));
        if (!hasMatch) return false;
      }
      if (filters.exceptionStatuses.length > 0) {
        const rowStatuses = row.exceptionRecords.map((e) => e.status);
        const hasMatch = filters.exceptionStatuses.some((s) => rowStatuses.includes(s));
        if (!hasMatch) return false;
      }
      if (filters.taskStages.length > 0) {
        if (!filters.taskStages.includes(row.currentStage)) return false;
      }
      if (filters.prepStatuses.length > 0) {
        if (!row.prepStatus || !filters.prepStatuses.includes(row.prepStatus as PrepStatus))
          return false;
      }
      if (filters.deliveryStatuses.length > 0) {
        if (
          !row.deliveryStatus ||
          !filters.deliveryStatuses.includes(row.deliveryStatus as DeliveryStatus)
        )
          return false;
      }
      return true;
    });
  }
}
