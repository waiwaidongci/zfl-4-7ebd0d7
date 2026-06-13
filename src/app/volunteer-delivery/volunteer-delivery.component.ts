import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  VolunteerDailySummary,
  DeliveryTask,
  DeliveryStatus,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_ICONS,
  DeliveryViewMode,
  OfflineDeliveryDraft,
  OfflineDraftStatus,
} from './volunteer-delivery.types';
import {
  VolunteerDeliveryService,
  Volunteer,
  MealTask,
  Elder,
  MealTag,
  VisitRecord,
  ExceptionRecord,
  PhoneNotification,
  KanbanSortMap,
  TemporaryDeliveryChange,
} from './volunteer-delivery.service';
import { VolunteerSelectorComponent } from './volunteer-selector.component';
import { DeliveryDetailComponent } from './delivery-detail.component';

type DeliveryWritebackResult = {
  taskUpdated?: { taskId: string; status: MealTask['status']; exception: string; deliveryStatus: DeliveryStatus };
  exceptionCreated?: ExceptionRecord;
  notificationCreated?: PhoneNotification;
  notificationUpdated?: { notificationId: string; status: any; remark?: string };
  draftCreated?: OfflineDeliveryDraft;
  mergeResult?: any;
};

type DraftMergeEvent = {
  mergeResult: any;
  conflicts: OfflineDeliveryDraft[];
};

@Component({
  selector: 'app-volunteer-delivery',
  standalone: true,
  imports: [
    CommonModule,
    VolunteerSelectorComponent,
    DeliveryDetailComponent,
  ],
  templateUrl: './volunteer-delivery.component.html',
  styleUrls: ['./volunteer-delivery.component.css'],
})
export class VolunteerDeliveryComponent implements OnInit, OnChanges, OnDestroy {
  @Input() date: string = '';
  @Input() volunteerId: string = '';
  @Input() volunteers: Volunteer[] = [];
  @Input() tasks: MealTask[] = [];
  @Input() elders: Elder[] = [];
  @Input() mealTags: MealTag[] = [];
  @Input() visitRecords: VisitRecord[] = [];
  @Input() exceptionRecords: ExceptionRecord[] = [];
  @Input() phoneNotifications: PhoneNotification[] = [];
  @Input() kanbanSort: KanbanSortMap = {};
  @Input() temporaryDeliveryChanges: TemporaryDeliveryChange[] = [];

  @Output() statusUpdated = new EventEmitter<DeliveryWritebackResult>();
  @Output() backToSchedule = new EventEmitter<void>();
  @Output() draftsMerged = new EventEmitter<DraftMergeEvent>();
  @Output() conflictDetected = new EventEmitter<OfflineDeliveryDraft[]>();

  viewMode: DeliveryViewMode = 'selector';
  selectedVolunteerId: string = '';
  summary: VolunteerDailySummary | null = null;
  selectedTaskIndex: number = 0;
  storageListener!: () => void;
  DELIVERY_STATUS_COLORS = DELIVERY_STATUS_COLORS;
  DELIVERY_STATUS_ICONS = DELIVERY_STATUS_ICONS;
  Math = Math;

  isOnline = true;
  pendingDraftCount = 0;
  conflictDraftCount = 0;
  showDraftPanel = false;
  lastSyncMessage = '';

  constructor(private deliveryService: VolunteerDeliveryService) {}

  ngOnInit() {
    if (this.volunteerId) {
      this.selectedVolunteerId = this.volunteerId;
      this.viewMode = 'delivery';
      this.refreshSummary();
    }
    this.storageListener = () => {
      this.refreshSummary();
      this.updateDraftCounts();
    };
    window.addEventListener('storage', this.storageListener as unknown as EventListener);
    this.updateDraftCounts();
    this.startOnlineMonitoring();
  }

  private startOnlineMonitoring() {
    setInterval(() => {
      const wasOnline = this.isOnline;
      this.isOnline = this.deliveryService.isSyncAvailable();
      this.updateDraftCounts();
      if (!wasOnline && this.isOnline) {
        this.tryMergeDrafts();
      }
    }, 5000);
  }

