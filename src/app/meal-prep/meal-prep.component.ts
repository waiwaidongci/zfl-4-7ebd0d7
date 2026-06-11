import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PrepStatus,
  PrepItem,
  PrepBatch,
  DailyPrepSummary,
  PREP_STATUSES,
} from './meal-prep.types';
import {
  MealPrepService,
  MealTag,
  Elder,
  MealTask,
  ExceptionRecord,
  PhoneNotification,
} from './meal-prep.service';

@Component({
  selector: 'app-meal-prep',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meal-prep.component.html',
  styleUrls: ['./meal-prep.component.css'],
})
export class MealPrepComponent implements OnInit, OnChanges {
  @Input() date: string = '';
  @Input() tasks: MealTask[] = [];
  @Input() elders: Elder[] = [];
  @Input() mealTags: MealTag[] = [];

  @Output() exceptionCreated = new EventEmitter<ExceptionRecord>();
  @Output() notificationCreated = new EventEmitter<PhoneNotification>();
  @Output() taskUpdated = new EventEmitter<{ taskId: string; status: MealTask['status']; exception: string }>();

  summary: DailyPrepSummary | null = null;
  editingMissingTaskId: string | null = null;
  editingMissingNote: string = '';
  PREP_STATUSES = PREP_STATUSES;

  constructor(private prepService: MealPrepService) {}

  ngOnInit() {
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['date'] || changes['tasks'] || changes['elders'] || changes['mealTags']) {
      this.refresh();
    }
  }

  refresh() {
    if (!this.date) return;
    this.summary = this.prepService.generateDailySummary(
      this.date,
      this.tasks,
      this.elders,
      this.mealTags,
    );
  }

  getItemTagObjs(item: PrepItem): MealTag[] {
    return this.mealTags.filter(t => item.mealTagIds.includes(t.id));
  }

  getItemTask(item: PrepItem): MealTask | undefined {
    return this.tasks.find(t => t.id === item.taskId);
  }

  getItemElder(item: PrepItem): Elder | undefined {
    return this.elders.find(e => e.id === item.elder.id);
  }

  getStatusColor(status: PrepStatus): string {
    return this.prepService.getPrepStatusColor(status);
  }

  setItemStatus(item: PrepItem, status: PrepStatus) {
    if (status === '缺餐异常') {
      this.editingMissingTaskId = item.taskId;
      this.editingMissingNote = item.missingNote;
      return;
    }
    this.prepService.updateItemStatus(this.date, item.taskId, status);
    this.refresh();
  }

  startEditMissing(item: PrepItem) {
    this.editingMissingTaskId = item.taskId;
    this.editingMissingNote = item.missingNote;
  }

  cancelEditMissing() {
    this.editingMissingTaskId = null;
    this.editingMissingNote = '';
  }

  confirmMissing(item: PrepItem) {
    const task = this.getItemTask(item);
    const elder = this.getItemElder(item);
    const note = this.editingMissingNote.trim();

    this.prepService.updateItemStatus(this.date, item.taskId, '缺餐异常', note);

    if (!item.exceptionRecorded && task && elder) {
      const excRecord = this.prepService.createExceptionRecord(task, elder, note);
      this.exceptionCreated.emit(excRecord);
      this.taskUpdated.emit({
        taskId: task.id,
        status: '异常',
        exception: excRecord.description,
      });
      this.prepService.markExceptionRecorded(this.date, item.taskId);
    }

    if (!item.notificationAdded && task && elder) {
      const notif = this.prepService.createPhoneNotification(task, elder, note);
      this.notificationCreated.emit(notif);
      this.prepService.markNotificationAdded(this.date, item.taskId);
    }

    this.editingMissingTaskId = null;
    this.editingMissingNote = '';
    this.refresh();
  }

  createExceptionOnly(item: PrepItem) {
    const task = this.getItemTask(item);
    const elder = this.getItemElder(item);
    if (!task || !elder || item.exceptionRecorded) return;

    const note = item.missingNote || '厨房缺餐';
    const excRecord = this.prepService.createExceptionRecord(task, elder, note);
    this.exceptionCreated.emit(excRecord);
    this.taskUpdated.emit({
      taskId: task.id,
      status: '异常',
      exception: excRecord.description,
    });
    this.prepService.markExceptionRecorded(this.date, item.taskId);
    this.refresh();
  }

  createNotificationOnly(item: PrepItem) {
    const task = this.getItemTask(item);
    const elder = this.getItemElder(item);
    if (!task || !elder || item.notificationAdded) return;

    const note = item.missingNote || '厨房缺餐';
    const notif = this.prepService.createPhoneNotification(task, elder, note);
    this.notificationCreated.emit(notif);
    this.prepService.markNotificationAdded(this.date, item.taskId);
    this.refresh();
  }

  batchSetStatus(batch: PrepBatch, status: PrepStatus) {
    const taskIds = batch.items
      .filter(i => !i.isPaused)
      .map(i => i.taskId);
    this.prepService.batchUpdateStatus(this.date, taskIds, status);
    this.refresh();
  }

  batchProgressHint(batch: PrepBatch): string {
    if (batch.totalCount === 0) return '';
    const pct = Math.round((batch.completedCount / batch.totalCount) * 100);
    return `${pct}% 完成`;
  }

  pctRound(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  }
}
