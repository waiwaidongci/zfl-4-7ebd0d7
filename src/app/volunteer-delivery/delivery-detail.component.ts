import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, DeliveryStatusButtonsComponent],
  templateUrl: './delivery-detail.component.html',
  styleUrls: ['./delivery-detail.component.css'],
})
export class DeliveryDetailComponent implements OnInit, OnChanges {
  @Input() task: DeliveryTask | null = null;
  @Input() index: number = 0;
  @Input() total: number = 0;

  @Output() updateStatus = new EventEmitter<{ taskId: string; status: DeliveryStatus; exceptionNote: string }>();
  @Output() prevTask = new EventEmitter<void>();
  @Output() nextTask = new EventEmitter<void>();
  @Output() backToList = new EventEmitter<void>();

  DELIVERY_STATUS_COLORS = DELIVERY_STATUS_COLORS;
  DELIVERY_STATUS_ICONS = DELIVERY_STATUS_ICONS;

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges) {}

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
    }
  }

  openMap(address: string) {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    window.open(`https://map.baidu.com/search/${encoded}`, '_blank');
  }
}
