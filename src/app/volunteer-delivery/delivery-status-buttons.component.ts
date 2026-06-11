import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DeliveryStatus,
  DELIVERY_STATUSES,
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_ICONS,
} from './volunteer-delivery.types';

@Component({
  selector: 'app-delivery-status-buttons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-status-buttons.component.html',
  styleUrls: ['./delivery-status-buttons.component.css'],
})
export class DeliveryStatusButtonsComponent {
  @Input() currentStatus: DeliveryStatus = '待配送';
  @Input() disabled: boolean = false;
  @Input() compact: boolean = false;

  @Output() updateStatus = new EventEmitter<{ status: DeliveryStatus; exceptionNote: string }>();

  DELIVERY_STATUSES = DELIVERY_STATUSES;
  DELIVERY_STATUS_COLORS = DELIVERY_STATUS_COLORS;
  DELIVERY_STATUS_ICONS = DELIVERY_STATUS_ICONS;

  showExceptionEditor = false;
  exceptionNote = '';
  pendingStatus: DeliveryStatus | null = null;

  getStatusColor(status: DeliveryStatus): string {
    return DELIVERY_STATUS_COLORS[status];
  }

  isExceptionStatus(status: DeliveryStatus): boolean {
    return status === '异常' || status === '未接通';
  }

  onClickStatus(status: DeliveryStatus) {
    if (this.disabled) return;
    if (this.currentStatus === status) return;

    if (this.isExceptionStatus(status)) {
      this.pendingStatus = status;
      this.showExceptionEditor = true;
      this.exceptionNote = status === '未接通' ? '电话无人接听，门铃无人应答' : '';
      return;
    }

    this.updateStatus.emit({ status, exceptionNote: '' });
  }

  confirmException() {
    if (!this.pendingStatus) return;
    this.updateStatus.emit({
      status: this.pendingStatus,
      exceptionNote: this.exceptionNote.trim(),
    });
    this.cancelExceptionEditor();
  }

  cancelExceptionEditor() {
    this.showExceptionEditor = false;
    this.pendingStatus = null;
    this.exceptionNote = '';
  }
}