  private updateDraftCounts() {
    this.pendingDraftCount = this.deliveryService.getPendingDraftCount();
    this.conflictDraftCount = this.deliveryService.getConflictDraftCount();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['date'] || changes['volunteerId'] || changes['tasks'] || changes['elders'] || changes['volunteers'] || changes['mealTags'] || changes['visitRecords'] || changes['kanbanSort'] || changes['temporaryDeliveryChanges']) {
      if (changes['volunteerId'] && this.volunteerId) {
        this.selectedVolunteerId = this.volunteerId;
        this.viewMode = 'delivery';
      }
      this.refreshSummary();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('storage', this.storageListener as unknown as EventListener);
  }

  refreshSummary() {
    if (this.viewMode !== 'delivery' || !this.selectedVolunteerId || !this.date) return;
    this.summary = this.deliveryService.generateVolunteerSummary(
      this.date,
      this.selectedVolunteerId,
      this.tasks,
      this.volunteers,
      this.elders,
      this.mealTags,
      this.visitRecords,
      this.kanbanSort,
      this.temporaryDeliveryChanges,
    );
    if (this.summary && this.selectedTaskIndex >= this.summary.tasks.length) {
      this.selectedTaskIndex = Math.max(0, this.summary.tasks.length - 1);
    }
  }

  onSelectVolunteer(id: string) {
    this.selectedVolunteerId = id;
    this.viewMode = 'delivery';
    this.selectedTaskIndex = 0;
    this.refreshSummary();
  }

  onBackToSelector() {
    this.viewMode = 'selector';
    this.selectedVolunteerId = '';
    this.summary = null;
    this.selectedTaskIndex = 0;
  }

  onBackToSchedule() {
    this.backToSchedule.emit();
  }

  onSelectTask(index: number) {
    this.selectedTaskIndex = index;
  }

  onPrevTask() {
    if (this.selectedTaskIndex > 0) {
      this.selectedTaskIndex--;
    }
  }

  onNextTask() {
    if (this.summary && this.selectedTaskIndex < this.summary.tasks.length - 1) {
      this.selectedTaskIndex++;
    }
  }

  onBackToList() {
    this.selectedTaskIndex = -1;
  }

  getStatusColor(status: DeliveryStatus): string {
    return DELIVERY_STATUS_COLORS[status];
  }

  onUpdateTaskStatus(data: { taskId: string; status: DeliveryStatus; exceptionNote: string }) {
    const writeback: DeliveryWritebackResult = {};
    const isException = data.status === '异常' || data.status === '未接通';
    const origTask = this.tasks.find(t => t.id === data.taskId);
    let origElder = this.elders.find(e => origTask ? e.id === origTask.elderId : false);

    if (origTask && origElder && this.date) {
      const tc = this.temporaryDeliveryChanges.find(c => c.elderId === origElder!.id && c.date === this.date);
      if (tc) {
        origElder = {
          ...origElder,
          address: tc.address !== undefined ? tc.address : origElder.address,
          contact: tc.contact !== undefined ? tc.contact : origElder.contact,
          mealTags: tc.mealTagIds !== undefined ? tc.mealTagIds : origElder.mealTags,
          specialMealNote: tc.specialMealNote !== undefined ? tc.specialMealNote : origElder.specialMealNote,
        };
      }
    }

    if (!this.isOnline) {
      const draft = this.deliveryService.createStatusUpdateDraft(
        data.taskId,
        this.date,
        this.selectedVolunteerId,
        data.status,
        data.exceptionNote
      );
      writeback.draftCreated = draft;

      const localResult = this.deliveryService.updateDeliveryStatus(
        this.date,
        data.taskId,
        data.status,
        data.exceptionNote,
      );

      if (localResult.taskUpdated) {
        writeback.taskUpdated = {
          taskId: localResult.taskUpdated.id,
          status: localResult.taskUpdated.status,
          exception: localResult.taskUpdated.exception,
          deliveryStatus: data.status,
        };
      }

      if (isException && origTask && origElder) {
        const stored = this.deliveryService.exportStorageData();
        const storedData = stored[this.date]?.[data.taskId];

        if (storedData && !storedData.exceptionRecorded) {
          const excRecord = this.deliveryService.createDeliveryExceptionRecord(
            origTask,
            origElder,
            data.status,
            data.exceptionNote,
          );
          writeback.exceptionCreated = excRecord;
          this.deliveryService.markDeliveryExceptionRecorded(this.date, data.taskId);
        }

        if (storedData && !storedData.notificationAdded) {
          const notification = this.deliveryService.createDeliveryPhoneNotification(
            origTask,
            origElder,
            data.status,
            data.exceptionNote,
          );
          writeback.notificationCreated = notification;
          this.deliveryService.markDeliveryNotificationAdded(this.date, data.taskId);
        }
      }

      this.lastSyncMessage = `已保存为离线草稿，将在恢复同步后自动同步`;
      setTimeout(() => { this.lastSyncMessage = ''; }, 3000);
    } else {
      const result = this.deliveryService.updateDeliveryStatus(
        this.date,
        data.taskId,
        data.status,
        data.exceptionNote,
      );

      if (result.taskUpdated) {
        writeback.taskUpdated = {
          taskId: result.taskUpdated.id,
          status: result.taskUpdated.status,
          exception: result.taskUpdated.exception,
          deliveryStatus: data.status,
        };
      }

      if (isException && origTask && origElder) {
        const stored = this.deliveryService.exportStorageData();
        const storedData = stored[this.date]?.[data.taskId];

        if (storedData && !storedData.exceptionRecorded) {
          const excRecord = this.deliveryService.createDeliveryExceptionRecord(
            origTask,
            origElder,
            data.status,
            data.exceptionNote,
          );
          writeback.exceptionCreated = excRecord;
          this.deliveryService.markDeliveryExceptionRecorded(this.date, data.taskId);
        }

        if (storedData && !storedData.notificationAdded) {
          const notification = this.deliveryService.createDeliveryPhoneNotification(
            origTask,
            origElder,
            data.status,
            data.exceptionNote,
          );
          writeback.notificationCreated = notification;
          this.deliveryService.markDeliveryNotificationAdded(this.date, data.taskId);
        }
      }
    }

    this.updateDraftCounts();
    this.statusUpdated.emit(writeback);
    this.refreshSummary();
  }

