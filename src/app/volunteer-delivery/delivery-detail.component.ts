import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DeliveryTask,
  DeliveryStatus,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_ICONS,
} from './volunteer-delivery.types';
import { DeliveryStatusButtonsComponent } from './delivery-status-buttons.component';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, DeliveryStatusButtonsComponent],
  templateUrl: './delivery-detail.component.html',
  styleUrls: ['./delivery-detail.component.css'],
})
export class DeliveryDetailComponent implements OnInit, OnChanges {
  @Input() task: DeliveryTask | null = null;
  @Input() index: number = 0;
  @Input() total: number = 0;
  @Input() isOnline: boolean = true;

  @Output() updateStatus = new EventEmitter<{ taskId: string; status: DeliveryStatus; exceptionNote: string }>();
  @Output() prevTask = new EventEmitter<void>();
  @Output() nextTask = new EventEmitter<void>();
  @Output() backToList = new EventEmitter<void>();
  @Output() phoneCallResult = new EventEmitter<{
    taskId: string;
    phoneNotificationId?: string;
    result: '已通知' | '未接通' | '稍后再拨';
    remark: string;
  }>();
  @Output() visitReminderHandled = new EventEmitter<{
    taskId: string;
    note: string;
  }>();

  DELIVERY_STATUS_COLORS = DELIVERY_STATUS_COLORS;
  DELIVERY_STATUS_ICONS = DELIVERY_STATUS_ICONS;

  showPhoneCallResult = false;
  phoneCallResultValue: '已通知' | '未接通' | '稍后再拨' = '已通知';
  phoneCallRemark = '';

  showVisitReminderNote = false;
  visitReminderNote = '';

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['task']) {
      this.showPhoneCallResult = false;
      this.showVisitReminderNote = false;
      this.phoneCallRemark = '';
      this.visitReminderNote = '';
    }
  }

  onUpdateStatus(data: { status: DeliveryStatus; exceptionNote: string }) {
    if (!this.task) return;
    this.updateStatus.emit({
      taskId: this.task.taskId,
      status: data.status,
      exceptionNote: data.exceptionNote,
    });
  }

  onPrev() {
    this.prevTask.emit();
  }

  onNext() {
    this.nextTask.emit();
  }

  onBack() {
    this.backToList.emit();
  }

  getStatusColor(status: DeliveryStatus): string {
    return DELIVERY_STATUS_COLORS[status];
  }

  callPhone(phone: string) {
    if (!phone) return;
    const match = phone.match(/1[3-9]\d{9}/);
    const cleanPhone = match ? match[0] : phone.replace(/\D/g, '');
    if (cleanPhone) {
      window.location.href = `tel:${cleanPhone}`;
      this.showPhoneCallResult = true;
      this.phoneCallResultValue = '已通知';
      this.phoneCallRemark = '';
    }
  }

  confirmPhoneCallResult() {
    if (!this.task) return;
    this.phoneCallResult.emit({
      taskId: this.task.taskId,
      result: this.phoneCallResultValue,
      remark: this.phoneCallRemark,
    });
    this.showPhoneCallResult = false;
    this.phoneCallRemark = '';
  }

  cancelPhoneCallResult() {
    this.showPhoneCallResult = false;
    this.phoneCallRemark = '';
  }

  markVisitReminderHandled() {
    this.showVisitReminderNote = true;
  }

  confirmVisitReminderHandled() {
    if (!this.task) return;
    this.visitReminderHandled.emit({
      taskId: this.task.taskId,
      note: this.visitReminderNote,
    });
    this.showVisitReminderNote = false;
    this.visitReminderNote = '';
  }

  cancelVisitReminderHandled() {
    this.showVisitReminderNote = false;
    this.visitReminderNote = '';
  }

  openMap(address: string) {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    window.open(`https://map.baidu.com/search/${encoded}`, '_blank');
  }
}
