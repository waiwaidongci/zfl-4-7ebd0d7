import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  TaskStatusUpdatePayload,
  PrepStatus,
  DeliveryStatus,
} from './closure-dashboard.types';
import { ClosureDashboardService } from './closure-dashboard.service';
import { MealPrepService } from '../meal-prep/meal-prep.service';
import { VolunteerDeliveryService } from '../volunteer-delivery/volunteer-delivery.service';
import { SYNC_INSTANCE, SyncNotification, SyncDataType } from '../sync.service';

export type ClosureStatusUpdateResult = {
  taskUpdated?: MealTask;
  exceptionCreated?: ExceptionRecord;
  exceptionUpdated?: ExceptionRecord;
  notificationCreated?: PhoneNotification;
  notificationUpdated?: PhoneNotification;
  callbackCreated?: CallbackTask;
  callbackUpdated?: CallbackTask;
  prepStatusUpdated?: { taskId: string; status: PrepStatus; missingNote: string };
  deliveryStatusUpdated?: { taskId: string; status: DeliveryStatus; exceptionNote: string };
  volunteerAssigned?: { taskId: string; volunteerId: string };
};

type ActiveFilterChip = {
  key: string;
  label: string;
  value: string;
  filterType: string;
  filterValue: any;
};

type DropdownKey =
  | 'volunteer'
  | 'elder'
  | 'mealTag'
  | 'excSource'
  | 'excStatus'
  | 'prepStatus'
  | 'deliveryStatus';

