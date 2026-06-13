import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  VolunteerDailySummary,
  DeliveryTask,
  DeliveryStatus,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_ICONS,
  DeliveryViewMode,
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
  @Input() kanbanSort: KanbanSortMap = {};
  @Input() temporaryDeliveryChanges: TemporaryDeliveryChange[] = [];

  @Output() statusUpdated = new EventEmitter<DeliveryWritebackResult>();
  @Output() backToSchedule = new EventEmitter<void>();

  viewMode: DeliveryViewMode = 'selector';
  selectedVolunteerId: string = '';
  summary: VolunteerDailySummary | null = null;
  selectedTaskIndex: number = 0;
  storageListener!: () => void;
  DELIVERY_STATUS_COLORS = DELIVERY_STATUS_COLORS;
  DELIVERY_STATUS_ICONS = DELIVERY_STATUS_ICONS;
  Math = Math;

  constructor(private deliveryService: VolunteerDeliveryService) {}

  ngOnInit() {
    if (this.volunteerId) {
      this.selectedVolunteerId = this.volunteerId;
      this.viewMode = 'delivery';
      this.refreshSummary();
    }
    this.storageListener = () => {
      this.refreshSummary();
    };
    window.addEventListener('storage', this.storageListener as unknown as EventListener);
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
    const result = this.deliveryService.updateDeliveryStatus(
      this.date,
      data.taskId,
      data.status,
      data.exceptionNote,
    );

    const writeback: DeliveryWritebackResult = {};
    if (result.taskUpdated) {
      writeback.taskUpdated = {
        taskId: result.taskUpdated.id,
        status: result.taskUpdated.status,
        exception: result.taskUpdated.exception,
        deliveryStatus: data.status,
      };
    }

    const isException = data.status === '异常' || data.status === '未接通';
    const origTask = this.tasks.find(t => t.id === data.taskId);
    const origElder = this.elders.find(e => origTask ? e.id === origTask.elderId : false);

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

    this.statusUpdated.emit(writeback);
    this.refreshSummary();
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