  tryMergeDrafts() {
    if (!this.isOnline || this.pendingDraftCount === 0) return;

    const mergeResult = this.deliveryService.attemptMergePendingDrafts(
      this.tasks,
      this.elders,
      this.exceptionRecords,
      this.phoneNotifications
    );

    const writeback: DeliveryWritebackResult = {
      mergeResult,
    };

    if (mergeResult.taskUpdated) {
      writeback.taskUpdated = {
        taskId: mergeResult.taskUpdated.taskId,
        status: mergeResult.taskUpdated.status,
        exception: mergeResult.taskUpdated.exception,
        deliveryStatus: mergeResult.taskUpdated.status as DeliveryStatus,
      };
    }
    if (mergeResult.exceptionCreated) {
      writeback.exceptionCreated = mergeResult.exceptionCreated;
    }
    if (mergeResult.notificationCreated) {
      writeback.notificationCreated = mergeResult.notificationCreated;
    }
    if (mergeResult.notificationUpdated) {
      writeback.notificationUpdated = mergeResult.notificationUpdated;
    }

    this.statusUpdated.emit(writeback);

    if (mergeResult.conflicts.length > 0) {
      this.conflictDetected.emit(mergeResult.conflicts);
      this.lastSyncMessage = `检测到 ${mergeResult.conflicts.length} 个冲突需要手动处理`;
    } else {
      this.lastSyncMessage = `已同步 ${mergeResult.mergedCount} 条离线操作`;
      setTimeout(() => { this.lastSyncMessage = ''; }, 3000);
    }

    this.draftsMerged.emit({
      mergeResult,
      conflicts: mergeResult.conflicts,
    });

    this.updateDraftCounts();
    this.refreshSummary();
  }

  getTaskDrafts(taskId: string): OfflineDeliveryDraft[] {
    return this.deliveryService.getDraftsForTask(taskId);
  }

  hasTaskDrafts(taskId: string): boolean {
    return this.getTaskDrafts(taskId).length > 0;
  }

  getDraftTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'status-update': '状态更新',
      'exception-note': '异常备注',
      'phone-call-result': '电话结果',
      'visit-reminder-handled': '回访处理',
    };
    return labels[type] || type;
  }

  getDraftStatusLabel(status: OfflineDraftStatus): string {
    const labels: Record<OfflineDraftStatus, string> = {
      'pending': '待同步',
      'syncing': '同步中',
      'synced': '已同步',
      'conflict': '有冲突',
      'discarded': '已丢弃',
    };
    return labels[status] || status;
  }

  getDraftStatusColor(status: OfflineDraftStatus): string {
    const colors: Record<OfflineDraftStatus, string> = {
      'pending': '#d9a84a',
      'syncing': '#5a8fd9',
      'synced': '#4a9f6d',
      'conflict': '#c75454',
      'discarded': '#8a9783',
    };
    return colors[status] || '#8a9783';
  }

  onPhoneCallResult(data: {
    taskId: string;
    phoneNotificationId?: string;
    result: '已通知' | '未接通' | '稍后再拨';
    remark: string;
  }) {
    const writeback: DeliveryWritebackResult = {};

    const existingNotification = this.phoneNotifications.find(
      n => n.taskId === data.taskId && (n.notificationStatus === '未通知' || n.notificationStatus === '稍后再拨')
    );

    if (!this.isOnline) {
      const draft = this.deliveryService.createPhoneCallResultDraft(
        data.taskId,
        this.date,
        this.selectedVolunteerId,
        data.phoneNotificationId || existingNotification?.id || '',
        data.result,
        data.remark
      );
      writeback.draftCreated = draft;
      writeback.notificationUpdated = {
        notificationId: data.phoneNotificationId || existingNotification?.id || '',
        status: data.result,
        remark: data.remark,
      };
      this.lastSyncMessage = `电话结果已保存为离线草稿`;
      setTimeout(() => { this.lastSyncMessage = ''; }, 3000);
    } else {
      writeback.notificationUpdated = {
        notificationId: data.phoneNotificationId || existingNotification?.id || '',
        status: data.result,
        remark: data.remark,
      };
    }

    this.updateDraftCounts();
    this.statusUpdated.emit(writeback);
  }

  onVisitReminderHandled(data: { taskId: string; note: string }) {
    const writeback: DeliveryWritebackResult = {};

    if (!this.isOnline) {
      const draft = this.deliveryService.createVisitReminderHandledDraft(
        data.taskId,
        this.date,
        this.selectedVolunteerId,
        data.note
      );
      writeback.draftCreated = draft;
      this.lastSyncMessage = `回访处理已保存为离线草稿`;
      setTimeout(() => { this.lastSyncMessage = ''; }, 3000);
    }

    this.updateDraftCounts();
    this.statusUpdated.emit(writeback);
  }

  getCurrentTask(): DeliveryTask | null {
    if (!this.summary || this.selectedTaskIndex < 0) return null;
    return this.summary.tasks[this.selectedTaskIndex] || null;
  }

  getProgressPct(): number {
    if (!this.summary || this.summary.totalTasks === 0) return 0;
    return Math.round((this.summary.completedTasks / this.summary.totalTasks) * 100);
  }

  isAllCompleted(): boolean {
    return !!this.summary && this.summary.completedTasks >= this.summary.totalTasks;
  }

  getQuickStatusSummary(): { label: string; count: number; color: string; icon: string }[] {
    if (!this.summary) return [];
    return [
      { label: '待配送', count: this.summary.pendingTasks, color: DELIVERY_STATUS_COLORS['待配送'], icon: DELIVERY_STATUS_ICONS['待配送'] },
      { label: '配送中', count: this.summary.inProgressTasks, color: DELIVERY_STATUS_COLORS['配送中'], icon: DELIVERY_STATUS_ICONS['配送中'] },
      { label: '已送达', count: this.summary.completedTasks, color: DELIVERY_STATUS_COLORS['已送达'], icon: DELIVERY_STATUS_ICONS['已送达'] },
      { label: '异常', count: this.summary.exceptionTasks, color: DELIVERY_STATUS_COLORS['异常'], icon: DELIVERY_STATUS_ICONS['异常'] },
      { label: '未接通', count: this.summary.unreachableTasks, color: DELIVERY_STATUS_COLORS['未接通'], icon: DELIVERY_STATUS_ICONS['未接通'] },
    ].filter(s => s.count > 0);
  }

  findFirstUndeliveredIndex(): number {
    if (!this.summary) return 0;
    const priorityOrder: DeliveryStatus[] = ['配送中', '待配送', '未接通', '异常', '已送达'];
    for (const status of priorityOrder) {
      const idx = this.summary.tasks.findIndex(t => t.status === status);
      if (idx !== -1) return idx;
    }
    return 0;
  }
}