@Component({
  selector: 'app-closure-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './closure-dashboard.component.html',
  styleUrls: ['./closure-dashboard.component.css'],
})
export class ClosureDashboardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() date: string = new Date().toISOString().slice(0, 10);
  @Input() tasks: MealTask[] = [];
  @Input() elders: Elder[] = [];
  @Input() volunteers: Volunteer[] = [];
  @Input() mealTags: MealTag[] = [];
  @Input() exceptionRecords: ExceptionRecord[] = [];
  @Input() visitRecords: VisitRecord[] = [];
  @Input() phoneNotifications: PhoneNotification[] = [];
  @Input() callbackTasks: CallbackTask[] = [];
  @Input() temporaryDeliveryChanges: TemporaryDeliveryChange[] = [];
  @Input() volunteersInput: Volunteer[] = [];

  @Output() goBack = new EventEmitter<void>();
  @Output() refreshData = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<ClosureStatusUpdateResult>();

  dashboardDate: string = this.date;
  summary: DashboardSummaryStats = this.emptySummary();
  stageTimeline: StageTimelineItem[] = [];
  allRows: ClosureTaskRow[] = [];
  filteredRows: ClosureTaskRow[] = [];
  searchedRows: ClosureTaskRow[] = [];
  availableFilters: {
    volunteers: { id: string; name: string }[];
    elders: { id: string; name: string }[];
    mealTags: MealTag[];
    exceptionSources: ExceptionSource[];
    exceptionStatuses: ExceptionStatus[];
  } = {
    volunteers: [],
    elders: [],
    mealTags: [],
    exceptionSources: [],
    exceptionStatuses: [],
  };

  filters: DashboardFilters = {
    dateRange: { start: '', end: '' },
    volunteerIds: [],
    elderIds: [],
    mealTagIds: [],
    exceptionSources: [],
    exceptionStatuses: [],
    taskStages: [],
    prepStatuses: [],
    deliveryStatuses: [],
  };

  toggleFiltersExpanded = false;
  dropdownOpen: Record<DropdownKey, boolean> = {
    volunteer: false,
    elder: false,
    mealTag: false,
    excSource: false,
    excStatus: false,
    prepStatus: false,
    deliveryStatus: false,
  };

  searchText = '';
  selectedRow: ClosureTaskRow | null = null;

  detailVolunteerId = '';
  detailPrepStatus = '';
  detailPrepMissingNote = '';
  detailDeliveryStatus = '';
  detailDeliveryExceptionNote = '';

  private sync = SYNC_INSTANCE();
  private syncUnsub?: () => void;
  private boundCloseAllDropdowns!: () => void;

  constructor(
    private dashboardService: ClosureDashboardService,
    private prepService: MealPrepService,
    private deliveryService: VolunteerDeliveryService,
  ) {}

  ngOnInit() {
    this.dashboardDate = this.date;
    this.boundCloseAllDropdowns = this.closeAllDropdowns.bind(this);
    this.syncUnsub = this.sync.subscribe((n) => this.handleSyncNotification(n));
    document.addEventListener('click', this.boundCloseAllDropdowns);
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes['date'] ||
      changes['tasks'] ||
      changes['elders'] ||
      changes['volunteers'] ||
      changes['mealTags'] ||
      changes['exceptionRecords'] ||
      changes['visitRecords'] ||
      changes['phoneNotifications'] ||
      changes['callbackTasks'] ||
      changes['temporaryDeliveryChanges']
    ) {
      if (changes['date']) {
        this.dashboardDate = this.date;
      }
      this.refresh();
    }
  }

  ngOnDestroy() {
    if (this.syncUnsub) this.syncUnsub();
    document.removeEventListener('click', this.boundCloseAllDropdowns);
  }

  private emptySummary(): DashboardSummaryStats {
    return {
      totalTasks: 0,
      assignedTasks: 0,
      unassignedTasks: 0,
      pausedTasks: 0,
      specialMealTasks: 0,
      prepCompleted: 0,
      prepInProgress: 0,
      prepPending: 0,
      prepMissing: 0,
      deliveryCompleted: 0,
      deliveryInProgress: 0,
      deliveryPending: 0,
      deliveryException: 0,
      deliveryUnreachable: 0,
      totalExceptions: 0,
      pendingExceptions: 0,
      inProgressExceptions: 0,
      resolvedExceptions: 0,
      pendingNotifications: 0,
      pendingCallbacks: 0,
      activeCallbacks: 0,
      completedCallbacks: 0,
      visitReminderCount: 0,
    };
  }

  private handleSyncNotification(n: SyncNotification) {
    if (n.type === 'synced') {
      const typesToRefresh: SyncDataType[] = [
        'tasks',
        'elders',
        'volunteers',
        'exceptionRecords',
        'visitRecords',
        'phoneNotifications',
        'callbackTasks',
        'prepData',
        'deliveryData',
        'temporaryDeliveryChanges',
      ];
      if (n.dataType && typesToRefresh.includes(n.dataType)) {
        this.refresh();
      }
    }
  }

  onDateChange() {
    this.date = this.dashboardDate;
    this.refresh();
  }

  refresh() {
    if (!this.dashboardDate) return;

    const prepStorageData = this.prepService.exportStorageData();
    const deliveryStorageData = this.deliveryService.exportStorageData();

    this.allRows = this.dashboardService.aggregateClosureRows(
      this.dashboardDate,
      this.tasks,
      this.elders,
      this.volunteers,
      this.mealTags,
      this.exceptionRecords,
      this.visitRecords,
      this.phoneNotifications,
      this.callbackTasks,
      this.temporaryDeliveryChanges,
      prepStorageData,
      deliveryStorageData,
    );

    this.summary = this.dashboardService.computeSummaryStats(this.allRows);
    this.stageTimeline = this.dashboardService.buildStageTimeline(this.allRows);
    this.availableFilters = this.dashboardService.collectAvailableFilters(this.allRows);

    this.applyFilters();
  }

  private applyFilters() {
    this.filteredRows = this.dashboardService.filterRows(this.allRows, this.filters);
    this.applySearch();
  }

  private applySearch() {
    if (!this.searchText.trim()) {
      this.searchedRows = [...this.filteredRows];
      return;
    }
    const search = this.searchText.toLowerCase().trim();
    this.searchedRows = this.filteredRows.filter((row) => {
      return (
        row.elderName.toLowerCase().includes(search) ||
        row.elderAddress.toLowerCase().includes(search) ||
        row.elderContact.includes(search) ||
        row.volunteerName.toLowerCase().includes(search) ||
        row.volunteerArea.toLowerCase().includes(search) ||
        row.volunteerPhone.includes(search)
      );
    });
  }

  get activeFilterCount(): number {
    let count = 0;
    count += this.filters.volunteerIds.length;
    count += this.filters.elderIds.length;
    count += this.filters.mealTagIds.length;
    count += this.filters.exceptionSources.length;
    count += this.filters.exceptionStatuses.length;
    count += this.filters.taskStages.length;
    count += this.filters.prepStatuses.length;
    count += this.filters.deliveryStatuses.length;
    return count;
  }

  get activeFilterChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];

    for (const vid of this.filters.volunteerIds) {
      const v = this.availableFilters.volunteers.find((x) => x.id === vid);
      if (v) {
        chips.push({
          key: `vol-${vid}`,
          label: '志愿者',
          value: v.name,
          filterType: 'volunteer',
          filterValue: vid,
        });
      }
    }

    for (const eid of this.filters.elderIds) {
      const e = this.availableFilters.elders.find((x) => x.id === eid);
      if (e) {
        chips.push({
          key: `elder-${eid}`,
          label: '老人',
          value: e.name,
          filterType: 'elder',
          filterValue: eid,
        });
      }
    }

    for (const tid of this.filters.mealTagIds) {
      const t = this.availableFilters.mealTags.find((x) => x.id === tid);
      if (t) {
        chips.push({
          key: `tag-${tid}`,
          label: '餐食标签',
          value: t.name,
          filterType: 'mealTag',
          filterValue: tid,
        });
      }
    }

    for (const src of this.filters.exceptionSources) {
      chips.push({
        key: `exc-src-${src}`,
        label: '异常来源',
        value: src,
        filterType: 'exceptionSource',
        filterValue: src,
      });
    }

    for (const st of this.filters.exceptionStatuses) {
      chips.push({
        key: `exc-st-${st}`,
        label: '异常状态',
        value: st,
        filterType: 'exceptionStatus',
        filterValue: st,
      });
    }

    for (const stage of this.filters.taskStages) {
      chips.push({
        key: `stage-${stage}`,
        label: '阶段',
        value: stage,
        filterType: 'taskStage',
        filterValue: stage,
      });
    }

    for (const ps of this.filters.prepStatuses) {
      chips.push({
        key: `prep-${ps}`,
        label: '备餐状态',
        value: ps,
        filterType: 'prepStatus',
        filterValue: ps,
      });
    }

    for (const ds of this.filters.deliveryStatuses) {
      chips.push({
        key: `deliv-${ds}`,
        label: '配送状态',
        value: ds,
        filterType: 'deliveryStatus',
        filterValue: ds,
      });
    }

    return chips;
  }

  toggleStageFilter(stage: TaskStage) {
    const idx = this.filters.taskStages.indexOf(stage);
    if (idx === -1) {
      this.filters.taskStages = [stage];
    } else {
      this.filters.taskStages = [];
    }
    this.applyFilters();
  }

  toggleDropdown(key: DropdownKey) {
    for (const k of Object.keys(this.dropdownOpen) as DropdownKey[]) {
      if (k !== key) {
        this.dropdownOpen[k] = false;
      }
    }
    this.dropdownOpen[key] = !this.dropdownOpen[key];
  }

  private closeAllDropdowns() {
    for (const k of Object.keys(this.dropdownOpen) as DropdownKey[]) {
      this.dropdownOpen[k] = false;
    }
  }

  toggleVolunteerFilter(vid: string) {
    const idx = this.filters.volunteerIds.indexOf(vid);
    if (idx === -1) {
      this.filters.volunteerIds.push(vid);
    } else {
      this.filters.volunteerIds.splice(idx, 1);
    }
    this.applyFilters();
  }

  toggleElderFilter(eid: string) {
    const idx = this.filters.elderIds.indexOf(eid);
    if (idx === -1) {
      this.filters.elderIds.push(eid);
    } else {
      this.filters.elderIds.splice(idx, 1);
    }
    this.applyFilters();
  }

  toggleMealTagFilter(tid: string) {
    const idx = this.filters.mealTagIds.indexOf(tid);
    if (idx === -1) {
      this.filters.mealTagIds.push(tid);
    } else {
      this.filters.mealTagIds.splice(idx, 1);
    }
    this.applyFilters();
  }

  toggleExceptionSource(src: ExceptionSource) {
    const idx = this.filters.exceptionSources.indexOf(src);
    if (idx === -1) {
      this.filters.exceptionSources.push(src);
    } else {
      this.filters.exceptionSources.splice(idx, 1);
    }
    this.applyFilters();
  }

  toggleExceptionStatus(st: ExceptionStatus) {
    const idx = this.filters.exceptionStatuses.indexOf(st);
    if (idx === -1) {
      this.filters.exceptionStatuses.push(st);
    } else {
      this.filters.exceptionStatuses.splice(idx, 1);
    }
    this.applyFilters();
  }

  togglePrepStatus(ps: PrepStatus) {
    const idx = this.filters.prepStatuses.indexOf(ps);
    if (idx === -1) {
      this.filters.prepStatuses.push(ps);
    } else {
      this.filters.prepStatuses.splice(idx, 1);
    }
    this.applyFilters();
  }

  toggleDeliveryStatus(ds: DeliveryStatus) {
    const idx = this.filters.deliveryStatuses.indexOf(ds);
    if (idx === -1) {
      this.filters.deliveryStatuses.push(ds);
    } else {
      this.filters.deliveryStatuses.splice(idx, 1);
    }
    this.applyFilters();
  }

  removeFilterChip(chip: ActiveFilterChip) {
    switch (chip.filterType) {
      case 'volunteer':
        this.toggleVolunteerFilter(chip.filterValue);
        break;
      case 'elder':
        this.toggleElderFilter(chip.filterValue);
        break;
      case 'mealTag':
        this.toggleMealTagFilter(chip.filterValue);
        break;
      case 'exceptionSource':
        this.toggleExceptionSource(chip.filterValue);
        break;
      case 'exceptionStatus':
        this.toggleExceptionStatus(chip.filterValue);
        break;
      case 'taskStage':
        const idx = this.filters.taskStages.indexOf(chip.filterValue);
        if (idx !== -1) this.filters.taskStages.splice(idx, 1);
        this.applyFilters();
        break;
      case 'prepStatus':
        this.togglePrepStatus(chip.filterValue);
        break;
      case 'deliveryStatus':
        this.toggleDeliveryStatus(chip.filterValue);
        break;
    }
  }

  clearAllFilters() {
    this.filters = {
      dateRange: { start: '', end: '' },
      volunteerIds: [],
      elderIds: [],
      mealTagIds: [],
      exceptionSources: [],
      exceptionStatuses: [],
      taskStages: [],
      prepStatuses: [],
      deliveryStatuses: [],
    };
    this.searchText = '';
    this.applyFilters();
  }

  onSearchChange() {
    this.applySearch();
  }

  trackByTaskId(index: number, row: ClosureTaskRow): string {
    return row.taskId;
  }

  selectRow(row: ClosureTaskRow) {
    this.selectedRow = row;
    this.detailVolunteerId = row.volunteerId;
    this.detailPrepStatus = row.prepStatus || '';
    this.detailPrepMissingNote = row.prepMissingNote || '';
    this.detailDeliveryStatus = row.deliveryStatus || '';
    this.detailDeliveryExceptionNote = row.deliveryExceptionNote || '';
  }

  closeDetail() {
    this.selectedRow = null;
  }

  openDetail(row: ClosureTaskRow) {
    this.selectRow(row);
  }

  getStatusBadgeStyle(
    type: 'task' | 'prep' | 'delivery' | 'exception' | 'notification' | 'callback',
    status: string,
    hasUnresolved?: boolean,
  ): { [key: string]: string } {
    let color = '#8a9783';
    let bg = '#f0f2ec';

    switch (type) {
      case 'task':
        if (hasUnresolved) {
          color = '#c75454';
          bg = '#fde8e8';
        } else if (status === '已送达') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '配送中') {
          color = '#5a8fd9';
          bg = '#e8f0fa';
        } else if (status === '异常') {
          color = '#c75454';
          bg = '#fde8e8';
        } else {
          color = '#8a9783';
          bg = '#f0f2ec';
        }
        break;
      case 'prep':
        if (status === '已完成') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '备餐中') {
          color = '#d9a84a';
          bg = '#fdf3e0';
        } else if (status === '缺餐异常') {
          color = '#c75454';
          bg = '#fde8e8';
        } else {
          color = '#8a9783';
          bg = '#f0f2ec';
        }
        break;
      case 'delivery':
        if (status === '已送达') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '配送中') {
          color = '#5a8fd9';
          bg = '#e8f0fa';
        } else if (status === '异常' || status === '未接通') {
          color = '#c75454';
          bg = '#fde8e8';
        } else {
          color = '#8a9783';
          bg = '#f0f2ec';
        }
        break;
      case 'exception':
        if (status === '已解决') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '处理中') {
          color = '#5a8fd9';
          bg = '#e8f0fa';
        } else {
          color = '#c75454';
          bg = '#fde8e8';
        }
        break;
      case 'notification':
        if (status === '已通知') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '未接通' || status === '稍后再拨') {
          color = '#d9a84a';
          bg = '#fdf3e0';
        } else {
          color = '#5a8fd9';
          bg = '#e8f0fa';
        }
        break;
      case 'callback':
        if (status === '已完成') {
          color = '#4a9f6d';
          bg = '#e8f5ec';
        } else if (status === '回拨中') {
          color = '#5a8fd9';
          bg = '#e8f0fa';
        } else if (status === '已取消') {
          color = '#8a9783';
          bg = '#f0f2ec';
        } else {
          color = '#d9a84a';
          bg = '#fdf3e0';
        }
        break;
    }

    return {
      color,
      background: bg,
      border: `1px solid ${color}40`,
    };
  }

  severityColor(severity: string): string {
    switch (severity) {
      case '紧急':
        return '#c75454';
      case '较重':
        return '#d9a84a';
      default:
        return '#5a8fd9';
    }
  }

  assignedCount(volunteerId: string): number {
    return this.tasks.filter((t) => t.date === this.dashboardDate && t.volunteerId === volunteerId)
      .length;
  }

  getStageItem(stage: TaskStage): StageTimelineItem | undefined {
    return this.stageTimeline.find((s) => s.stage === stage);
  }

  confirmAssignVolunteer(row: ClosureTaskRow) {
    if (row.taskId.startsWith('paused-')) return;

    const result: ClosureStatusUpdateResult = {
      volunteerAssigned: {
        taskId: row.taskId,
        volunteerId: this.detailVolunteerId,
      },
    };

    const task = this.tasks.find((t) => t.id === row.taskId);
    if (task) {
      result.taskUpdated = {
        ...task,
        volunteerId: this.detailVolunteerId,
        isManuallyModified: true,
      };
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  updatePrepStatus(row: ClosureTaskRow, status: PrepStatus) {
    if (row.taskId.startsWith('paused-')) return;
    this.detailPrepStatus = status;
    this.confirmPrepStatusChange(row);
  }

  confirmPrepStatusChange(row: ClosureTaskRow) {
    if (!this.detailPrepStatus || row.taskId.startsWith('paused-')) return;

    this.prepService.updateItemStatus(
      this.dashboardDate,
      row.taskId,
      this.detailPrepStatus as PrepStatus,
      this.detailPrepMissingNote,
    );

    const result: ClosureStatusUpdateResult = {
      prepStatusUpdated: {
        taskId: row.taskId,
        status: this.detailPrepStatus as PrepStatus,
        missingNote: this.detailPrepMissingNote,
      },
    };

    if (this.detailPrepStatus === '缺餐异常' && this.detailPrepMissingNote) {
      const elder = this.elders.find((e) => e.id === row.elderId);
      const task = this.tasks.find((t) => t.id === row.taskId);
      if (elder && task) {
        const exception = this.prepService.createExceptionRecord(
          task,
          elder,
          this.detailPrepMissingNote,
        );
        const notification = this.prepService.createPhoneNotification(
          task,
          elder,
          this.detailPrepMissingNote,
        );
        result.exceptionCreated = exception as ExceptionRecord;
        result.notificationCreated = notification as PhoneNotification;
        this.prepService.markExceptionRecorded(this.dashboardDate, row.taskId);
        this.prepService.markNotificationAdded(this.dashboardDate, row.taskId);
      }
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  markPrepMissing(row: ClosureTaskRow) {
    if (row.taskId.startsWith('paused-')) return;
    this.detailPrepStatus = '缺餐异常';
    this.detailPrepMissingNote = row.prepMissingNote || '';
  }

  updateDeliveryStatus(row: ClosureTaskRow, status: DeliveryStatus) {
    if (row.taskId.startsWith('paused-')) return;
    this.detailDeliveryStatus = status;
    this.confirmDeliveryStatusChange(row);
  }

  confirmDeliveryStatusChange(row: ClosureTaskRow) {
    if (!this.detailDeliveryStatus || row.taskId.startsWith('paused-')) return;

    const writeback = this.deliveryService.updateDeliveryStatus(
      this.dashboardDate,
      row.taskId,
      this.detailDeliveryStatus as DeliveryStatus,
      this.detailDeliveryExceptionNote,
    );

    const result: ClosureStatusUpdateResult = {
      deliveryStatusUpdated: {
        taskId: row.taskId,
        status: this.detailDeliveryStatus as DeliveryStatus,
        exceptionNote: this.detailDeliveryExceptionNote,
      },
    };

    if (writeback.taskUpdated) {
      result.taskUpdated = writeback.taskUpdated;
    }

    const isException =
      this.detailDeliveryStatus === '异常' || this.detailDeliveryStatus === '未接通';
    if (isException && this.detailDeliveryExceptionNote) {
      const elder = this.elders.find((e) => e.id === row.elderId);
      const task = this.tasks.find((t) => t.id === row.taskId);
      if (elder && task) {
        const exception = this.deliveryService.createDeliveryExceptionRecord(
          task,
          elder,
          this.detailDeliveryStatus as DeliveryStatus,
          this.detailDeliveryExceptionNote,
        );
        const notification = this.deliveryService.createDeliveryPhoneNotification(
          task,
          elder,
          this.detailDeliveryStatus as DeliveryStatus,
          this.detailDeliveryExceptionNote,
        );
        result.exceptionCreated = exception as ExceptionRecord;
        result.notificationCreated = notification as PhoneNotification;
        this.deliveryService.markDeliveryExceptionRecorded(this.dashboardDate, row.taskId);
        this.deliveryService.markDeliveryNotificationAdded(this.dashboardDate, row.taskId);
      }
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  updateExceptionRecordStatus(exceptionId: string, status: ExceptionStatus) {
    const result: ClosureStatusUpdateResult = {};
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const exc = this.exceptionRecords.find((e) => e.id === exceptionId);
    if (exc) {
      const updated: ExceptionRecord = {
        ...exc,
        status,
        updatedAt: timeStr,
      };
      result.exceptionUpdated = updated;
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  deleteExceptionRecord(exceptionId: string) {
    const result: ClosureStatusUpdateResult = {
      exceptionUpdated: { id: exceptionId } as ExceptionRecord,
    };
    this.statusChanged.emit(result);
    this.refresh();
  }

  updateNotificationStatus(
    notificationId: string,
    status: PhoneNotification['notificationStatus'],
  ) {
    const result: ClosureStatusUpdateResult = {};
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const notif = this.phoneNotifications.find((n) => n.id === notificationId);
    if (notif) {
      const updated: PhoneNotification = {
        ...notif,
        notificationStatus: status,
        updatedAt: timeStr,
      };
      result.notificationUpdated = updated;

      if ((status === '未接通' || status === '稍后再拨') && notif.targetType === 'elder') {
        const callback: CallbackTask = {
          id: crypto.randomUUID(),
          notificationId: notif.id,
          taskId: notif.taskId,
          elderId: notif.targetId,
          date: notif.date,
          phone: notif.phone,
          nextCallbackTime: this.getDefaultNextCallbackTime(),
          handler: '',
          status: '待回拨',
          result: '',
          callbackCount: 0,
          remark: notif.remark,
          createdAt: timeStr,
          updatedAt: timeStr,
        };
        result.callbackCreated = callback;
      }
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  private getDefaultNextCallbackTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  updateCallbackStatus(callbackId: string, status: CallbackTask['status']) {
    const result: ClosureStatusUpdateResult = {};
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const cb = this.callbackTasks.find((c) => c.id === callbackId);
    if (cb) {
      const updated: CallbackTask = {
        ...cb,
        status,
        callbackCount: status === '回拨中' ? cb.callbackCount + 1 : cb.callbackCount,
        updatedAt: timeStr,
      };
      result.callbackUpdated = updated;
    }

    this.statusChanged.emit(result);
    this.refresh();
  }

  deleteCallbackTask(callbackId: string) {
    const result: ClosureStatusUpdateResult = {
      callbackUpdated: { id: callbackId } as CallbackTask,
    };
    this.statusChanged.emit(result);
    this.refresh();
  }

  openElderVisit(row: ClosureTaskRow) {
    this.statusChanged.emit({
      taskUpdated: { id: row.taskId, elderId: row.elderId } as MealTask,
    });
  }
}
