import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KitchenPrintViewData, PrintGroup, PrintGroupType } from './meal-prep.types';

@Component({
  selector: 'kitchen-print',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './kitchen-print.component.html',
  styleUrls: ['./kitchen-print.component.css'],
})
export class KitchenPrintComponent implements OnInit {
  @Input() data!: KitchenPrintViewData;
  @Input() currentDate: string = '';

  @Output() dateChange = new EventEmitter<string>();
  @Output() printRequested = new EventEmitter<void>();

  groupFilters: Record<PrintGroupType, boolean> = {
    tag: true,
    special: true,
    paused: true,
    missing: true,
    all: true,
  };

  allGroupTypes: PrintGroupType[] = ['tag', 'special', 'paused', 'missing', 'all'];

  groupTypeLabels: Record<PrintGroupType, string> = {
    tag: '餐食标签',
    special: '特殊餐食备注',
    paused: '暂停送餐',
    missing: '缺餐异常',
    all: '标准餐',
  };

  ngOnInit() {}

  trackGroup(_index: number, group: PrintGroup): string {
    return group.groupKey;
  }

  get filteredGroups(): PrintGroup[] {
    return this.data.groups.filter((g) => this.groupFilters[g.groupType]);
  }

  get activeFilterCount(): number {
    return this.allGroupTypes.filter((t) => this.groupFilters[t]).length;
  }

  shiftDate(days: number) {
    if (!this.currentDate) return;
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().slice(0, 10);
    this.dateChange.emit(newDate);
  }

  onDateInput(newDate: string) {
    if (newDate) {
      this.dateChange.emit(newDate);
    }
  }

  toggleGroupFilter(type: PrintGroupType) {
    this.groupFilters[type] = !this.groupFilters[type];
  }

  selectAllGroups() {
    for (const t of this.allGroupTypes) {
      this.groupFilters[t] = true;
    }
  }

  deselectAllGroups() {
    for (const t of this.allGroupTypes) {
      this.groupFilters[t] = false;
    }
  }

  hasGroupType(type: PrintGroupType): boolean {
    return this.data.groups.some((g) => g.groupType === type);
  }

  triggerPrint() {
    this.printRequested.emit();
  }
}
