import { CommonModule } from '@angular/common';
import { Component, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MealPrepComponent } from './meal-prep/meal-prep.component';
import { VolunteerDeliveryComponent } from './volunteer-delivery/volunteer-delivery.component';
import { ClosureDashboardComponent, ClosureStatusUpdateResult } from './closure-dashboard/closure-dashboard.component';
import { MealPrepService } from './meal-prep/meal-prep.service';
import { VolunteerDeliveryService } from './volunteer-delivery/volunteer-delivery.service';
import {
  SYNC_INSTANCE,
  SyncDataType,
  SyncConflictGroup,
  RecordConflict,
  FieldConflict,
  ConflictResolution,
} from './sync.service';
import {
  ExceptionRecord as PrepExceptionRecord,
  PhoneNotification as PrepPhoneNotification,
} from './meal-prep/meal-prep.service';

type AppViewMode = 'schedule' | 'meal-prep' | 'volunteer-delivery' | 'closure-dashboard';

type MealTag = {
  id: string;
  name: string;
  color: string;
};

type Elder = {
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

type Volunteer = {
  id: string;
  name: string;
  phone: string;
  capacity: number;
  area: string;
  availableDays: number[];
};

type MealTask = {
  id: string;
  elderId: string;
  date: string;
  volunteerId: string;
  status: '待分配' | '配送中' | '已送达' | '异常';
  exception: string;
  isManuallyModified: boolean;
  specialMealNote: string;
};

type ExceptionCategory = '无人应答' | '地址错误' | '老人拒收' | '餐食问题' | '配送延误' | '老人身体不适' | '其他';
type ExceptionSeverity = '一般' | '较重' | '紧急';
type ExceptionStatus = '待处理' | '处理中' | '已解决';
type ExceptionSource = '备餐缺餐' | '配送异常' | '未接通' | '手动登记';

type ExceptionRecord = {
  id: string;
  taskId: string;
  elderId: string;
  date: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  description: string;
  handler: string;
  status: ExceptionStatus;
  result: string;
  source: ExceptionSource;
  createdAt: string;
  updatedAt: string;
};

type VisitRecord = {
  id: string;
  elderId: string;
  visitDate: string;
  visitMethod: '电话' | '上门' | '视频' | '其他';
  healthFeedback: string;
  mealFeedback: string;
  nextAttention: string;
  createdAt: string;
};

type PhoneNotification = {
  id: string;
  date: string;
  targetType: 'elder' | 'volunteer';
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: '未通知' | '已通知' | '未接通' | '稍后再拨';
  remark: string;
  source: '备餐缺餐' | '配送异常' | '未接通' | '手动登记';
  updatedAt: string;
};

type TemporaryDeliveryChange = {
  id: string;
  elderId: string;
  date: string;
  address?: string;
  contact?: string;
  mealTagIds?: string[];
  specialMealNote?: string;
  volunteerId?: string;
  reason: string;
  createdAt: string;
};

type CallbackTask = {
  id: string;
  notificationId: string;
  taskId: string;
  elderId: string;
  date: string;
  phone: string;
  nextCallbackTime: string;
  handler: string;
  status: '待回拨' | '回拨中' | '已完成' | '已取消';
  result: string;
  callbackCount: number;
  remark: string;
  createdAt: string;
  updatedAt: string;
};

const today = new Date().toISOString().slice(0, 10);

const PRESET_TAGS: MealTag[] = [
  { id: 'low-salt', name: '少盐', color: '#4a9f6d' },
  { id: 'diabetic', name: '糖尿病餐', color: '#d78b63' },
  { id: 'vegetarian', name: '素食', color: '#6ba36a' },
  { id: 'soft-food', name: '软饭', color: '#8b7cc4' },
  { id: 'no-spicy', name: '忌辣', color: '#c75454' },
];

const TAG_COLORS = [
  '#4a9f6d', '#d78b63', '#6ba36a', '#8b7cc4', '#c75454',
  '#5a8fd9', '#d9a84a', '#9a6bd9', '#4aa6a6', '#d97aa6'
];

type KanbanSortMap = Record<string, Record<string, string[]>>;

type KanbanGroup = {
  volunteer: Volunteer;
  tasks: MealTask[];
};

type AutoAssignEntry = {
  taskId: string;
  elderId: string;
  elderName: string;
  elderAddress: string;
  volunteerId: string;
  volunteerName: string;
};

type AutoAssignFailure = {
  taskId: string;
  elderId: string;
  elderName: string;
  elderAddress: string;
  reason: string;
};

type AutoAssignResult = {
  assigned: AutoAssignEntry[];
  failed: AutoAssignFailure[];
};

type BackupData = {
  version: string;
  exportedAt: string;
  elders: Elder[];
  volunteers: Volunteer[];
  tasks: MealTask[];
  mealTags: MealTag[];
  exceptionRecords: ExceptionRecord[];
  visitRecords: VisitRecord[];
  phoneNotifications: PhoneNotification[];
  callbackTasks: CallbackTask[];
  kanbanSort: KanbanSortMap;
  prepData?: any;
  deliveryData?: any;
  temporaryDeliveryChanges?: TemporaryDeliveryChange[];
};

type ImportPreviewItem<T> = {
  item: T;
  status: 'new' | 'duplicate' | 'overwrite';
};

type ImportPreview = {
  elders: ImportPreviewItem<Elder>[];
  volunteers: ImportPreviewItem<Volunteer>[];
  tasks: ImportPreviewItem<MealTask>[];
  mealTags: ImportPreviewItem<MealTag>[];
  exceptionRecords: ImportPreviewItem<ExceptionRecord>[];
  visitRecords: ImportPreviewItem<VisitRecord>[];
  phoneNotifications: ImportPreviewItem<PhoneNotification>[];
  callbackTasks: ImportPreviewItem<CallbackTask>[];
  temporaryDeliveryChanges: ImportPreviewItem<TemporaryDeliveryChange>[];
};

type ImportError = {
  type: 'parse' | 'validation' | 'empty' | 'unknown';
  message: string;
  details?: string[];
};

type SimulationMode = 'off' | 'active';

type DaySimulationStats = {
  date: string;
  totalTasks: number;
  assignedCount: number;
  unassignedCount: number;
  pausedCount: number;
  specialMealCount: number;
  volunteerLoad: Array<{
    volunteerId: string;
    volunteerName: string;
    assigned: number;
    capacity: number;
    area: string;
  }>;
  unassignedReasons: AutoAssignFailure[];
  routeOrder: KanbanGroup[];
  tagBreakdown: Array<{ tagId: string; tagName: string; count: number; color: string }>;
  pausedElders: Array<{ elderId: string; elderName: string; address: string; contact: string }>;
};

type SimulationData = {
  startDate: string;
  endDate: string;
  dates: string[];
  tasks: MealTask[];
  kanbanSort: KanbanSortMap;
  autoAssignResults: Record<string, AutoAssignResult>;
  dayStats: Record<string, DaySimulationStats>;
};

type SimDiffTaskItem = {
  taskId: string;
  elderId: string;
  elderName: string;
  elderAddress: string;
  volunteerId?: string;
  volunteerName?: string;
  routeOrder?: number;
  specialMealNote?: string;
  isPaused?: boolean;
};

type SimDiffAddedTask = SimDiffTaskItem & {
  changeType: 'added';
  addReason?: 'new-elder' | 'resumed-from-pause' | 'delivery-day-added';
};

type SimDiffRemovedTask = SimDiffTaskItem & {
  changeType: 'removed';
  removeReason?: 'paused' | 'delivery-day-removed' | 'elder-removed';
};

type SimDiffVolunteerChange = SimDiffTaskItem & {
  changeType: 'volunteer';
  oldVolunteerId?: string;
  oldVolunteerName?: string;
  newVolunteerId?: string;
  newVolunteerName?: string;
};

type SimDiffRouteChange = {
  changeType: 'route';
  volunteerId: string;
  volunteerName: string;
  oldOrder: Array<{ taskId: string; elderId: string; elderName: string; position: number }>;
  newOrder: Array<{ taskId: string; elderId: string; elderName: string; position: number }>;
  movedTasks: Array<{ taskId: string; elderId: string; elderName: string; oldPos: number; newPos: number }>;
  compositionChanged: boolean;
  addedElders: Array<{ elderId: string; elderName: string }>;
  removedElders: Array<{ elderId: string; elderName: string }>;
};

type SimDiffPausedItem = {
  elderId: string;
  elderName: string;
  address: string;
  contact: string;
  wasPaused: boolean;
  isPaused: boolean;
  changeType: 'pause-new' | 'pause-resume' | 'pause-unchanged';
  changeSource?: 'elder-pause-date' | 'simulation-algorithm' | 'temp-change';
  changeDetail?: string;
  relatedTempChangeId?: string;
  relatedTempChangeReason?: string;
};

type SimDiffSpecialMealItem = {
  taskId: string;
  elderId: string;
  elderName: string;
  oldNote?: string;
  newNote?: string;
  changeType: 'special-new' | 'special-removed' | 'special-changed' | 'special-unchanged';
  changeSource?: 'elder-basic' | 'task-override' | 'temp-change' | 'simulation-algorithm';
  changeDetail?: string;
  relatedTempChangeId?: string;
  relatedTempChangeReason?: string;
  oldSource?: 'elder-basic' | 'task-override' | 'temp-change';
  newSource?: 'elder-basic' | 'task-override' | 'temp-change';
};

type DaySimulationDiff = {
  date: string;
  totalTasks: { before: number; after: number; diff: number };
  assignedTasks: { before: number; after: number; diff: number };
  addedTasks: SimDiffAddedTask[];
  removedTasks: SimDiffRemovedTask[];
  volunteerChanges: SimDiffVolunteerChange[];
  routeChanges: SimDiffRouteChange[];
  pausedChanges: SimDiffPausedItem[];
  specialMealChanges: SimDiffSpecialMealItem[];
  hasChanges: boolean;
  pauseEffectiveCount: {
    newPausedAffected: number;
    resumedAffected: number;
    totalPausedIncluded: number;
  };
};

type SimulationDiffResult = {
  dayDiffs: Record<string, DaySimulationDiff>;
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalVolunteerChanges: number;
    totalRouteChanges: number;
    totalPauseChanges: number;
    totalSpecialMealChanges: number;
    datesWithChanges: string[];
    totalPausedNew: number;
    totalPausedResumed: number;
  };
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MealPrepComponent, VolunteerDeliveryComponent, ClosureDashboardComponent],
  template: `
    <main>
      <header class="hero">
        <div>
          <p>社区老人送餐</p>
          <h1>{{ viewModeLabel }}</h1>
        </div>
        <div class="view-switcher no-print">
          <button type="button" [class.active-view]="viewMode === 'schedule'" (click)="setViewMode('schedule')">📋 每日排班</button>
          <button type="button" [class.active-view]="viewMode === 'meal-prep'" (click)="setViewMode('meal-prep')">🍳 备餐产能与出餐核对</button>
          <button type="button" [class.active-view]="viewMode === 'volunteer-delivery'" (click)="setViewMode('volunteer-delivery')">🚴 志愿者配送</button>
          <button type="button" [class.active-view]="viewMode === 'closure-dashboard'" (click)="setViewMode('closure-dashboard')">📊 闭环仪表盘</button>
        </div>
        <div class="stats">
          <span>{{ elders.length }}位老人</span>
          <span>{{ volunteers.length }}名志愿者</span>
          <span>{{ todayTasks().length }}个今日任务</span>
          <span>{{ todayUnresolvedExceptions().length }}条异常</span>
        </div>
        <div class="hero-actions no-print">
          <button type="button" class="ghost hero-kitchen-btn" (click)="quickOpenKitchenPrint()" *ngIf="viewMode === 'schedule' || viewMode === 'meal-prep'">🖨️ 厨房批次打印</button>
          <button type="button" class="ghost hero-kitchen-btn temp-change-manage-btn" (click)="openTempChangeManagePanel()" *ngIf="viewMode === 'schedule'">
            📋 临时变更管理
            <span class="tc-manage-count" *ngIf="getTempChangeCountByStatus().today > 0">{{ getTempChangeCountByStatus().today }}</span>
          </button>
          <button type="button" class="ghost import-export-btn" (click)="openImportExportPanel()">📦 数据导入导出</button>
        </div>
      </header>

      <ng-container *ngIf="viewMode === 'schedule'">
      <section class="layout">
        <aside class="stack">
          <form class="panel" (ngSubmit)="addElder()">
            <h2>维护老人档案</h2>
            <input name="elderName" [(ngModel)]="elderForm.name" placeholder="姓名" />
            <input name="elderPreference" [(ngModel)]="elderForm.preference" placeholder="餐食偏好（文字备注）" />
            <div class="tag-select">
              <label class="tag-select-label">餐食标签</label>
              <div class="tag-select-grid">
                <label class="tag-check" *ngFor="let tag of mealTags">
                  <input type="checkbox" [checked]="elderForm.mealTags.includes(tag.id)" (change)="toggleElderTag(tag.id)" />
                  <span>{{ tag.name }}</span>
                </label>
              </div>
            </div>
            <input name="elderAddress" [(ngModel)]="elderForm.address" placeholder="送餐地址" />
            <input name="elderContact" [(ngModel)]="elderForm.contact" placeholder="紧急联系" />
            <input name="elderNote" [(ngModel)]="elderForm.note" placeholder="备注" />
            <button>保存老人</button>
          </form>

          <section class="panel elder-list-panel">
            <h2>老人列表 <span class="muted sm-label">({{ elders.length }}位)</span></h2>
            <div class="elder-list">
              <ng-container *ngFor="let elder of elders">
                <div class="elder-card" *ngIf="editingElderId !== elder.id" (click)="selectElder(elder.id)" [class.active]="selectedElderId === elder.id">
                  <div class="elder-card-header">
                    <strong>{{ elder.name }}</strong>
                    <div class="elder-card-btns">
                      <button type="button" class="ghost sm visit-btn" (click)="$event.stopPropagation(); startEditElder(elder)">编辑</button>
                      <button type="button" class="ghost sm visit-btn" (click)="$event.stopPropagation(); openTempChangePanel(elder.id)">临时变更</button>
                      <button type="button" class="ghost sm visit-btn" (click)="$event.stopPropagation(); openVisitPanel(elder.id)">回访</button>
                    </div>
                  </div>
                  <small>{{ elder.address }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(elder.id).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(elder.id)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                  </div>
                  <div class="temp-change-indicator" *ngIf="getElderTempChanges(elder.id).length > 0">
                    <span class="temp-change-badge" *ngFor="let tc of getElderTempChanges(elder.id)">📋 {{ tc.date }} {{ tempChangeSummary(elder.id, tc.date) }}</span>
                  </div>
                  <div class="last-visit" *ngIf="getLastVisit(elder.id)">
                    <span class="visit-dot"></span>
                    <span>上次回访：{{ getLastVisit(elder.id)!.visitDate }} · {{ getLastVisit(elder.id)!.visitMethod }}</span>
                    <p class="visit-summary">{{ summarizeVisit(getLastVisit(elder.id)!) }}</p>
                  </div>
                  <div class="last-visit no-visit" *ngIf="!getLastVisit(elder.id)">
                    <span class="visit-dot no"></span>
                    <span>暂无回访记录</span>
                  </div>
                </div>

                <form class="elder-card elder-edit-card" *ngIf="editingElderId === elder.id" (ngSubmit)="saveEditElder()" (click)="$event.stopPropagation()">
                  <div class="elder-card-header">
                    <strong>编辑：{{ elder.name }}</strong>
                  </div>
                  <input [(ngModel)]="elderEditForm.name" name="editElderName" placeholder="姓名" required />
                  <input [(ngModel)]="elderEditForm.preference" name="editElderPreference" placeholder="餐食偏好（文字备注）" />
                  <div class="tag-select">
                    <label class="tag-select-label">餐食标签</label>
                    <div class="tag-select-grid">
                      <label class="tag-check" *ngFor="let tag of mealTags">
                        <input type="checkbox" [checked]="elderEditForm.mealTags.includes(tag.id)" (change)="toggleElderEditTag(tag.id)" />
                        <span>{{ tag.name }}</span>
                      </label>
                    </div>
                  </div>
                  <input [(ngModel)]="elderEditForm.address" name="editElderAddress" placeholder="送餐地址" />
                  <input [(ngModel)]="elderEditForm.contact" name="editElderContact" placeholder="紧急联系" />
                  <input [(ngModel)]="elderEditForm.note" name="editElderNote" placeholder="备注" />
                  <div class="elder-edit-actions">
                    <button type="button" class="ghost" (click)="cancelEditElder()">取消</button>
                    <button type="submit">保存修改</button>
                  </div>
                </form>
              </ng-container>
            </div>
          </section>

          <section class="panel">
            <h2>餐食偏好标签</h2>
            <div class="tag-list">
              <div class="tag-item" *ngFor="let tag of mealTags">
                <ng-container *ngIf="editingTagId !== tag.id">
                  <span class="tag-chip sm" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                  <button type="button" class="ghost sm tag-edit" (click)="startEditTag(tag)">编辑</button>
                  <button type="button" class="ghost sm tag-del" (click)="removeMealTag(tag.id)" *ngIf="tag.id.startsWith('custom-')">×</button>
                </ng-container>
                <ng-container *ngIf="editingTagId === tag.id">
                  <input class="tag-edit-input" [(ngModel)]="editingTagName" (keyup.enter)="saveEditTag()" (keyup.escape)="cancelEditTag()" />
                  <button type="button" class="sm tag-save" (click)="saveEditTag()">保存</button>
                  <button type="button" class="ghost sm" (click)="cancelEditTag()">取消</button>
                </ng-container>
              </div>
            </div>
            <form class="tag-add-form" (ngSubmit)="addMealTag()">
              <input name="newTagName" [(ngModel)]="newTagName" placeholder="新增自定义标签" />
              <button type="submit">添加</button>
            </form>
          </section>

          <form class="panel" (ngSubmit)="addVolunteer()">
            <h2>维护志愿者</h2>
            <input name="volunteerName" [(ngModel)]="volunteerForm.name" placeholder="姓名" />
            <input name="volunteerPhone" [(ngModel)]="volunteerForm.phone" placeholder="电话" />
            <input name="volunteerArea" [(ngModel)]="volunteerForm.area" placeholder="熟悉片区" />
            <input name="volunteerCapacity" type="number" min="1" [(ngModel)]="volunteerForm.capacity" placeholder="每日可送数量" />
            <button>保存志愿者</button>
          </form>
        </aside>

        <section class="panel simulation-panel" *ngIf="simulationMode === 'active'">
          <div class="simulation-header">
            <div class="simulation-title">
              <span class="sim-badge">模拟模式</span>
              <h2>多日排班模拟</h2>
              <span class="sim-date-range">{{ simulationData?.startDate }} 至 {{ simulationData?.endDate }} ({{ getSimulationDatesCount() }}天)</span>
            </div>
            <div class="simulation-actions">
              <button type="button" class="ghost sm" (click)="openSimulationPanel()">📊 查看详情</button>
              <button type="button" class="auto-assign-btn sm" (click)="autoAssignSimulationTasks()">🔄 自动分配</button>
              <button type="button" class="sm submit-btn" (click)="submitSimulation()">📝 预览差异并提交</button>
              <button type="button" class="ghost sm cancel-btn" (click)="cancelSimulation()">✕ 取消模拟</button>
            </div>
          </div>
          <div class="simulation-day-tabs">
            <button
              type="button"
              class="sim-day-tab"
              *ngFor="let date of simulationData?.dates"
              [class.active]="simulationViewDate === date"
              (click)="setSimulationViewDate(date)"
            >
              {{ date }}
              <span class="sim-day-count">
                {{ getSimulationDayStats(date)?.assignedCount || 0 }}/{{ getSimulationDayStats(date)?.totalTasks || 0 }}
              </span>
            </button>
          </div>
          <div class="simulation-summary">
            <div class="sim-summary-item">
              <strong>{{ getCurrentSimulationStats()?.totalTasks || 0 }}</strong>
              <span>总任务数</span>
            </div>
            <div class="sim-summary-item ok">
              <strong>{{ getCurrentSimulationStats()?.assignedCount || 0 }}</strong>
              <span>已分配</span>
            </div>
            <div class="sim-summary-item warn">
              <strong>{{ getCurrentSimulationStats()?.unassignedCount || 0 }}</strong>
              <span>未分配</span>
            </div>
            <div class="sim-summary-item muted">
              <strong>{{ getCurrentSimulationStats()?.pausedCount || 0 }}</strong>
              <span>暂停送餐</span>
            </div>
            <div class="sim-summary-item special">
              <strong>{{ getCurrentSimulationStats()?.specialMealCount || 0 }}</strong>
              <span>特殊餐食</span>
            </div>
          </div>
        </section>

        <section class="panel" *ngIf="simulationMode === 'off'">
          <div class="toolbar">
            <h2>排班模拟</h2>
            <div class="sim-setup">
              <input type="date" [(ngModel)]="simulationStartDate" />
              <span class="sim-date-sep">至</span>
              <input type="date" [(ngModel)]="simulationEndDate" />
              <button type="button" class="auto-assign-btn" (click)="startSimulation()">开始模拟</button>
            </div>
          </div>
          <p class="muted sim-desc">在模拟模式下，您可以先生成多日排班方案进行预览和调整，确认无误后再提交写入正式数据。模拟期间的所有操作都不会影响现有排班数据。</p>
        </section>

        <section class="panel">
          <div class="toolbar">
            <h2>{{ simulationMode === 'active' ? simulationViewDate + ' 模拟任务' : '每日送餐任务' }}</h2>
            <div>
              <input type="date" [(ngModel)]="taskDate" *ngIf="simulationMode === 'off'" />
              <button type="button" (click)="generateTasks()" *ngIf="simulationMode === 'off'">生成当日任务</button>
              <button type="button" class="auto-assign-btn" (click)="autoAssignTasks()" *ngIf="simulationMode === 'off'">自动分配</button>
            </div>
          </div>

          <div class="auto-assign-result" *ngIf="autoAssignResult">
            <div class="auto-assign-header">
              <h3>自动分配结果</h3>
              <button type="button" class="ghost sm" (click)="autoAssignResult = null">关闭</button>
            </div>
            <div class="auto-assign-summary">
              <span class="assign-ok">✓ 已分配 {{ autoAssignResult.assigned.length }} 单</span>
              <span class="assign-fail" *ngIf="autoAssignResult.failed.length > 0">✗ 未分配 {{ autoAssignResult.failed.length }} 单</span>
            </div>
            <div class="auto-assign-detail" *ngIf="autoAssignResult.assigned.length > 0">
              <p class="detail-title">分配明细</p>
              <div class="detail-row ok" *ngFor="let item of autoAssignResult.assigned">
                <span class="detail-elder">{{ item.elderName }} <small>{{ item.elderAddress }}</small></span>
                <span class="detail-arrow">→</span>
                <span class="detail-volunteer">{{ item.volunteerName }}</span>
              </div>
            </div>
            <div class="auto-assign-detail" *ngIf="autoAssignResult.failed.length > 0">
              <p class="detail-title fail">未分配原因</p>
              <div class="detail-row fail" *ngFor="let item of autoAssignResult.failed">
                <span class="detail-elder">{{ item.elderName }} <small>{{ item.elderAddress }}</small></span>
                <span class="detail-reason">{{ item.reason }}</span>
              </div>
            </div>
          </div>

          <div class="taskList">
            <article *ngFor="let task of filteredTasks()" [class.warn]="task.status === '异常'" [class.temp-change-card]="hasTempChangeOnDate(task.elderId, task.date)">
              <div>
                <strong>{{ elderName(task.elderId) }} <span class="temp-change-badge" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">临时变更</span></strong>
                <span>{{ elderAddress(task.elderId, task.date) }}</span>
                <small>{{ elderPreference(task.elderId, task.date) }}</small>
                <small class="temp-change-detail" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">{{ tempChangeSummary(task.elderId, task.date) }}</small>
                <div class="tag-row" *ngIf="elderMealTags(task.elderId, task.date).length > 0">
                  <span class="tag-chip" *ngFor="let tag of elderMealTags(task.elderId, task.date)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                </div>
                <div class="special-note" *ngIf="elderSpecialNote(task.elderId, task.date)">
                  <small>📝 {{ elderSpecialNote(task.elderId, task.date) }}</small>
                </div>
              </div>
              <select [ngModel]="task.volunteerId" (ngModelChange)="assignTaskWithConflictCheck(task.id, $event)">
                <option value="">未分配</option>
                <option *ngFor="let volunteer of volunteers" [value]="volunteer.id">{{ volunteer.name }} · {{ volunteer.area }}</option>
              </select>
              <div class="actions">
                <button type="button" (click)="setStatusWithConflictCheck(task.id, '配送中')">配送中</button>
                <button type="button" (click)="setStatusWithConflictCheck(task.id, '已送达')">已送达</button>
                <button type="button" class="ghost" (click)="recordException(task.id)">异常</button>
              </div>
              <p>{{ task.status }} <span *ngIf="task.exception">· {{ task.exception }}</span></p>
            </article>
          </div>
        </section>

        <aside class="stack">
          <section class="panel">
            <h2>当日进度</h2>
            <div class="progress">
              <p><strong>{{ countByStatus('待分配') }}</strong><span>待分配</span></p>
              <p><strong>{{ countByStatus('配送中') }}</strong><span>配送中</span></p>
              <p><strong>{{ countByStatus('已送达') }}</strong><span>已送达</span></p>
              <p><strong>{{ countByStatus('异常') }}</strong><span>异常</span></p>
            </div>
          </section>

          <section class="panel">
            <h2>当日餐食标签统计</h2>
            <div class="tag-stats">
              <div class="tag-stat-row" *ngFor="let stat of todayTagStats()">
                <span class="tag-chip" [style.background]="stat.tag.color + '20'" [style.color]="stat.tag.color" [style.borderColor]="stat.tag.color + '50'">{{ stat.tag.name }}</span>
                <strong>{{ stat.count }}份</strong>
              </div>
              <p class="muted" *ngIf="todayTagStats().length === 0">暂无当日任务</p>
            </div>
          </section>

          <section class="panel">
            <div class="toolbar" style="margin-bottom:12px">
              <h2>异常处置闭环</h2>
              <button type="button" class="ghost sm" (click)="openExceptionHistory()">历史查询</button>
            </div>
            <div class="exc-status-row">
              <div class="exc-status-item"><strong>{{ exceptionCountByStatus('待处理') }}</strong><span>待处理</span></div>
              <div class="exc-status-item"><strong>{{ exceptionCountByStatus('处理中') }}</strong><span>处理中</span></div>
              <div class="exc-status-item"><strong>{{ exceptionCountByStatus('已解决') }}</strong><span>已解决</span></div>
            </div>
            <div class="exc-list">
              <div class="exc-item" *ngFor="let exc of todayUnresolvedExceptions()">
                <div class="exc-item-header">
                  <strong>{{ elderName(exc.elderId) }}</strong>
                  <span class="exc-severity" [style.color]="severityColor(exc.severity)" [style.borderColor]="severityColor(exc.severity)">{{ exc.severity }}</span>
                </div>
                <div class="exc-item-meta">
                  <span class="exc-category">{{ exc.category }}</span>
                  <span class="exc-status-tag" [style.color]="statusColor(exc.status)" [style.borderColor]="statusColor(exc.status)">{{ exc.status }}</span>
                </div>
                <p class="exc-item-desc">{{ exc.description }}</p>
                <div class="exc-item-handler" *ngIf="exc.handler"><span>负责人：{{ exc.handler }}</span></div>
                <div class="exc-item-actions">
                  <button type="button" class="ghost sm" *ngIf="exc.status === '待处理'" (click)="updateExceptionStatus(exc.id, '处理中')">开始处理</button>
                  <button type="button" class="sm" *ngIf="exc.status === '处理中'" (click)="updateExceptionStatus(exc.id, '已解决')">标记已解决</button>
                  <button type="button" class="ghost sm" *ngIf="exc.status === '处理中'" (click)="updateExceptionStatus(exc.id, '待处理')">退回待处理</button>
                </div>
              </div>
              <p class="muted" *ngIf="todayUnresolvedExceptions().length === 0">当日暂无待处理异常</p>
            </div>
          </section>

          <section class="panel">
            <h2>志愿者负载</h2>
            <div class="load-item" *ngFor="let volunteer of volunteers">
              <div class="load-header">
                <strong>{{ volunteer.name }}</strong>
                <span>{{ assignedCount(volunteer.id) }}/{{ volunteer.capacity }}单</span>
              </div>
              <div class="load-bar-bg">
                <div class="load-bar-fill" [style.width.%]="(assignedCount(volunteer.id) / volunteer.capacity) * 100" [class.full]="assignedCount(volunteer.id) >= volunteer.capacity" [class.near]="assignedCount(volunteer.id) >= volunteer.capacity * 0.75 && assignedCount(volunteer.id) < volunteer.capacity"></div>
              </div>
              <small class="load-area">{{ volunteer.area }}</small>
            </div>
          </section>

          <section class="panel">
            <div class="toolbar" style="margin-bottom:12px">
              <h2>☎️ 电话通知 & 回拨</h2>
              <button type="button" class="ghost sm" (click)="openPhoneNotificationPanel()">管理</button>
            </div>
            <div class="phone-status-row">
              <div class="phone-status-item"><strong>{{ getPendingNotificationCount() }}</strong><span>待通知</span></div>
              <div class="phone-status-item"><strong>{{ getCallbackRequiredNotificationCount() }}</strong><span>需回拨</span></div>
              <div class="phone-status-item"><strong>{{ getPendingCallbackCount() }}</strong><span>回拨中</span></div>
            </div>
            <div class="phone-callback-list">
              <div class="phone-callback-item" *ngFor="let cb of activeCallbackTasksPreview()">
                <div class="cb-item-header">
                  <strong>{{ elderName(cb.elderId) }}</strong>
                  <span class="cb-status-tag" [style.color]="cb.status === '待回拨' ? '#d9a84a' : '#5a8fd9'" [style.borderColor]="cb.status === '待回拨' ? '#d9a84a' : '#5a8fd9'">{{ cb.status }}</span>
                </div>
                <div class="cb-item-meta">
                  <span>📞 {{ cb.phone }}</span>
                  <span *ngIf="cb.handler">👤 {{ cb.handler }}</span>
                </div>
                <div class="cb-item-time">
                  <span>⏰ {{ cb.nextCallbackTime | date:'yyyy-MM-dd HH:mm' }}</span>
                </div>
                <div class="cb-item-actions">
                  <button type="button" class="ghost sm" (click)="editCallbackTask(cb.id)">详情</button>
                  <button type="button" class="sm" style="background:#4a9f6d" *ngIf="cb.status === '待回拨'" (click)="updateCallbackStatus(cb.id, '回拨中')">开始回拨</button>
                  <button type="button" class="sm" *ngIf="cb.status === '回拨中'" (click)="editCallbackTask(cb.id)">完成回拨</button>
                </div>
              </div>
              <p class="muted center" *ngIf="getPendingCallbackCount() === 0">暂无待处理回拨任务</p>
            </div>
          </section>
        </aside>
      </section>

      <section class="panel kanban-section">
        <div class="toolbar">
          <h2>今日路线看板</h2>
          <span class="muted">{{ taskDate }}</span>
        </div>

        <div class="kanban-grid">
          <div class="kanban-column" *ngFor="let group of kanbanGroups()">
            <div class="kanban-header">
              <strong>{{ group.volunteer.name }}</strong>
              <span>{{ group.tasks.length }}单 · {{ group.volunteer.area }}</span>
            </div>
            <div class="kanban-cards">
              <div class="kanban-card" *ngFor="let task of group.tasks; let i = index" [class.temp-change-card]="hasTempChangeOnDate(task.elderId, task.date)">
                <div class="kanban-card-info">
                  <strong>{{ elderName(task.elderId) }} <span class="temp-change-badge" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">临时变更</span></strong>
                  <span>{{ elderAddress(task.elderId, task.date) }}</span>
                  <small>{{ elderPreference(task.elderId, task.date) }}</small>
                  <small class="temp-change-detail" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">{{ tempChangeSummary(task.elderId, task.date) }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(task.elderId, task.date).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(task.elderId, task.date)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                  </div>
                  <div class="special-note" *ngIf="elderSpecialNote(task.elderId, task.date)">
                    <small>📝 {{ elderSpecialNote(task.elderId, task.date) }}</small>
                  </div>
                  <p class="kanban-status" [class.warn]="task.status === '异常'">{{ task.status }}</p>
                </div>
                <div class="kanban-order-btns">
                  <button type="button" class="ghost sm" [disabled]="i === 0" (click)="moveTask(group.volunteer.id, task.id, -1)">↑</button>
                  <button type="button" class="ghost sm" [disabled]="i === group.tasks.length - 1" (click)="moveTask(group.volunteer.id, task.id, 1)">↓</button>
                </div>
              </div>
              <p class="muted" *ngIf="group.tasks.length === 0">暂无任务</p>
            </div>
          </div>

          <div class="kanban-column kanban-unassigned">
            <div class="kanban-header">
              <strong>未分配</strong>
              <span>{{ unassignedKanbanTasks().length }}单</span>
            </div>
            <div class="kanban-cards">
              <div class="kanban-card" *ngFor="let task of unassignedKanbanTasks()" [class.temp-change-card]="hasTempChangeOnDate(task.elderId, task.date)">
                <div class="kanban-card-info">
                  <strong>{{ elderName(task.elderId) }} <span class="temp-change-badge" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">临时变更</span></strong>
                  <span>{{ elderAddress(task.elderId, task.date) }}</span>
                  <small>{{ elderPreference(task.elderId, task.date) }}</small>
                  <small class="temp-change-detail" *ngIf="hasTempChangeOnDate(task.elderId, task.date)">{{ tempChangeSummary(task.elderId, task.date) }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(task.elderId, task.date).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(task.elderId, task.date)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                  </div>
                  <div class="special-note" *ngIf="elderSpecialNote(task.elderId, task.date)">
                    <small>📝 {{ elderSpecialNote(task.elderId, task.date) }}</small>
                  </div>
                  <p class="kanban-status">{{ task.status }}</p>
                </div>
              </div>
              <p class="muted" *ngIf="unassignedKanbanTasks().length === 0">全部已分配</p>
            </div>
          </div>
        </div>
      </section>
      </ng-container>

      <app-meal-prep
        #mealPrepComp
        *ngIf="viewMode === 'meal-prep'"
        class="view-container"
        [date]="taskDate"
        [tasks]="tasks"
        [elders]="elders"
        [mealTags]="mealTags"
        [volunteers]="volunteers"
        [temporaryDeliveryChanges]="temporaryDeliveryChanges"
        (exceptionCreated)="onPrepExceptionCreated($event)"
        (notificationCreated)="onPrepNotificationCreated($event)"
        (taskUpdated)="onPrepTaskUpdated($event)"
      ></app-meal-prep>

      <app-volunteer-delivery
        *ngIf="viewMode === 'volunteer-delivery'"
        class="view-container"
        [date]="taskDate"
        [volunteers]="volunteers"
        [tasks]="tasks"
        [elders]="elders"
        [mealTags]="mealTags"
        [visitRecords]="visitRecords"
        [kanbanSort]="kanbanSort"
        [temporaryDeliveryChanges]="temporaryDeliveryChanges"
        (statusUpdated)="onDeliveryStatusUpdated($event)"
        (backToSchedule)="setViewMode('schedule')"
      ></app-volunteer-delivery>

      <app-closure-dashboard
        *ngIf="viewMode === 'closure-dashboard'"
        class="view-container"
        [date]="taskDate"
        [tasks]="tasks"
        [elders]="elders"
        [volunteers]="volunteers"
        [mealTags]="mealTags"
        [exceptionRecords]="exceptionRecords"
        [visitRecords]="visitRecords"
        [phoneNotifications]="phoneNotifications"
        [callbackTasks]="callbackTasks"
        [temporaryDeliveryChanges]="temporaryDeliveryChanges"
        [volunteersInput]="volunteers"
        (goBack)="setViewMode('schedule')"
        (refreshData)="refreshDashboardData()"
        (statusChanged)="onDashboardStatusChanged($event)"
      ></app-closure-dashboard>

      <div class="modal-overlay" *ngIf="visitPanelVisible" (click)="closeVisitPanel()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>老人回访记录</h2>
              <p class="muted" *ngIf="selectedElderForVisit">
                {{ selectedElderForVisit.name }} · {{ selectedElderForVisit.address }}
              </p>
            </div>
            <button type="button" class="ghost sm" (click)="closeVisitPanel()">关闭</button>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="visitTab === 'form'" (click)="visitTab = 'form'">新增回访</button>
            <button type="button" [class.active-tab]="visitTab === 'history'" (click)="visitTab = 'history'">
              历史记录
              <span class="badge" *ngIf="getElderVisits(selectedElderIdForVisit).length > 0">
                {{ getElderVisits(selectedElderIdForVisit).length }}
              </span>
            </button>
          </div>

          <div class="modal-body">
            <form *ngIf="visitTab === 'form'" class="visit-form" (ngSubmit)="submitVisit()">
              <div class="form-row">
                <label>回访日期</label>
                <input type="date" name="visitDate" [(ngModel)]="visitForm.visitDate" required />
              </div>
              <div class="form-row">
                <label>回访方式</label>
                <div class="method-group">
                  <label class="method-item">
                    <input type="radio" name="visitMethod" [(ngModel)]="visitForm.visitMethod" value="电话" />
                    <span>电话</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="visitMethod" [(ngModel)]="visitForm.visitMethod" value="上门" />
                    <span>上门</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="visitMethod" [(ngModel)]="visitForm.visitMethod" value="视频" />
                    <span>视频</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="visitMethod" [(ngModel)]="visitForm.visitMethod" value="其他" />
                    <span>其他</span>
                  </label>
                </div>
              </div>
              <div class="form-row">
                <label>健康状况反馈</label>
                <textarea name="healthFeedback" [(ngModel)]="visitForm.healthFeedback" rows="3" placeholder="如：精神状态良好，血压稳定，近期无不适..."></textarea>
              </div>
              <div class="form-row">
                <label>用餐情况反馈</label>
                <textarea name="mealFeedback" [(ngModel)]="visitForm.mealFeedback" rows="3" placeholder="如：饭菜合口味，饭量正常，建议增加汤品..."></textarea>
              </div>
              <div class="form-row">
                <label>下次关注事项</label>
                <textarea name="nextAttention" [(ngModel)]="visitForm.nextAttention" rows="3" placeholder="如：下周提醒复诊，关注血糖变化..."></textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="ghost" (click)="resetVisitForm()">重置</button>
                <button type="submit">保存回访记录</button>
              </div>
            </form>

            <div *ngIf="visitTab === 'history'" class="visit-history">
              <div class="visit-history-item" *ngFor="let record of getElderVisits(selectedElderIdForVisit)">
                <div class="visit-history-header">
                  <div>
                    <strong>{{ record.visitDate }}</strong>
                    <span class="method-tag">{{ record.visitMethod }}</span>
                  </div>
                  <button type="button" class="ghost sm" (click)="deleteVisit(record.id)">删除</button>
                </div>
                <div class="visit-history-content">
                  <div class="visit-block" *ngIf="record.healthFeedback">
                    <label>健康反馈</label>
                    <p>{{ record.healthFeedback }}</p>
                  </div>
                  <div class="visit-block" *ngIf="record.mealFeedback">
                    <label>用餐反馈</label>
                    <p>{{ record.mealFeedback }}</p>
                  </div>
                  <div class="visit-block" *ngIf="record.nextAttention">
                    <label class="attention">下次关注</label>
                    <p class="attention-p">{{ record.nextAttention }}</p>
                  </div>
                </div>
                <small class="created-at">记录于 {{ record.createdAt }}</small>
              </div>
              <p class="muted center" *ngIf="getElderVisits(selectedElderIdForVisit).length === 0">
                暂无回访记录，点击上方"新增回访"开始记录
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="tempChangePanelVisible" (click)="closeTempChangePanel()">
        <div class="modal-panel temp-change-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>临时送餐变更</h2>
              <p class="muted" *ngIf="tempChangeFormElderId">
                {{ tempChangeFormElderName }} · {{ tempChangeFormElderAddress }}
              </p>
            </div>
            <button type="button" class="ghost sm" (click)="closeTempChangePanel()">关闭</button>
          </div>

          <div class="modal-body">
            <div *ngIf="getElderTempChanges(tempChangeFormElderId!).length > 0 && !editingTempChangeId" class="temp-change-existing">
              <h3>已有临时变更</h3>
              <div class="temp-change-list-item" *ngFor="let tc of getElderTempChanges(tempChangeFormElderId!)">
                <div class="temp-change-list-info">
                  <strong>{{ tc.date }}</strong>
                  <span class="temp-change-list-summary">{{ tempChangeSummary(tc.elderId, tc.date) }}</span>
                  <small class="muted">{{ tc.reason }}</small>
                </div>
                <div class="temp-change-list-actions">
                  <button type="button" class="ghost sm" (click)="editTempChange(tc)">编辑</button>
                  <button type="button" class="ghost sm" (click)="deleteTempChange(tc.id)">删除</button>
                </div>
              </div>
            </div>

            <form class="temp-change-form" (ngSubmit)="saveTempChange()">
              <h3 *ngIf="!editingTempChangeId">新增临时变更</h3>
              <h3 *ngIf="editingTempChangeId">编辑临时变更</h3>
              <div class="form-row">
                <label>变更日期 <span class="required">*</span></label>
                <input type="date" name="tempChangeDate" [(ngModel)]="tempChangeForm.date" required />
              </div>
              <div class="form-row">
                <label>变更原因 <span class="required">*</span></label>
                <input name="tempChangeReason" [(ngModel)]="tempChangeForm.reason" placeholder="如：老人临时住女儿家" required />
              </div>
              <div class="form-row">
                <label>临时送餐地址</label>
                <input name="tempChangeAddress" [(ngModel)]="tempChangeForm.address" placeholder="留空则使用长期档案地址" />
              </div>
              <div class="form-row">
                <label>临时联系方式</label>
                <input name="tempChangeContact" [(ngModel)]="tempChangeForm.contact" placeholder="留空则使用长期档案联系方式" />
              </div>
              <div class="form-row">
                <label class="tag-select-label">临时餐食标签</label>
                <div class="tag-select-grid">
                  <label class="tag-check" *ngFor="let tag of mealTags">
                    <input type="checkbox" [checked]="(tempChangeForm.mealTagIds || []).includes(tag.id)" (change)="toggleTempChangeFormTag(tag.id)" />
                    <span>{{ tag.name }}</span>
                  </label>
                </div>
                <small class="muted">勾选则覆盖长期档案的餐食标签，不勾选则使用长期档案</small>
              </div>
              <div class="form-row">
                <label>临时特殊餐食备注</label>
                <input name="tempChangeSpecialNote" [(ngModel)]="tempChangeForm.specialMealNote" placeholder="留空则使用长期档案备注" />
              </div>
              <div class="form-row">
                <label>指定志愿者</label>
                <select name="tempChangeVolunteer" [(ngModel)]="tempChangeForm.volunteerId">
                  <option value="">不指定（使用排班分配）</option>
                  <option *ngFor="let v of volunteers" [value]="v.id">{{ v.name }} ({{ v.area }})</option>
                </select>
              </div>

              <div class="temp-change-conflict" *ngIf="tempChangeConflictInfo">
                <div class="conflict-warning">
                  <strong>检测到冲突</strong>
                  <p *ngFor="let line of tempChangeConflictInfo.split('\\n')">{{ line }}</p>
                </div>
                <div class="conflict-resolution">
                  <label>
                    <input type="radio" name="conflictResolution" [(ngModel)]="tempChangeConflictResolution" value="overwrite-task" />
                    <span>覆盖任务变更</span>
                  </label>
                  <label>
                    <input type="radio" name="conflictResolution" [(ngModel)]="tempChangeConflictResolution" value="keep-both" />
                    <span>保留两者（临时变更仅影响当日）</span>
                  </label>
                  <label>
                    <input type="radio" name="conflictResolution" [(ngModel)]="tempChangeConflictResolution" value="cancel" />
                    <span>取消保存</span>
                  </label>
                </div>
              </div>

              <div class="form-actions">
                <button type="button" class="ghost" (click)="editingTempChangeId = null; tempChangeForm = { date: todayStr, reason: '' }; tempChangeConflictInfo = null" *ngIf="editingTempChangeId">取消编辑</button>
                <button type="submit">{{ editingTempChangeId ? '保存修改' : '添加临时变更' }}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="tempChangeManagePanelVisible" (click)="closeTempChangeManagePanel()">
        <div class="modal-panel temp-change-manage-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>临时变更管理</h2>
              <p class="muted">按日期查看、取消和清理所有临时送餐变更，支持到期提醒和过期清理</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeTempChangeManagePanel()">关闭</button>
          </div>

          <div class="tc-manage-summary-bar">
            <div class="tc-stat-item">
              <span class="tc-stat-num today-num">{{ getTempChangeCountByStatus().today }}</span>
              <span class="tc-stat-label">今日生效</span>
            </div>
            <div class="tc-stat-item">
              <span class="tc-stat-num upcoming-num">{{ getTempChangeCountByStatus().upcoming }}</span>
              <span class="tc-stat-label">即将生效</span>
            </div>
            <div class="tc-stat-item">
              <span class="tc-stat-num expired-num">{{ getTempChangeCountByStatus().expired }}</span>
              <span class="tc-stat-label">已过期</span>
            </div>
            <div class="tc-stat-item total-item">
              <span class="tc-stat-num">{{ temporaryDeliveryChanges.length }}</span>
              <span class="tc-stat-label">总计</span>
            </div>
            <div class="tc-manage-header-actions">
              <button type="button" class="ghost sm" [disabled]="getTempChangeCountByStatus().expired === 0" (click)="cleanupExpiredTempChanges()">
                🗑️ 清理过期
              </button>
            </div>
          </div>

          <div class="tc-filter-tabs">
            <button type="button" [class.active-filter]="tempChangeManageFilter === 'all'" (click)="setTempChangeManageFilter('all')">
              全部 <small>({{ temporaryDeliveryChanges.length }})</small>
            </button>
            <button type="button" [class.active-filter]="tempChangeManageFilter === 'today'" (click)="setTempChangeManageFilter('today')">
              🔴 今日 <small>({{ getTempChangeCountByStatus().today }})</small>
            </button>
            <button type="button" [class.active-filter]="tempChangeManageFilter === 'upcoming'" (click)="setTempChangeManageFilter('upcoming')">
              🟡 即将生效 <small>({{ getTempChangeCountByStatus().upcoming }})</small>
            </button>
            <button type="button" [class.active-filter]="tempChangeManageFilter === 'expired'" (click)="setTempChangeManageFilter('expired')">
              ⚪ 已过期 <small>({{ getTempChangeCountByStatus().expired }})</small>
            </button>
          </div>

          <div class="tc-manage-body">
            <div class="tc-empty-state" *ngIf="getFilteredTempChanges().length === 0">
              <div class="tc-empty-icon">📋</div>
              <p>当前筛选条件下没有临时变更</p>
              <small class="muted">通过左侧老人列表中的"临时变更"按钮为指定老人添加变更</small>
            </div>

            <div class="tc-date-group" *ngFor="let dateKey of getGroupedDateKeys()">
              <div class="tc-date-header">
                <h3>📅 {{ dateKey }}</h3>
                <span class="tc-date-count">{{ getTempChangesGroupedByDate().get(dateKey)!.length }}条变更</span>
              </div>

              <div class="tc-change-list">
                <div
                  class="tc-change-card"
                  *ngFor="let change of getTempChangesGroupedByDate().get(dateKey)!"
                  [class.expanded]="tempChangeManageExpandedId === change.id"
                >
                  <div class="tc-change-main" (click)="toggleTempChangeManageExpand(change.id)">
                    <div class="tc-change-info">
                      <div class="tc-change-elder-row">
                        <strong class="tc-elder-name">{{ getTempChangeElderName(change) }}</strong>
                        <span class="tc-status-tag" [class]="getTempChangeStatusClass(change)">
                          {{ getTempChangeStatusLabel(change) }}
                        </span>
                      </div>
                      <div class="tc-change-summary">{{ tempChangeSummary(change.elderId, change.date) }}</div>
                      <small class="tc-change-reason">💡 {{ change.reason }}</small>
                    </div>
                    <div class="tc-change-actions">
                      <button type="button" class="ghost sm" (click)="$event.stopPropagation(); editTempChange(change); closeTempChangeManagePanel()">
                        ✏️ 编辑
                      </button>
                      <button
                        type="button"
                        class="sm cancel-tc-btn"
                        (click)="$event.stopPropagation(); deleteTempChange(change.id, true)"
                      >
                        ✕ 取消变更
                      </button>
                      <span class="tc-expand-arrow" [class.rotated]="tempChangeManageExpandedId === change.id">▼</span>
                    </div>
                  </div>

                  <div class="tc-change-detail" *ngIf="tempChangeManageExpandedId === change.id">
                    <div class="tc-detail-grid">
                      <div class="tc-detail-col">
                        <h4>👤 老人信息</h4>
                        <div class="tc-detail-row">
                          <span class="tc-detail-label">创建时间</span>
                          <span class="tc-detail-value">{{ change.createdAt }}</span>
                        </div>
                      </div>

                      <div class="tc-detail-col">
                        <h4>📍 送餐地址</h4>
                        <div class="tc-detail-compare">
                          <div class="tc-compare-item original">
                            <span class="tc-compare-label">原地址</span>
                            <p>{{ getTempChangeOriginalAddress(change) }}</p>
                          </div>
                          <div class="tc-compare-arrow" *ngIf="change.address">→</div>
                          <div class="tc-compare-item new" *ngIf="change.address">
                            <span class="tc-compare-label">临时地址</span>
                            <p>{{ change.address }}</p>
                          </div>
                        </div>
                      </div>

                      <div class="tc-detail-col">
                        <h4>📞 联系方式</h4>
                        <div class="tc-detail-compare">
                          <div class="tc-compare-item original">
                            <span class="tc-compare-label">原联系方式</span>
                            <p>{{ getTempChangeOriginalContact(change) }}</p>
                          </div>
                          <div class="tc-compare-arrow" *ngIf="change.contact">→</div>
                          <div class="tc-compare-item new" *ngIf="change.contact">
                            <span class="tc-compare-label">临时联系方式</span>
                            <p>{{ change.contact }}</p>
                          </div>
                        </div>
                      </div>

                      <div class="tc-detail-col">
                        <h4>🏷️ 餐食标签</h4>
                        <div class="tc-detail-compare">
                          <div class="tc-compare-item original">
                            <span class="tc-compare-label">原标签</span>
                            <div class="tc-tag-row">
                              <span
                                class="tag-chip sm"
                                *ngFor="let tag of getTempChangeOriginalMealTags(change)"
                                [style.background]="tag.color + '20'"
                                [style.color]="tag.color"
                                [style.borderColor]="tag.color + '50'"
                              >{{ tag.name }}</span>
                              <small class="muted" *ngIf="getTempChangeOriginalMealTags(change).length === 0">无</small>
                            </div>
                          </div>
                          <div class="tc-compare-arrow" *ngIf="change.mealTagIds">→</div>
                          <div class="tc-compare-item new" *ngIf="change.mealTagIds">
                            <span class="tc-compare-label">临时标签</span>
                            <div class="tc-tag-row">
                              <span
                                class="tag-chip sm"
                                *ngFor="let tag of getTempChangeEffectiveMealTags(change)"
                                [style.background]="tag.color + '20'"
                                [style.color]="tag.color"
                                [style.borderColor]="tag.color + '50'"
                              >{{ tag.name }}</span>
                              <small class="muted" *ngIf="getTempChangeEffectiveMealTags(change).length === 0">清空所有标签</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="tc-detail-col">
                        <h4>📝 特殊餐食备注</h4>
                        <div class="tc-detail-compare">
                          <div class="tc-compare-item original">
                            <span class="tc-compare-label">原备注</span>
                            <p>{{ getTempChangeOriginalSpecialNote(change) || '无' }}</p>
                          </div>
                          <div class="tc-compare-arrow" *ngIf="change.specialMealNote">→</div>
                          <div class="tc-compare-item new" *ngIf="change.specialMealNote">
                            <span class="tc-compare-label">临时备注</span>
                            <p>{{ change.specialMealNote }}</p>
                          </div>
                        </div>
                      </div>

                      <div class="tc-detail-col">
                        <h4>🚚 配送志愿者</h4>
                        <div class="tc-detail-value" [class.has-change]="change.volunteerId">
                          {{ change.volunteerId ? '指定：' + getTempChangeVolunteerName(change) : '不修改，保留任务中的志愿者分配' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="taskModConflictVisible" (click)="closeTaskModConflict()">
        <div class="modal-panel" style="max-width:520px" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>⚠️ 临时变更冲突检测</h2>
              <p class="muted" *ngIf="taskModConflict">{{ elderName(taskModConflict.tempChange.elderId) }} · {{ taskModConflict.tempChange.date }}</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeTaskModConflict()">关闭</button>
          </div>
          <div class="modal-body">
            <div class="temp-change-existing" *ngIf="taskModConflict">
              <h3>当前临时变更内容</h3>
              <div class="temp-change-list-item">
                <div class="temp-change-list-info">
                  <strong>{{ taskModConflict.tempChange.date }}</strong>
                  <span class="temp-change-list-summary">{{ tempChangeSummary(taskModConflict.tempChange.elderId, taskModConflict.tempChange.date) }}</span>
                  <small class="muted">原因：{{ taskModConflict.tempChange.reason }}</small>
                </div>
              </div>

              <h3 style="margin-top:16px">检测到的冲突</h3>
              <ul class="conflict-list">
                <li *ngFor="let c of taskModConflict.conflicts">{{ c }}</li>
              </ul>

              <h3 style="margin-top:16px">请选择处理方式</h3>
              <div class="conflict-resolution">
                <label *ngIf="taskModConflict.operation === 'assign-volunteer'">
                  <input type="radio" name="taskModResolution" [(ngModel)]="taskModConflict.resolution" value="override-temp" />
                  <span><strong>同步修改临时变更</strong>：同时更新临时变更中的志愿者为当前选择</span>
                </label>
                <label>
                  <input type="radio" name="taskModResolution" [(ngModel)]="taskModConflict.resolution" value="apply-task-only" />
                  <span><strong>仅修改当日任务</strong>：临时变更保持不变，本次操作单独生效</span>
                </label>
                <label>
                  <input type="radio" name="taskModResolution" [(ngModel)]="taskModConflict.resolution" value="cancel" />
                  <span><strong>取消本次操作</strong></span>
                </label>
              </div>
            </div>

            <div class="form-actions" style="margin-top:24px">
              <button type="button" class="ghost" (click)="closeTaskModConflict()">取消</button>
              <button type="button" (click)="resolveTaskModConflict()">确认执行</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="exceptionPanelVisible" (click)="closeExceptionPanel()">
        <div class="modal-panel exc-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>异常处置闭环</h2>
              <p class="muted" *ngIf="exceptionFormTaskId">
                {{ exceptionFormElderName() }} · {{ exceptionFormDate() }}
              </p>
            </div>
            <button type="button" class="ghost sm" (click)="closeExceptionPanel()">关闭</button>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="exceptionPanelTab === 'form'" (click)="exceptionPanelTab = 'form'">登记异常</button>
            <button type="button" [class.active-tab]="exceptionPanelTab === 'list'" (click)="exceptionPanelTab = 'list'">
              异常列表
              <span class="badge" *ngIf="exceptionRecords.length > 0">{{ exceptionRecords.length }}</span>
            </button>
          </div>

          <div class="modal-body">
            <form *ngIf="exceptionPanelTab === 'form'" class="exc-form" (ngSubmit)="submitException()">
              <div class="form-row">
                <label>异常分类</label>
                <div class="method-group">
                  <label class="method-item" *ngFor="let cat of EXCEPTION_CATEGORIES">
                    <input type="radio" name="excCategory" [(ngModel)]="exceptionForm.category" [value]="cat" />
                    <span>{{ cat }}</span>
                  </label>
                </div>
              </div>
              <div class="form-row">
                <label>严重程度</label>
                <div class="method-group">
                  <label class="method-item" *ngFor="let sev of EXCEPTION_SEVERITIES">
                    <input type="radio" name="excSeverity" [(ngModel)]="exceptionForm.severity" [value]="sev" />
                    <span>{{ sev }}</span>
                  </label>
                </div>
              </div>
              <div class="form-row">
                <label>异常描述</label>
                <textarea name="excDesc" [(ngModel)]="exceptionForm.description" rows="3" placeholder="请详细描述异常情况..."></textarea>
              </div>
              <div class="form-row">
                <label>处理负责人</label>
                <input name="excHandler" [(ngModel)]="exceptionForm.handler" placeholder="请输入负责人姓名" />
              </div>
              <div class="form-actions">
                <button type="submit">提交异常</button>
              </div>
            </form>

            <div *ngIf="exceptionPanelTab === 'list'" class="exc-modal-list">
              <div class="exc-filter-bar">
                <select [(ngModel)]="exceptionListFilter">
                  <option value="全部">全部状态</option>
                  <option *ngFor="let s of EXCEPTION_STATUSES" [value]="s">{{ s }}</option>
                </select>
                <input type="date" [(ngModel)]="exceptionListDate" placeholder="日期筛选" />
                <select [(ngModel)]="exceptionListElderId">
                  <option value="">全部老人</option>
                  <option *ngFor="let e of elders" [value]="e.id">{{ e.name }}</option>
                </select>
              </div>
              <div class="exc-modal-items">
                <div class="exc-modal-item" *ngFor="let exc of filteredExceptionRecords()">
                  <div class="exc-modal-item-header">
                    <div>
                      <strong>{{ elderName(exc.elderId) }}</strong>
                      <span class="exc-date">{{ exc.date }}</span>
                    </div>
                    <div class="exc-modal-item-tags">
                      <span class="exc-severity" [style.color]="severityColor(exc.severity)" [style.borderColor]="severityColor(exc.severity)">{{ exc.severity }}</span>
                      <span class="exc-status-tag" [style.color]="statusColor(exc.status)" [style.borderColor]="statusColor(exc.status)">{{ exc.status }}</span>
                    </div>
                  </div>
                  <div class="exc-modal-item-meta">
                    <span class="exc-category">{{ exc.category }}</span>
                    <span *ngIf="exc.handler">负责人：{{ exc.handler }}</span>
                  </div>
                  <p class="exc-modal-item-desc">{{ exc.description }}</p>
                  <div class="exc-result-row" *ngIf="exc.result">
                    <label>处理结果：</label>
                    <span>{{ exc.result }}</span>
                  </div>
                  <div class="exc-modal-item-actions">
                    <button type="button" class="ghost sm" *ngIf="exc.status === '待处理'" (click)="updateExceptionStatus(exc.id, '处理中')">开始处理</button>
                    <button type="button" class="sm" *ngIf="exc.status === '处理中'" (click)="updateExceptionStatus(exc.id, '已解决')">标记已解决</button>
                    <button type="button" class="ghost sm" *ngIf="exc.status === '处理中'" (click)="updateExceptionStatus(exc.id, '待处理')">退回待处理</button>
                    <ng-container *ngIf="exc.status === '处理中' || exc.status === '已解决'">
                      <input class="exc-result-input" #resultInput placeholder="填写处理结果" [value]="exc.result" />
                      <button type="button" class="ghost sm" (click)="updateExceptionResult(exc.id, resultInput.value); resultInput.value = ''">保存结果</button>
                    </ng-container>
                    <button type="button" class="ghost sm tag-del" (click)="deleteException(exc.id)">删除</button>
                  </div>
                  <small class="created-at">更新于 {{ exc.updatedAt }}</small>
                </div>
                <p class="muted center" *ngIf="filteredExceptionRecords().length === 0">暂无匹配的异常记录</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="exceptionHistoryVisible" (click)="closeExceptionHistory()">
        <div class="modal-panel exc-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>历史异常查询</h2>
              <p class="muted">按老人和日期筛选历史异常记录（含已解决）</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeExceptionHistory()">关闭</button>
          </div>
          <div class="modal-body">
            <div class="exc-filter-bar">
              <input type="date" [(ngModel)]="exceptionHistoryDate" placeholder="日期筛选" />
              <select [(ngModel)]="exceptionHistoryElderId">
                <option value="">全部老人</option>
                <option *ngFor="let e of elders" [value]="e.id">{{ e.name }}</option>
              </select>
            </div>
            <div class="exc-modal-items">
              <div class="exc-modal-item" *ngFor="let exc of historyExceptionRecords()">
                <div class="exc-modal-item-header">
                  <div>
                    <strong>{{ elderName(exc.elderId) }}</strong>
                    <span class="exc-date">{{ exc.date }}</span>
                  </div>
                  <div class="exc-modal-item-tags">
                    <span class="exc-severity" [style.color]="severityColor(exc.severity)" [style.borderColor]="severityColor(exc.severity)">{{ exc.severity }}</span>
                    <span class="exc-status-tag" [style.color]="statusColor(exc.status)" [style.borderColor]="statusColor(exc.status)">{{ exc.status }}</span>
                  </div>
                </div>
                <div class="exc-modal-item-meta">
                  <span class="exc-category">{{ exc.category }}</span>
                  <span *ngIf="exc.handler">负责人：{{ exc.handler }}</span>
                </div>
                <p class="exc-modal-item-desc">{{ exc.description }}</p>
                <div class="exc-result-row" *ngIf="exc.result">
                  <label>处理结果：</label>
                  <span>{{ exc.result }}</span>
                </div>
                <small class="created-at">更新于 {{ exc.updatedAt }}</small>
              </div>
              <p class="muted center" *ngIf="historyExceptionRecords().length === 0">暂无匹配的历史异常记录</p>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="phoneNotificationPanelVisible" (click)="closePhoneNotificationPanel()">
        <div class="modal-panel phone-notif-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>☎️ 电话通知与回拨管理</h2>
              <p class="muted">管理电话通知清单及回拨任务跟踪</p>
            </div>
            <button type="button" class="ghost sm" (click)="closePhoneNotificationPanel()">关闭</button>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="phoneNotificationTab === 'list'" (click)="phoneNotificationTab = 'list'">
              📋 通知清单
              <span class="badge" *ngIf="phoneNotifications.length > 0">{{ phoneNotifications.length }}</span>
            </button>
            <button type="button" [class.active-tab]="phoneNotificationTab === 'callback'" (click)="phoneNotificationTab = 'callback'">
              🔄 回拨任务
              <span class="badge" *ngIf="getPendingCallbackCount() > 0">{{ getPendingCallbackCount() }}</span>
            </button>
          </div>

          <div class="modal-body">
            <div *ngIf="phoneNotificationTab === 'list'" class="phone-notif-list">
              <div class="exc-filter-bar">
                <select [(ngModel)]="phoneNotificationFilter">
                  <option value="全部">全部状态</option>
                  <option value="未通知">未通知</option>
                  <option value="已通知">已通知</option>
                  <option value="未接通">未接通</option>
                  <option value="稍后再拨">稍后再拨</option>
                </select>
                <input type="date" [(ngModel)]="taskDate" placeholder="日期筛选" (change)="''" />
              </div>

              <div class="phone-notif-items">
                <div class="phone-notif-item" *ngFor="let notif of filteredPhoneNotifications()">
                  <div class="phone-notif-header">
                    <div>
                      <strong>{{ getNotificationElderName(notif) }}</strong>
                      <span class="phone-notif-date">{{ notif.date }}</span>
                    </div>
                    <div class="phone-notif-tags">
                      <span class="notif-source-tag">{{ notif.source }}</span>
                      <span class="notif-status-tag" [style.color]="notifStatusColor(notif.notificationStatus)" [style.borderColor]="notifStatusColor(notif.notificationStatus)">{{ notif.notificationStatus }}</span>
                    </div>
                  </div>
                  <div class="phone-notif-meta">
                    <span>📞 {{ notif.phone }}</span>
                  </div>
                  <p class="phone-notif-remark">{{ notif.remark }}</p>
                  <div class="phone-notif-callback-info" *ngIf="getTaskCallbacks(notif.taskId).length > 0">
                    <span class="cb-count">🔄 回拨记录：{{ getTaskCallbacks(notif.taskId).length }} 次</span>
                    <span class="cb-latest" *ngIf="getTaskCallbacks(notif.taskId)[0]">
                      最近：{{ getTaskCallbacks(notif.taskId)[0].nextCallbackTime | date:'MM-dd HH:mm' }}
                      · {{ getTaskCallbacks(notif.taskId)[0].status }}
                    </span>
                  </div>
                  <div class="phone-notif-actions">
                    <button type="button" class="ghost sm" *ngIf="notif.notificationStatus !== '已通知'" (click)="updateNotificationStatus(notif.id, '已通知')">标记已通知</button>
                    <button type="button" class="ghost sm" *ngIf="notif.notificationStatus === '未通知'" (click)="updateNotificationStatus(notif.id, '未接通')">未接通</button>
                    <button type="button" class="sm" style="background:#5a8fd9" (click)="openCallbackForm(notif)">
                      {{ hasActiveCallbackTask(notif.taskId) ? '查看回拨' : '设置回拨' }}
                    </button>
                  </div>
                  <small class="created-at">更新于 {{ notif.updatedAt }}</small>
                </div>
                <p class="muted center" *ngIf="filteredPhoneNotifications().length === 0">暂无电话通知记录</p>
              </div>
            </div>

            <div *ngIf="phoneNotificationTab === 'callback'" class="callback-task-list">
              <div class="callback-filter-bar">
                <select [(ngModel)]="callbackFilterStatus">
                  <option value="全部">全部状态</option>
                  <option value="待回拨">待回拨</option>
                  <option value="回拨中">回拨中</option>
                  <option value="已完成">已完成</option>
                  <option value="已取消">已取消</option>
                </select>
              </div>

              <div class="callback-items">
                <div class="callback-item" *ngFor="let cb of filteredCallbackTasks()">
                  <div class="callback-item-header">
                    <div>
                      <strong>{{ elderName(cb.elderId) }}</strong>
                      <span class="cb-date">{{ cb.date }}</span>
                    </div>
                    <span class="cb-status-badge" [style.background]="cbStatusBgColor(cb.status)" [style.color]="cb.status === '已完成' ? '#fff' : '#315448'">
                      {{ cb.status }}
                    </span>
                  </div>
                  <div class="callback-item-meta">
                    <span>📞 {{ cb.phone }}</span>
                    <span *ngIf="cb.handler">👤 {{ cb.handler }}</span>
                    <span>🔢 回拨{{ cb.callbackCount }}次</span>
                  </div>
                  <div class="callback-item-time">
                    <span>⏰ 下次回拨：{{ cb.nextCallbackTime | date:'yyyy-MM-dd HH:mm' }}</span>
                  </div>
                  <div class="callback-item-result" *ngIf="cb.result">
                    <label>处理结果：</label>
                    <span>{{ cb.result }}</span>
                  </div>
                  <p class="callback-item-remark" *ngIf="cb.remark">
                    <label>备注：</label>
                    <span>{{ cb.remark }}</span>
                  </p>
                  <div class="callback-item-actions">
                    <button type="button" class="ghost sm" (click)="editCallbackTask(cb.id)">编辑</button>
                    <button type="button" class="sm" style="background:#4a9f6d" *ngIf="cb.status === '待回拨'" (click)="updateCallbackStatus(cb.id, '回拨中')">开始回拨</button>
                    <button type="button" class="sm" *ngIf="cb.status === '回拨中'" (click)="editCallbackTask(cb.id)">完成回拨</button>
                    <button type="button" class="ghost sm tag-del" (click)="deleteCallbackTask(cb.id)">删除</button>
                  </div>
                  <small class="created-at">更新于 {{ cb.updatedAt }}</small>
                </div>
                <p class="muted center" *ngIf="filteredCallbackTasks().length === 0">暂无回拨任务</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="callbackFormVisible" (click)="closeCallbackForm()">
        <div class="modal-panel callback-form-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>{{ editingCallbackId ? '编辑回拨任务' : '设置回拨任务' }}</h2>
              <p class="muted" *ngIf="selectedNotificationForCallback">
                {{ getNotificationElderName(selectedNotificationForCallback) }} · {{ selectedNotificationForCallback.phone }}
              </p>
            </div>
            <button type="button" class="ghost sm" (click)="closeCallbackForm()">关闭</button>
          </div>
          <div class="modal-body">
            <form class="callback-form" (ngSubmit)="submitCallbackTask()">
              <div class="form-row">
                <label>下次回拨时间</label>
                <input type="datetime-local" name="nextCallbackTime" [(ngModel)]="callbackForm.nextCallbackTime" required />
              </div>
              <div class="form-row">
                <label>负责人</label>
                <input name="handler" [(ngModel)]="callbackForm.handler" placeholder="请输入负责人姓名" />
              </div>
              <div class="form-row">
                <label>回拨状态</label>
                <div class="method-group">
                  <label class="method-item">
                    <input type="radio" name="cbStatus" [(ngModel)]="callbackForm.status" value="待回拨" />
                    <span>待回拨</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="cbStatus" [(ngModel)]="callbackForm.status" value="回拨中" />
                    <span>回拨中</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="cbStatus" [(ngModel)]="callbackForm.status" value="已完成" />
                    <span>已完成</span>
                  </label>
                  <label class="method-item">
                    <input type="radio" name="cbStatus" [(ngModel)]="callbackForm.status" value="已取消" />
                    <span>已取消</span>
                  </label>
                </div>
              </div>
              <div class="form-row" *ngIf="callbackForm.status === '已完成'">
                <label>处理结果</label>
                <textarea name="cbResult" [(ngModel)]="callbackForm.result" rows="3" placeholder="请填写回拨结果..."></textarea>
              </div>
              <div class="form-row">
                <label>备注</label>
                <textarea name="cbRemark" [(ngModel)]="callbackForm.remark" rows="2" placeholder="备注信息..."></textarea>
              </div>
              <div class="form-actions">
                <button type="button" class="ghost" (click)="closeCallbackForm()">取消</button>
                <button type="submit">{{ editingCallbackId ? '保存修改' : '创建回拨' }}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="importExportPanelVisible" (click)="closeImportExportPanel()">
        <div class="modal-panel import-export-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>数据导入导出</h2>
              <p class="muted">备份或恢复老人档案、志愿者、任务等数据</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeImportExportPanel()">关闭</button>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="importTab === 'export'" (click)="importTab = 'export'">📤 导出数据</button>
            <button type="button" [class.active-tab]="importTab === 'import'" (click)="importTab = 'import'; resetImport()">📥 导入数据</button>
          </div>

          <div class="modal-body">
            <div *ngIf="importTab === 'export'" class="export-section">
              <div class="export-info">
                <h3>导出当前数据为备份文件</h3>
                <p class="muted">将以下数据导出为 JSON 格式备份文件：</p>
                <ul class="export-list">
                  <li><strong>{{ elders.length }}</strong> 位老人档案</li>
                  <li><strong>{{ volunteers.length }}</strong> 名志愿者</li>
                  <li><strong>{{ tasks.length }}</strong> 条送餐任务</li>
                  <li><strong>{{ mealTags.length }}</strong> 个餐食标签</li>
                  <li><strong>{{ exceptionRecords.length }}</strong> 条异常记录</li>
                  <li><strong>{{ visitRecords.length }}</strong> 条回访记录</li>
                  <li><strong>{{ phoneNotifications.length }}</strong> 条电话通知</li>
                  <li><strong>{{ callbackTasks.length }}</strong> 条回拨任务</li>
                  <li><strong>{{ temporaryDeliveryChanges.length }}</strong> 条临时送餐变更</li>
                </ul>
              </div>
              <button type="button" class="export-btn" (click)="exportData()">📥 导出备份文件</button>
            </div>

            <div *ngIf="importTab === 'import'" class="import-section">
              <div *ngIf="!importPreview && !importError && !importSuccess" class="import-upload-area">
                <div class="upload-icon">📁</div>
                <h3>选择备份文件</h3>
                <p class="muted">选择一个 JSON 格式的备份文件进行导入</p>
                <label class="file-input-label">
                  <input type="file" accept=".json,application/json" (change)="onFileSelected($event)" hidden />
                  <span>选择文件</span>
                </label>
                <p class="import-tip">💡 导入前会预览数据，不会立即覆盖现有数据</p>
              </div>

              <div *ngIf="importError" class="import-error">
                <div class="error-header">
                  <span class="error-icon">⚠️</span>
                  <strong>{{ importError.message }}</strong>
                </div>
                <ul *ngIf="importError.details" class="error-details">
                  <li *ngFor="let detail of importError.details">{{ detail }}</li>
                </ul>
                <button type="button" class="ghost" (click)="resetImport()">重新选择文件</button>
              </div>

              <div *ngIf="importSuccess" class="import-success">
                <div class="success-icon">✅</div>
                <h3>导入成功！</h3>
                <p class="muted">数据已成功写入本地存储</p>
                <button type="button" class="ghost" (click)="resetImport()">继续导入</button>
              </div>

              <div *ngIf="importPreview && importPreviewSummary" class="import-preview">
                <div class="preview-header">
                  <h3>导入预览</h3>
                  <p class="muted" *ngIf="importedData">导出时间：{{ importedData.exportedAt | date:'yyyy-MM-dd HH:mm' }}</p>
                </div>

                <div class="preview-legend">
                  <span class="legend-item"><span class="legend-dot new"></span> 新增</span>
                  <span class="legend-item"><span class="legend-dot overwrite"></span> 覆盖</span>
                  <span class="legend-item"><span class="legend-dot duplicate"></span> 重复（无变化）</span>
                </div>

                <div class="preview-cards">
                  <div class="preview-card" *ngIf="importPreviewSummary.elders.total > 0">
                    <h4>👴 老人档案</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.elders.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.elders.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.elders.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.volunteers.total > 0">
                    <h4>👥 志愿者</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.volunteers.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.volunteers.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.volunteers.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.tasks.total > 0">
                    <h4>📋 送餐任务</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.tasks.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.tasks.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.tasks.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.mealTags.total > 0">
                    <h4>🏷️ 餐食标签</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.mealTags.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.mealTags.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.mealTags.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.exceptionRecords.total > 0">
                    <h4>⚠️ 异常记录</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.exceptionRecords.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.exceptionRecords.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.exceptionRecords.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.visitRecords.total > 0">
                    <h4>📝 回访记录</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.visitRecords.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.visitRecords.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.visitRecords.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.phoneNotifications.total > 0">
                    <h4>📞 电话通知</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.phoneNotifications.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.phoneNotifications.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.phoneNotifications.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.callbackTasks.total > 0">
                    <h4>🔄 回拨任务</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.callbackTasks.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.callbackTasks.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.callbackTasks.duplicate }}</span>
                    </div>
                  </div>

                  <div class="preview-card" *ngIf="importPreviewSummary.temporaryDeliveryChanges.total > 0">
                    <h4>📋 临时送餐变更</h4>
                    <div class="preview-stats">
                      <span class="stat new">+{{ importPreviewSummary.temporaryDeliveryChanges.new }}</span>
                      <span class="stat overwrite">~{{ importPreviewSummary.temporaryDeliveryChanges.overwrite }}</span>
                      <span class="stat duplicate">={{ importPreviewSummary.temporaryDeliveryChanges.duplicate }}</span>
                    </div>
                    <div class="preview-items-sample" *ngIf="importPreview && importPreview.temporaryDeliveryChanges.length > 0">
                      <div class="preview-item" *ngFor="let item of importPreview.temporaryDeliveryChanges.slice(0, 5)" [class]="'status-'+item.status">
                        <div class="preview-item-info">
                          <strong>{{ getPreviewTempChangeElderName(item.item) }}</strong>
                          <small class="muted">{{ item.item.date }} · {{ item.item.reason }}</small>
                        </div>
                        <span class="status-tag">{{ previewStatusLabel(item.status) }}</span>
                      </div>
                      <p class="muted" *ngIf="importPreview.temporaryDeliveryChanges.length > 5">...还有 {{ importPreview.temporaryDeliveryChanges.length - 5 }} 条未显示</p>
                    </div>
                  </div>
                </div>

                <div class="import-warning">
                  <strong>⚠️ 注意：</strong>
                  <span>相同 ID 的数据将被覆盖，请确认后再执行导入操作。</span>
                </div>

                <div class="import-actions">
                  <button type="button" class="ghost" (click)="resetImport()">取消</button>
                  <button type="button" class="confirm-btn" (click)="confirmImport()">确认导入</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="simulationPanelVisible" (click)="closeSimulationPanel()">
        <div class="modal-panel simulation-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>排班模拟详情</h2>
              <p class="muted">{{ simulationData?.startDate }} 至 {{ simulationData?.endDate }} · 共 {{ getSimulationDatesCount() }} 天</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeSimulationPanel()">关闭</button>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="simulationDetailTab === 'overview'" (click)="simulationDetailTab = 'overview'">📊 总览</button>
            <button type="button" [class.active-tab]="simulationDetailTab === 'load'" (click)="simulationDetailTab = 'load'">💪 志愿者负载</button>
            <button type="button" [class.active-tab]="simulationDetailTab === 'unassigned'" (click)="simulationDetailTab = 'unassigned'">❌ 未分配原因</button>
            <button type="button" [class.active-tab]="simulationDetailTab === 'paused'" (click)="simulationDetailTab = 'paused'">⏸️ 暂停影响</button>
            <button type="button" [class.active-tab]="simulationDetailTab === 'special'" (click)="simulationDetailTab = 'special'">🍽️ 特殊餐食</button>
            <button type="button" [class.active-tab]="simulationDetailTab === 'route'" (click)="simulationDetailTab = 'route'">🗺️ 路线顺序</button>
          </div>

          <div class="sim-date-selector">
            <span class="muted">选择日期：</span>
            <select [(ngModel)]="simulationViewDate" (ngModelChange)="setSimulationViewDate(simulationViewDate)">
              <option *ngFor="let date of simulationData?.dates" [value]="date">{{ date }}</option>
            </select>
          </div>

          <div class="modal-body">
            <div *ngIf="simulationDetailTab === 'overview'" class="sim-overview">
              <div class="sim-stat-grid">
                <div class="sim-stat-card">
                  <div class="sim-stat-icon">📋</div>
                  <div class="sim-stat-info">
                    <strong>{{ getCurrentSimulationStats()?.totalTasks || 0 }}</strong>
                    <span>总任务数</span>
                  </div>
                </div>
                <div class="sim-stat-card ok">
                  <div class="sim-stat-icon">✅</div>
                  <div class="sim-stat-info">
                    <strong>{{ getCurrentSimulationStats()?.assignedCount || 0 }}</strong>
                    <span>已分配</span>
                  </div>
                </div>
                <div class="sim-stat-card warn">
                  <div class="sim-stat-icon">⚠️</div>
                  <div class="sim-stat-info">
                    <strong>{{ getCurrentSimulationStats()?.unassignedCount || 0 }}</strong>
                    <span>未分配</span>
                  </div>
                </div>
                <div class="sim-stat-card muted">
                  <div class="sim-stat-icon">⏸️</div>
                  <div class="sim-stat-info">
                    <strong>{{ getCurrentSimulationStats()?.pausedCount || 0 }}</strong>
                    <span>暂停送餐</span>
                  </div>
                </div>
                <div class="sim-stat-card special">
                  <div class="sim-stat-icon">🍽️</div>
                  <div class="sim-stat-info">
                    <strong>{{ getCurrentSimulationStats()?.specialMealCount || 0 }}</strong>
                    <span>特殊餐食</span>
                  </div>
                </div>
                <div class="sim-stat-card">
                  <div class="sim-stat-icon">👥</div>
                  <div class="sim-stat-info">
                    <strong>{{ getActiveVolunteerCount(getCurrentSimulationStats()) }}</strong>
                    <span>参与志愿者</span>
                  </div>
                </div>
              </div>

              <div class="sim-section">
                <h3>餐食标签分布</h3>
                <div class="sim-tag-list">
                  <div class="sim-tag-item" *ngFor="let tag of getCurrentSimulationStats()?.tagBreakdown">
                    <span class="tag-chip" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.tagName }}</span>
                    <strong>{{ tag.count }}份</strong>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="simulationDetailTab === 'load'" class="sim-load">
              <h3>志愿者负载情况</h3>
              <div class="sim-load-list">
                <div class="sim-load-item" *ngFor="let v of getCurrentSimulationStats()?.volunteerLoad">
                  <div class="sim-load-header">
                    <strong>{{ v.volunteerName }}</strong>
                    <span [class.overloaded]="v.assigned > v.capacity">{{ v.assigned }}/{{ v.capacity }}单</span>
                  </div>
                  <div class="load-bar-bg">
                    <div
                      class="load-bar-fill"
                      [style.width.%]="safeLoadPercent(v.assigned, v.capacity)"
                      [class.full]="v.assigned >= v.capacity"
                      [class.near]="v.assigned >= v.capacity * 0.75 && v.assigned < v.capacity"
                    ></div>
                  </div>
                  <small class="load-area">{{ v.area }}</small>
                </div>
              </div>
            </div>

            <div *ngIf="simulationDetailTab === 'unassigned'" class="sim-unassigned">
              <h3>未分配原因</h3>
              <div class="sim-unassigned-list">
                <div class="sim-unassigned-item" *ngFor="let item of getCurrentSimulationStats()?.unassignedReasons">
                  <div class="sim-unassigned-elder">
                    <strong>{{ item.elderName }}</strong>
                    <small>{{ item.elderAddress }}</small>
                  </div>
                  <div class="sim-unassigned-reason">{{ item.reason }}</div>
                </div>
                <p class="muted center" *ngIf="!getCurrentSimulationStats()?.unassignedReasons?.length">当日无未分配任务</p>
              </div>
            </div>

            <div *ngIf="simulationDetailTab === 'paused'" class="sim-paused">
              <h3>暂停送餐影响</h3>
              <div class="sim-paused-summary">
                <p>当日共有 <strong>{{ getCurrentSimulationStats()?.pausedCount || 0 }}</strong> 位老人暂停送餐</p>
              </div>
              <div class="sim-paused-list">
                <div class="sim-paused-item" *ngFor="let elder of getCurrentSimulationStats()?.pausedElders">
                  <div>
                    <strong>{{ elder.elderName }}</strong>
                    <small>{{ elder.address }}</small>
                  </div>
                  <span class="sim-paused-contact">📞 {{ elder.contact }}</span>
                </div>
              </div>
              <p class="muted center" *ngIf="!getCurrentSimulationStats()?.pausedElders?.length">当日无暂停送餐的老人</p>
            </div>

            <div *ngIf="simulationDetailTab === 'special'" class="sim-special">
              <h3>特殊餐食分布</h3>
              <p class="muted">当日共有 <strong>{{ getCurrentSimulationStats()?.specialMealCount || 0 }}</strong> 份特殊餐食</p>
              <div class="sim-special-list">
                <div class="sim-special-item" *ngFor="let task of getSimulationTasksForDate(simulationViewDate)">
                  <ng-container *ngIf="task.specialMealNote || elderSpecialNote(task.elderId)">
                    <div>
                      <strong>{{ elderName(task.elderId) }}</strong>
                      <small>{{ elderAddress(task.elderId) }}</small>
                    </div>
                    <div class="sim-special-note">{{ task.specialMealNote || elderSpecialNote(task.elderId) }}</div>
                  </ng-container>
                </div>
              </div>
            </div>

            <div *ngIf="simulationDetailTab === 'route'" class="sim-route">
              <h3>配送路线顺序</h3>
              <div class="sim-route-grid">
                <div class="sim-route-column" *ngFor="let group of getCurrentSimulationStats()?.routeOrder">
                  <div class="sim-route-header">
                    <strong>{{ group.volunteer.name }}</strong>
                    <span>{{ group.tasks.length }}单 · {{ group.volunteer.area }}</span>
                  </div>
                  <div class="sim-route-list">
                    <div class="sim-route-item" *ngFor="let task of group.tasks; let i = index">
                      <span class="sim-route-order">{{ i + 1 }}</span>
                      <div class="sim-route-info">
                        <strong>{{ elderName(task.elderId) }}</strong>
                        <small>{{ elderAddress(task.elderId) }}</small>
                      </div>
                    </div>
                    <p class="muted" *ngIf="group.tasks.length === 0">暂无任务</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="sim-modal-footer">
            <button type="button" class="ghost" (click)="closeSimulationPanel()">关闭</button>
            <button type="button" class="auto-assign-btn" (click)="autoAssignSimulationTasks(); closeSimulationPanel()">重新自动分配</button>
            <button type="button" class="submit-btn" (click)="submitSimulation()">📝 预览差异并提交</button>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="simulationDiffVisible" (click)="closeSimulationDiffPreview()">
        <div class="modal-panel simulation-diff-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>📋 提交前差异预览</h2>
              <p class="muted">{{ simulationData?.startDate }} 至 {{ simulationData?.endDate }} · 共 {{ getSimulationDatesCount() }} 天 · {{ getSummaryDatesWithChangesCount() }} 天有变化</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeSimulationDiffPreview()">关闭</button>
          </div>

          <div class="diff-summary-bar" *ngIf="simulationDiffResult">
            <div class="diff-sum-item added">
              <strong>{{ getSummaryTotalAdded() }}</strong>
              <span>新增任务</span>
            </div>
            <div class="diff-sum-item removed">
              <strong>{{ getSummaryTotalRemoved() }}</strong>
              <span>移除任务</span>
            </div>
            <div class="diff-sum-item volunteer">
              <strong>{{ getSummaryTotalVolunteerChanges() }}</strong>
              <span>分配变更</span>
            </div>
            <div class="diff-sum-item route">
              <strong>{{ getSummaryTotalRouteChanges() }}</strong>
              <span>路线调整</span>
            </div>
            <div class="diff-sum-item paused">
              <strong>{{ getSummaryTotalPauseChanges() }}</strong>
              <span>暂停变化</span>
            </div>
            <div class="diff-sum-item special">
              <strong>{{ getSummaryTotalSpecialMealChanges() }}</strong>
              <span>餐食变更</span>
            </div>
          </div>

          <div class="diff-day-tabs">
            <button
              type="button"
              class="diff-day-tab"
              *ngFor="let date of simulationData?.dates"
              [class.active]="simulationDiffDate === date"
              [class.has-changes]="getDiffDayHasChanges(date)"
              (click)="simulationDiffDate = date"
            >
              {{ date }}
              <span class="diff-day-badge" *ngIf="getDiffDayHasChanges(date)">
                {{ getDiffDayBadgeCount(date) }}
              </span>
            </button>
          </div>

          <div class="modal-tabs diff-modal-tabs">
            <button type="button" [class.active-tab]="simulationDiffTab === 'summary'" (click)="simulationDiffTab = 'summary'">📊 总览</button>
            <button type="button" [class.active-tab]="simulationDiffTab === 'tasks'" (click)="simulationDiffTab = 'tasks'">
              ➕➖ 任务增减
              <span class="tab-badge" *ngIf="getCurrentDiffDayAddedCount() + getCurrentDiffDayRemovedCount() > 0">
                {{ getCurrentDiffDayAddedCount() + getCurrentDiffDayRemovedCount() }}
              </span>
            </button>
            <button type="button" [class.active-tab]="simulationDiffTab === 'volunteer'" (click)="simulationDiffTab = 'volunteer'">
              👥 分配变更
              <span class="tab-badge" *ngIf="getCurrentDiffDayVolunteerCount() > 0">
                {{ getCurrentDiffDayVolunteerCount() }}
              </span>
            </button>
            <button type="button" [class.active-tab]="simulationDiffTab === 'route'" (click)="simulationDiffTab = 'route'">
              🗺️ 路线变化
              <span class="tab-badge" *ngIf="getCurrentDiffDayRouteCount() > 0">
                {{ getCurrentDiffDayRouteCount() }}
              </span>
            </button>
            <button type="button" [class.active-tab]="simulationDiffTab === 'paused'" (click)="simulationDiffTab = 'paused'">
              ⏸️ 暂停影响
              <span class="tab-badge" *ngIf="getSummaryTotalPausedNew() + getSummaryTotalPausedResumed() > 0">
                {{ getSummaryTotalPausedNew() + getSummaryTotalPausedResumed() }}
              </span>
            </button>
            <button type="button" [class.active-tab]="simulationDiffTab === 'special'" (click)="simulationDiffTab = 'special'">
              🍽️ 特殊餐食
              <span class="tab-badge" *ngIf="getCurrentDiffDaySpecialCount() > 0">
                {{ getCurrentDiffDaySpecialCount() }}
              </span>
            </button>
          </div>

          <div class="modal-body diff-modal-body">

            <div *ngIf="simulationDiffTab === 'summary'" class="diff-overview">
              <div class="diff-overview-grid" *ngIf="getCurrentDiffDay()">
                <div class="diff-stat-card">
                  <div class="diff-stat-icon">📋</div>
                  <div class="diff-stat-info">
                    <div class="diff-stat-row">
                      <span>原有</span><strong>{{ getCurrentDiffDayTotalBefore() }}</strong>
                    </div>
                    <div class="diff-stat-row">
                      <span>模拟</span><strong>{{ getCurrentDiffDayTotalAfter() }}</strong>
                    </div>
                    <div class="diff-stat-row" [class.positive]="getCurrentDiffDayTotalDiff() > 0" [class.negative]="getCurrentDiffDayTotalDiff() < 0">
                      <span>变化</span>
                      <strong>{{ getCurrentDiffDayTotalDiff() > 0 ? '+' : '' }}{{ getCurrentDiffDayTotalDiff() }}</strong>
                    </div>
                    <small>总任务数</small>
                  </div>
                </div>
                <div class="diff-stat-card assigned">
                  <div class="diff-stat-icon">✅</div>
                  <div class="diff-stat-info">
                    <div class="diff-stat-row">
                      <span>原有</span><strong>{{ getCurrentDiffDayAssignedBefore() }}</strong>
                    </div>
                    <div class="diff-stat-row">
                      <span>模拟</span><strong>{{ getCurrentDiffDayAssignedAfter() }}</strong>
                    </div>
                    <div class="diff-stat-row" [class.positive]="getCurrentDiffDayAssignedDiff() > 0" [class.negative]="getCurrentDiffDayAssignedDiff() < 0">
                      <span>变化</span>
                      <strong>{{ getCurrentDiffDayAssignedDiff() > 0 ? '+' : '' }}{{ getCurrentDiffDayAssignedDiff() }}</strong>
                    </div>
                    <small>已分配任务</small>
                  </div>
                </div>
                <div class="diff-stat-card added">
                  <div class="diff-stat-icon">➕</div>
                  <div class="diff-stat-info">
                    <strong>{{ getCurrentDiffDayAddedCount() }}</strong>
                    <small>新增任务</small>
                  </div>
                </div>
                <div class="diff-stat-card removed">
                  <div class="diff-stat-icon">➖</div>
                  <div class="diff-stat-info">
                    <strong>{{ getCurrentDiffDayRemovedCount() }}</strong>
                    <small>移除任务</small>
                  </div>
                </div>
                <div class="diff-stat-card volunteer">
                  <div class="diff-stat-icon">🔄</div>
                  <div class="diff-stat-info">
                    <strong>{{ getCurrentDiffDayVolunteerCount() }}</strong>
                    <small>志愿者分配变更</small>
                  </div>
                </div>
                <div class="diff-stat-card route">
                  <div class="diff-stat-icon">🗺️</div>
                  <div class="diff-stat-info">
                    <strong>{{ getCurrentDiffDayRouteCount() }}</strong>
                    <small>志愿者路线调整</small>
                  </div>
                </div>
              </div>

              <div class="diff-section" *ngIf="simulationDiffResult">
                <h3>📅 每日变化概览</h3>
                <div class="diff-day-table">
                  <div class="diff-day-row header">
                    <span>日期</span>
                    <span>总任务</span>
                    <span>新增</span>
                    <span>移除</span>
                    <span>分配变更</span>
                    <span>路线调整</span>
                    <span>暂停变化</span>
                    <span>特殊餐食</span>
                    <span>状态</span>
                  </div>
                  <div class="diff-day-row" *ngFor="let date of simulationData?.dates" [class.no-changes]="!getDiffDayHasChanges(date)">
                    <span class="date-cell">{{ date }}</span>
                    <span>{{ getDiffDayTotalBefore(date) }} → {{ getDiffDayTotalAfter(date) }}</span>
                    <span class="added-cell">{{ getDiffDayAddedCount(date) }}</span>
                    <span class="removed-cell">{{ getDiffDayRemovedCount(date) }}</span>
                    <span class="volunteer-cell">{{ getDiffDayVolunteerCount(date) }}</span>
                    <span class="route-cell">{{ getDiffDayRouteCount(date) }}</span>
                    <span class="pause-cell">
                      <ng-container *ngIf="getDiffDayNewPausedCount(date) + getDiffDayResumedCount(date) > 0">
                        <span class="pause-mini-tag pause-new-mini" *ngIf="getDiffDayNewPausedCount(date) > 0">新停{{ getDiffDayNewPausedCount(date) }}</span>
                        <span class="pause-mini-tag pause-resume-mini" *ngIf="getDiffDayResumedCount(date) > 0">恢复{{ getDiffDayResumedCount(date) }}</span>
                      </ng-container>
                      <span class="muted sm" *ngIf="getDiffDayNewPausedCount(date) + getDiffDayResumedCount(date) === 0">-</span>
                    </span>
                    <span class="special-cell">{{ getDiffDaySpecialCount(date) || '-' }}</span>
                    <span>
                      <span class="status-tag" *ngIf="getDiffDayHasChanges(date)" style="background:#fff3e0;color:#e65100;border-color:#ffb74d;">有变化</span>
                      <span class="status-tag" *ngIf="!getDiffDayHasChanges(date)" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">无变化</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="simulationDiffTab === 'tasks'" class="diff-tasks">
              <div class="diff-section" *ngIf="getCurrentDiffDayAddedCount() > 0">
                <h3>➕ 新增任务（{{ getCurrentDiffDayAddedCount() }}）</h3>
                <div class="diff-list">
                  <div class="diff-item added" *ngFor="let item of getCurrentDiffDayAddedTasks()">
                    <div class="diff-item-main">
                      <div class="diff-item-title">
                        <strong (click)="locateElderInDiff(item.elderId)" class="clickable">{{ item.elderName }}</strong>
                        <span class="route-order-tag" *ngIf="item.routeOrder">#{{ item.routeOrder }}</span>
                        <span class="diff-volunteer" *ngIf="item.volunteerName" (click)="locateVolunteerInDiff(item.volunteerId!)" class="clickable">配送：{{ item.volunteerName }}</span>
                        <span class="diff-volunteer unassigned" *ngIf="!item.volunteerName">未分配</span>
                        <span class="reason-tag resumed" *ngIf="item.addReason === 'resumed-from-pause'">⏪ 恢复送餐</span>
                        <span class="reason-tag new" *ngIf="item.addReason === 'new-elder'">👤 新老人</span>
                        <span class="reason-tag new" *ngIf="item.addReason === 'delivery-day-added'">📅 新增配送日</span>
                      </div>
                      <small>{{ item.elderAddress }}</small>
                      <div class="special-note" *ngIf="item.specialMealNote">🍽️ {{ item.specialMealNote }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="diff-section" *ngIf="getCurrentDiffDayRemovedCount() > 0">
                <h3>➖ 移除任务（{{ getCurrentDiffDayRemovedCount() }}）</h3>
                <div class="diff-list">
                  <div class="diff-item removed" *ngFor="let item of getCurrentDiffDayRemovedTasks()">
                    <div class="diff-item-main">
                      <div class="diff-item-title">
                        <strong (click)="locateElderInDiff(item.elderId)" class="clickable">{{ item.elderName }}</strong>
                        <span class="route-order-tag" *ngIf="item.routeOrder">#{{ item.routeOrder }}</span>
                        <span class="diff-volunteer" *ngIf="item.volunteerName">原配送：{{ item.volunteerName }}</span>
                        <span class="diff-volunteer unassigned" *ngIf="!item.volunteerName">原未分配</span>
                        <span class="reason-tag paused" *ngIf="item.removeReason === 'paused'">⏸️ 转为暂停</span>
                        <span class="reason-tag removed" *ngIf="item.removeReason === 'elder-removed'">👤 移除老人</span>
                        <span class="reason-tag removed" *ngIf="item.removeReason === 'delivery-day-removed'">📅 移除配送日</span>
                      </div>
                      <small>{{ item.elderAddress }}</small>
                      <div class="special-note" *ngIf="item.specialMealNote">🍽️ {{ item.specialMealNote }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="muted center" *ngIf="getCurrentDiffDayAddedCount() === 0 && getCurrentDiffDayRemovedCount() === 0">当日无任务增减</p>
            </div>

            <div *ngIf="simulationDiffTab === 'volunteer'" class="diff-volunteer-change">
              <div class="diff-section" *ngIf="getCurrentDiffDayVolunteerCount() > 0">
                <h3>👥 志愿者分配变更（{{ getCurrentDiffDayVolunteerCount() }}）</h3>
                <div class="diff-list">
                  <div class="diff-item volunteer-change" *ngFor="let item of getCurrentDiffDayVolunteerChanges()">
                    <div class="diff-item-main">
                      <div class="diff-item-title">
                        <strong (click)="locateElderInDiff(item.elderId)" class="clickable">{{ item.elderName }}</strong>
                      </div>
                      <small>{{ item.elderAddress }}</small>
                      <div class="change-arrow-row">
                        <div class="change-box old">
                          <small>原分配</small>
                          <strong *ngIf="item.oldVolunteerName" (click)="locateVolunteerInDiff(item.oldVolunteerId!)" class="clickable">{{ item.oldVolunteerName }}</strong>
                          <strong class="unassigned" *ngIf="!item.oldVolunteerName">未分配</strong>
                        </div>
                        <div class="change-arrow">→</div>
                        <div class="change-box new">
                          <small>新分配</small>
                          <strong *ngIf="item.newVolunteerName" (click)="locateVolunteerInDiff(item.newVolunteerId!)" class="clickable">{{ item.newVolunteerName }}</strong>
                          <strong class="unassigned" *ngIf="!item.newVolunteerName">未分配</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="muted center" *ngIf="getCurrentDiffDayVolunteerCount() === 0">当日无志愿者分配变更</p>
            </div>

            <div *ngIf="simulationDiffTab === 'route'" class="diff-route-change">
              <div class="diff-section" *ngIf="getCurrentDiffDayRouteCount() > 0">
                <h3>🗺️ 路线顺序变化（{{ getCurrentDiffDayRouteCount() }}名志愿者）</h3>
                <div class="route-compare-grid">
                  <div class="route-compare-card" *ngFor="let rc of getCurrentDiffDayRouteChanges()">
                    <div class="route-compare-header">
                      <strong (click)="locateVolunteerInDiff(rc.volunteerId)" class="clickable">{{ rc.volunteerName }}</strong>
                      <span class="moved-count">{{ rc.movedTasks.length }} 单顺序变化</span>
                    </div>
                    <div class="route-compare-body">
                      <div class="route-col old">
                        <h4>原有顺序</h4>
                        <div class="route-compare-list">
                          <div class="route-compare-item" *ngFor="let task of rc.oldOrder" [class.moved]="hasMovedTask(rc.movedTasks, task.elderId)">
                            <span class="route-num">{{ task.position }}</span>
                            <span (click)="locateElderInDiff(task.elderId)" class="clickable">{{ task.elderName }}</span>
                          </div>
                          <p class="muted sm" *ngIf="rc.oldOrder.length === 0">无任务</p>
                        </div>
                      </div>
                      <div class="route-col-arrow">→</div>
                      <div class="route-col new">
                        <h4>模拟顺序</h4>
                        <div class="route-compare-list">
                          <div class="route-compare-item" *ngFor="let task of rc.newOrder" [class.moved]="hasMovedTask(rc.movedTasks, task.elderId)">
                            <span class="route-num">{{ task.position }}</span>
                            <span (click)="locateElderInDiff(task.elderId)" class="clickable">{{ task.elderName }}</span>
                            <span class="moved-tag" *ngIf="hasMovedTask(rc.movedTasks, task.elderId)">
                              {{ getMovedTaskByElder(rc.movedTasks, task.elderId)?.oldPos }}→{{ getMovedTaskByElder(rc.movedTasks, task.elderId)?.newPos }}
                            </span>
                          </div>
                          <p class="muted sm" *ngIf="rc.newOrder.length === 0">无任务</p>
                        </div>
                      </div>
                    </div>
                    <div class="route-moved-list" *ngIf="rc.movedTasks.length > 0">
                      <h5>位置变动明细</h5>
                      <div class="moved-item" *ngFor="let m of rc.movedTasks">
                        <span (click)="locateElderInDiff(m.elderId)" class="clickable">{{ m.elderName }}</span>
                        <span>第 {{ m.oldPos }} 位 → 第 {{ m.newPos }} 位</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="muted center" *ngIf="getCurrentDiffDayRouteCount() === 0">当日无路线顺序变化</p>
            </div>

            <div *ngIf="simulationDiffTab === 'paused'" class="diff-paused">
              <div class="diff-section">
                <h3>⏸️ 暂停送餐影响</h3>
                <div class="diff-list" *ngIf="getCurrentDiffDayPausedCount() > 0">
                  <div class="diff-item paused-item" *ngFor="let item of getCurrentDiffDayPausedChanges()" [class.new-pause]="item.changeType === 'pause-new'" [class.resume]="item.changeType === 'pause-resume'">
                    <div class="diff-item-main">
                      <div class="diff-item-title">
                        <strong (click)="locateElderInDiff(item.elderId)" class="clickable">{{ item.elderName }}</strong>
                        <span class="pause-tag new" *ngIf="item.changeType === 'pause-new'">新增暂停</span>
                        <span class="pause-tag resume" *ngIf="item.changeType === 'pause-resume'">恢复送餐</span>
                        <span class="pause-tag keep" *ngIf="item.changeType === 'pause-unchanged' && item.isPaused">持续暂停</span>
                        <span class="source-tag" *ngIf="item.changeSource">{{ getPauseChangeSourceText(item.changeSource) }}</span>
                      </div>
                      <small>{{ item.address }}</small>
                      <small class="contact">📞 {{ item.contact }}</small>
                      <div class="pause-status-row">
                        <span class="pause-status" [class.active]="item.wasPaused">提交前：{{ item.wasPaused ? '已暂停' : '正常送餐' }}</span>
                        <span class="pause-arrow">→</span>
                        <span class="pause-status" [class.active]="item.isPaused">提交后：{{ item.isPaused ? '暂停送餐' : '正常送餐' }}</span>
                      </div>
                      <div class="change-detail-row" *ngIf="item.changeDetail">
                        <span class="detail-label">变更原因：</span>
                        <span class="detail-text">{{ item.changeDetail }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p class="muted center" *ngIf="getCurrentDiffDayPausedCount() === 0">当日无暂停送餐的老人</p>
              </div>
            </div>

            <div *ngIf="simulationDiffTab === 'special'" class="diff-special">
              <div class="diff-section" *ngIf="getCurrentDiffDaySpecialCount() > 0">
                <h3>🍽️ 特殊餐食变化（{{ getCurrentDiffDaySpecialCount() }}）</h3>
                <div class="diff-list">
                  <div class="diff-item special-change" *ngFor="let item of getCurrentDiffDaySpecialChanges()">
                    <div class="diff-item-main">
                      <div class="diff-item-title">
                        <strong (click)="locateElderInDiff(item.elderId)" class="clickable">{{ item.elderName }}</strong>
                        <span class="special-tag new" *ngIf="item.changeType === 'special-new'">新增特殊餐</span>
                        <span class="special-tag removed" *ngIf="item.changeType === 'special-removed'">取消特殊餐</span>
                        <span class="special-tag changed" *ngIf="item.changeType === 'special-changed'">餐食调整</span>
                        <span class="source-tag" *ngIf="item.changeSource">{{ getSpecialChangeSourceText(item.changeSource) }}</span>
                      </div>
                      <div class="source-compare-row" *ngIf="item.oldSource || item.newSource">
                        <span class="source-label" *ngIf="item.oldSource">原来源：{{ getSpecialChangeSourceText(item.oldSource) }}</span>
                        <span class="source-arrow" *ngIf="item.oldSource && item.newSource && item.oldSource !== item.newSource">→</span>
                        <span class="source-label" *ngIf="item.newSource && item.oldSource !== item.newSource">新来源：{{ getSpecialChangeSourceText(item.newSource) }}</span>
                      </div>
                      <div class="special-compare" *ngIf="item.changeType === 'special-changed'">
                        <div class="change-box old">
                          <small>原有备注</small>
                          <p>{{ item.oldNote }}</p>
                        </div>
                        <div class="change-arrow">→</div>
                        <div class="change-box new">
                          <small>模拟备注</small>
                          <p>{{ item.newNote }}</p>
                        </div>
                      </div>
                      <div class="special-single new" *ngIf="item.changeType === 'special-new'">
                        <small>新增备注</small>
                        <p>{{ item.newNote }}</p>
                      </div>
                      <div class="special-single removed" *ngIf="item.changeType === 'special-removed'">
                        <small>移除备注</small>
                        <p>{{ item.oldNote }}</p>
                      </div>
                      <div class="change-detail-row" *ngIf="item.changeDetail">
                        <span class="detail-label">变更说明：</span>
                        <span class="detail-text">{{ item.changeDetail }}</span>
                      </div>
                      <div class="change-detail-row" *ngIf="item.relatedTempChangeReason">
                        <span class="detail-label">临时变更原因：</span>
                        <span class="detail-text temp-reason">{{ item.relatedTempChangeReason }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p class="muted center" *ngIf="getCurrentDiffDaySpecialCount() === 0">当日无特殊餐食变更</p>
            </div>

          </div>

          <div class="diff-modal-footer">
            <button type="button" class="ghost" (click)="closeSimulationDiffPreview()">返回修改</button>
            <button type="button" class="submit-btn confirm-btn" (click)="confirmSubmitSimulation()">
              ✓ 确认提交以上 {{ getSummaryDatesWithChangesCount() }} 天方案
            </button>
          </div>
        </div>
      </div>

      <div class="sync-toast" *ngIf="syncToastVisible" [class.toast-warn]="lastSyncType === 'warn'" [class.toast-error]="lastSyncType === 'error'" [class.toast-success]="lastSyncType === 'success'">
        <span>{{ lastSyncMessage }}</span>
      </div>

      <div class="conflict-modal-backdrop" *ngIf="conflictPanelVisible" (click)="dismissConflictPanel()">
        <div class="conflict-modal" (click)="$event.stopPropagation()">
          <header class="conflict-modal-header">
            <div>
              <h2>⚠️ 数据冲突检测</h2>
              <p class="conflict-subtitle">
                检测到 {{ totalConflictsCount }} 个数据冲突，请处理
                <span *ngIf="isImportConflictResolutionMode">（当前为导入数据恢复模式）</span>
              </p>
            </div>
            <button type="button" class="close-btn" (click)="dismissConflictPanel()">✕</button>
          </header>

          <div class="conflict-body">
            <aside class="conflict-groups">
              <h3>数据类型</h3>
              <ul>
                <li
                  *ngFor="let g of activeConflictGroups; let i = index"
                  [class.active]="i === selectedConflictGroupIndex"
                  (click)="selectConflictGroup(i)"
                >
                  <span>{{ g.typeLabel }}</span>
                  <strong class="badge">{{ g.conflicts.length }}</strong>
                </li>
              </ul>

              <div class="global-resolution-bar">
                <button type="button" class="ghost" (click)="keepAllLocal()">📌 全部保留本地</button>
                <button type="button" class="ghost" (click)="adoptAllRemote()">🔄 全部采用新数据</button>
              </div>
            </aside>

            <section class="conflict-content" *ngIf="currentConflictGroup">
              <div class="conflict-type-header">
                <h3>{{ currentConflictGroup.typeLabel }} · 批量策略</h3>
                <div class="resolution-switch">
                  <label>
                    <input type="radio" [name]="'grp-'+selectedConflictGroupIndex"
                      [checked]="currentConflictGroup.defaultResolution === 'keep-local'"
                      (change)="setGroupDefaultResolution(selectedConflictGroupIndex, 'keep-local')" />
                    <span>保留本窗口</span>
                  </label>
                  <label>
                    <input type="radio" [name]="'grp-'+selectedConflictGroupIndex"
                      [checked]="currentConflictGroup.defaultResolution === 'adopt-remote'"
                      (change)="setGroupDefaultResolution(selectedConflictGroupIndex, 'adopt-remote')" />
                    <span>采用新数据</span>
                  </label>
                  <label>
                    <input type="radio" [name]="'grp-'+selectedConflictGroupIndex"
                      [checked]="currentConflictGroup.defaultResolution === 'field-level'"
                      (change)="setGroupDefaultResolution(selectedConflictGroupIndex, 'field-level')" />
                    <span>按字段选择</span>
                  </label>
                </div>
              </div>

              <div class="conflict-record-list">
                <ul>
                  <li
                    *ngFor="let rc of currentConflictsForGroup"
                    [class.active]="rc.recordId === selectedConflictRecordId"
                    (click)="selectConflictRecord(rc.recordId)"
                  >
                    <div class="rc-row">
                      <strong>{{ rc.recordLabel }}</strong>
                      <span class="rc-resolution rc-{{ rc.resolution }}">
                        {{ rc.resolution === 'keep-local' ? '保留本地' : rc.resolution === 'adopt-remote' ? '采用新数据' : '按字段' }}
                      </span>
                    </div>
                    <small>{{ rc.fieldConflicts.length }} 个字段有差异</small>
                  </li>
                </ul>
              </div>
            </section>

            <section class="conflict-field-detail" *ngIf="selectedRecordConflict">
              <div class="selected-record-header">
                <h3>{{ selectedRecordConflict.recordLabel }}</h3>
                <div class="record-resolution-switch">
                  <label>
                    <input type="radio" [name]="'rec-'+selectedRecordConflict.recordId"
                      [checked]="selectedRecordConflict.resolution === 'keep-local'"
                      (change)="setRecordResolution(selectedRecordConflict.recordId, 'keep-local')" />
                    <span>保留本窗口</span>
                  </label>
                  <label>
                    <input type="radio" [name]="'rec-'+selectedRecordConflict.recordId"
                      [checked]="selectedRecordConflict.resolution === 'adopt-remote'"
                      (change)="setRecordResolution(selectedRecordConflict.recordId, 'adopt-remote')" />
                    <span>采用新数据</span>
                  </label>
                  <label>
                    <input type="radio" [name]="'rec-'+selectedRecordConflict.recordId"
                      [checked]="selectedRecordConflict.resolution === 'field-level'"
                      (change)="setRecordResolution(selectedRecordConflict.recordId, 'field-level')" />
                    <span>按字段选择</span>
                  </label>
                </div>
              </div>

              <div class="field-diff-table">
                <div class="diff-row diff-header">
                  <span class="diff-field">字段</span>
                  <span class="diff-local">本窗口值</span>
                  <span class="diff-remote">新数据值</span>
                  <span class="diff-choice" *ngIf="selectedRecordConflict.resolution === 'field-level'">选择</span>
                </div>
                <div class="diff-row" *ngFor="let fc of selectedRecordConflict.fieldConflicts">
                  <span class="diff-field"><strong>{{ fc.field }}</strong></span>
                  <span class="diff-local" [class.chosen]="selectedRecordConflict.resolution === 'keep-local' || (selectedRecordConflict.resolution === 'field-level' && selectedRecordConflict.fieldResolutions?.[fc.field] === 'local')">
                    <code>{{ stringify(fc.localValue) }}</code>
                  </span>
                  <span class="diff-remote" [class.chosen]="selectedRecordConflict.resolution === 'adopt-remote' || (selectedRecordConflict.resolution === 'field-level' && selectedRecordConflict.fieldResolutions?.[fc.field] === 'remote')">
                    <code>{{ stringify(fc.remoteValue) }}</code>
                  </span>
                  <span class="diff-choice" *ngIf="selectedRecordConflict.resolution === 'field-level'">
                    <label>
                      <input type="radio" [name]="'field-'+fc.field"
                        [checked]="selectedRecordConflict.fieldResolutions?.[fc.field] !== 'remote'"
                        (change)="setFieldChoice(selectedRecordConflict.recordId, fc.field, 'local')" />
                      <span>本地</span>
                    </label>
                    <label>
                      <input type="radio" [name]="'field-'+fc.field"
                        [checked]="selectedRecordConflict.fieldResolutions?.[fc.field] === 'remote'"
                        (change)="setFieldChoice(selectedRecordConflict.recordId, fc.field, 'remote')" />
                      <span>新数据</span>
                    </label>
                  </span>
                </div>
              </div>
            </section>
          </div>

          <footer class="conflict-modal-footer">
            <button type="button" class="ghost" (click)="dismissConflictPanel()">暂不处理</button>
            <button type="button" class="confirm-btn" (click)="applyAllConflicts()">✅ 应用所有选择并合并</button>
          </footer>
        </div>
      </div>
    </main>
  `,
  styles: [`
    * { box-sizing: border-box; }
    main { min-height: 100vh; padding: 28px; background: #f4f5f1; color: #242923; font-family: Inter, "PingFang SC", Arial, sans-serif; }
    button, input, select { font: inherit; }
    .hero { display: flex; justify-content: space-between; gap: 20px; align-items: end; padding: 30px; border-radius: 8px; background: linear-gradient(135deg, #2c5144, #83714b); color: white; }
    .hero p { margin: 0 0 6px; opacity: .8; }
    h1 { margin: 0; font-size: clamp(34px, 5vw, 58px); letter-spacing: 0; }
    h2 { margin: 0 0 16px; font-size: 18px; }
    .stats { display: flex; flex-wrap: wrap; gap: 10px; }
    .stats span { padding: 10px 12px; border-radius: 8px; border: 1px solid rgb(255 255 255 / .22); background: rgb(255 255 255 / .12); }
    .layout { display: grid; grid-template-columns: 300px 1fr 300px; gap: 16px; margin-top: 16px; align-items: start; }
    .stack { display: grid; gap: 16px; }
    .panel { background: #fff; border: 1px solid #dfe4d8; border-radius: 8px; padding: 18px; box-shadow: 0 10px 28px rgb(38 49 34 / .07); }
    form.panel { display: flex; flex-direction: column; gap: 10px; }
    input, select { width: 100%; border: 1px solid #cfd8ca; border-radius: 8px; padding: 11px 12px; background: #fff; color: #242923; }
    button { border: 0; border-radius: 8px; padding: 11px 13px; background: #315448; color: #fff; cursor: pointer; }
    .ghost { background: #ebefe7; color: #28342c; }
    .toolbar { display: flex; justify-content: space-between; gap: 14px; align-items: center; margin-bottom: 14px; }
    .toolbar div { display: flex; gap: 8px; }
    .taskList { display: grid; gap: 10px; }
    .taskList article { display: grid; grid-template-columns: 1.2fr 240px auto; gap: 12px; align-items: center; border: 1px solid #e0e6d8; border-radius: 8px; padding: 14px; background: #fbfcf9; }
    .taskList strong, .taskList span, .taskList small { display: block; }
    .taskList span, .taskList small, .taskList p, .muted, .load span, .exception span { color: #65715f; }
    .taskList p { grid-column: 1 / -1; margin: 0; }
    .warn { border-color: #d78b63 !important; background: #fff7ef !important; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .progress { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .progress p { margin: 0; border: 1px solid #e2e7da; border-radius: 8px; padding: 12px; background: #fbfcf9; }
    .progress strong, .progress span, .load strong, .load span, .exception strong, .exception span { display: block; }
    .progress strong { font-size: 24px; }
    .exception, .load { border-bottom: 1px solid #edf0e8; padding: 10px 0; margin: 0; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .taskList article { grid-template-columns: 1fr; } .toolbar, .toolbar div, .hero { flex-direction: column; align-items: stretch; } }
    .auto-assign-btn { background: #5a8fd9; }
    .auto-assign-btn:hover { background: #4a7fc9; }
    .auto-assign-result { border: 1px solid #c4d9f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; background: #f0f5fc; }
    .auto-assign-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .auto-assign-header h3 { margin: 0; font-size: 15px; color: #315448; }
    .auto-assign-summary { display: flex; gap: 16px; margin-bottom: 10px; }
    .assign-ok { color: #4a9f6d; font-weight: 500; font-size: 14px; }
    .assign-fail { color: #c75454; font-weight: 500; font-size: 14px; }
    .auto-assign-detail { margin-top: 8px; }
    .detail-title { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #3d4a38; }
    .detail-title.fail { color: #c75454; }
    .detail-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }
    .detail-row.ok { background: #fff; border: 1px solid #e2e7da; }
    .detail-row.fail { background: #fff7ef; border: 1px solid #f0d9c4; }
    .detail-elder { flex: 1; }
    .detail-elder small { color: #65715f; margin-left: 4px; }
    .detail-arrow { color: #5a8fd9; font-weight: bold; }
    .detail-volunteer { font-weight: 600; color: #315448; }
    .detail-reason { color: #c75454; font-size: 12px; flex: 1; text-align: right; }
    .load-item { padding: 10px 0; border-bottom: 1px solid #edf0e8; }
    .load-item:last-child { border-bottom: 0; }
    .load-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .load-header strong { font-size: 14px; }
    .load-header span { font-size: 13px; color: #65715f; }
    .load-bar-bg { width: 100%; height: 8px; background: #edf0e8; border-radius: 4px; overflow: hidden; }
    .load-bar-fill { height: 100%; border-radius: 4px; background: #4a9f6d; transition: width .3s ease; }
    .load-bar-fill.near { background: #d9a84a; }
    .load-bar-fill.full { background: #c75454; }
    .load-area { display: block; margin-top: 4px; font-size: 11px; color: #99a593; }
    .kanban-section { margin-top: 16px; }
    .kanban-grid { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; }
    .kanban-column { min-width: 240px; flex: 1; background: #f7f8f4; border: 1px solid #e2e7da; border-radius: 8px; padding: 14px; }
    .kanban-unassigned { background: #f9f6ef; border-color: #ddd5c3; }
    .kanban-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e7da; }
    .kanban-header strong { font-size: 15px; }
    .kanban-header span { font-size: 12px; color: #65715f; }
    .kanban-cards { display: flex; flex-direction: column; gap: 8px; }
    .kanban-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; border: 1px solid #e0e6d8; border-radius: 8px; padding: 12px; background: #fff; }
    .kanban-card-info strong, .kanban-card-info span, .kanban-card-info small { display: block; }
    .kanban-card-info span, .kanban-card-info small { color: #65715f; }
    .kanban-status { margin: 6px 0 0; font-size: 12px; color: #65715f; }
    .kanban-order-btns { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }
    .sm { padding: 4px 8px; font-size: 13px; }
    .sm:disabled { opacity: .3; cursor: default; }
    .sm-label { font-size: 13px; font-weight: normal; }
    .elder-list-panel h2 { display: flex; align-items: center; gap: 6px; }
    .elder-list { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; }
    .elder-card { border: 1px solid #e0e6d8; border-radius: 8px; padding: 12px; background: #fbfcf9; cursor: pointer; transition: all .15s; }
    .elder-card:hover { border-color: #b8c7a8; background: #f4f7ee; }
    .elder-card.active { border-color: #315448; background: #eef3ea; }
    .elder-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .elder-card small { display: block; color: #65715f; margin-bottom: 8px; }
    .visit-btn { white-space: nowrap; }
    .last-visit { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; color: #65715f; border-top: 1px solid #e8ede1; padding-top: 8px; }
    .last-visit.no-visit { color: #99a593; }
    .visit-dot { width: 8px; height: 8px; border-radius: 50%; background: #4a9f6d; flex-shrink: 0; }
    .visit-dot.no { background: #c4cdbd; }
    .visit-summary { flex-basis: 100%; margin: 4px 0 0; padding: 6px 8px; background: #f4f7ee; border-radius: 6px; font-size: 12px; color: #4a5a45; line-height: 1.5; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(36, 41, 35, .45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
    .modal-panel { background: #fff; border-radius: 12px; width: 100%; max-width: 620px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 30px 80px rgba(36, 41, 35, .25); }
    .modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px 22px 16px; border-bottom: 1px solid #e8ede1; }
    .modal-header h2 { margin: 0 0 4px; }
    .modal-header p { margin: 0; }
    .modal-tabs { display: flex; gap: 4px; padding: 0 22px; border-bottom: 1px solid #e8ede1; }
    .modal-tabs button { background: transparent; color: #65715f; border: 0; padding: 12px 16px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .modal-tabs button.active-tab { color: #315448; border-bottom-color: #315448; font-weight: 600; }
    .badge { background: #315448; color: #fff; border-radius: 10px; padding: 1px 8px; font-size: 11px; }
    .modal-body { padding: 20px 22px; overflow-y: auto; flex: 1; }
    .visit-form { display: flex; flex-direction: column; gap: 16px; }
    .form-row { display: flex; flex-direction: column; gap: 6px; }
    .form-row label { font-size: 13px; font-weight: 500; color: #3d4a38; }
    .form-row textarea { width: 100%; border: 1px solid #cfd8ca; border-radius: 8px; padding: 11px 12px; background: #fff; color: #242923; resize: vertical; font-family: inherit; }
    .method-group { display: flex; gap: 10px; flex-wrap: wrap; }
    .method-item { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border: 1px solid #cfd8ca; border-radius: 8px; cursor: pointer; font-size: 14px; background: #fff; transition: all .15s; }
    .method-item:has(input:checked) { border-color: #315448; background: #eef3ea; color: #315448; font-weight: 500; }
    .method-item input { width: auto; margin: 0; accent-color: #315448; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px; }
    .visit-history { display: flex; flex-direction: column; gap: 14px; }
    .visit-history-item { border: 1px solid #e0e6d8; border-radius: 10px; padding: 14px 16px; background: #fbfcf9; }
    .visit-history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e0e6d8; }
    .visit-history-header strong { font-size: 15px; margin-right: 8px; }
    .method-tag { display: inline-block; padding: 3px 10px; background: #eef3ea; color: #315448; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .visit-history-content { display: flex; flex-direction: column; gap: 10px; }
    .visit-block { display: flex; flex-direction: column; gap: 4px; }
    .visit-block label { font-size: 12px; font-weight: 600; color: #5a6b53; }
    .visit-block label.attention { color: #b36a2e; }
    .visit-block p { margin: 0; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #edf0e8; font-size: 14px; line-height: 1.6; color: #3d4a38; }
    .visit-block p.attention-p { background: #fff7ef; border-color: #f5dfcb; }
    .created-at { display: block; margin-top: 10px; color: #99a593; font-size: 11px; text-align: right; }
    .center { text-align: center; padding: 20px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .tag-item { display: flex; align-items: center; gap: 4px; }
    .tag-del { padding: 2px 6px !important; font-size: 12px !important; line-height: 1; border-radius: 50% !important; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
    .tag-add-form { display: flex; gap: 8px; }
    .tag-add-form input { flex: 1; }
    .tag-chip { display: inline-block; padding: 4px 10px; background: #eef3ea; color: #315448; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; border: 1px solid transparent; }
    .tag-chip.sm { padding: 3px 8px; font-size: 11px; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .tag-select { display: flex; flex-direction: column; gap: 6px; }
    .tag-select-label { font-size: 13px; font-weight: 500; color: #3d4a38; }
    .tag-select-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .tag-check { display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid #cfd8ca; border-radius: 8px; cursor: pointer; font-size: 13px; background: #fff; transition: all .15s; }
    .tag-check:has(input:checked) { border-color: #315448; background: #eef3ea; color: #315448; font-weight: 500; }
    .tag-check input { width: auto; margin: 0; accent-color: #315448; }
    .tag-stats { display: flex; flex-direction: column; gap: 8px; }
    .tag-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf0e8; }
    .tag-stat-row:last-child { border-bottom: 0; }
    .tag-stat-row strong { font-size: 16px; color: #315448; }
    .tag-edit { padding: 2px 8px !important; font-size: 11px !important; }
    .tag-save { padding: 6px 10px !important; font-size: 12px !important; background: #315448 !important; }
    .tag-edit-input { padding: 6px 8px !important; font-size: 12px !important; min-width: 100px; }
    .elder-card-btns { display: flex; gap: 6px; }
    .elder-edit-card { display: flex !important; flex-direction: column; gap: 8px; cursor: default !important; border-color: #315448 !important; background: #f4f7ee !important; }
    .elder-edit-card input { width: 100%; }
    .elder-edit-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
    .exc-status-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .exc-status-item { text-align: center; border: 1px solid #e2e7da; border-radius: 8px; padding: 10px 6px; background: #fbfcf9; }
    .exc-status-item strong { display: block; font-size: 22px; margin-bottom: 2px; }
    .exc-status-item span { font-size: 12px; color: #65715f; }
    .exc-list { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; }
    .exc-item { border: 1px solid #e0e6d8; border-radius: 8px; padding: 12px; background: #fbfcf9; }
    .exc-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .exc-item-header strong { font-size: 14px; }
    .exc-item-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 12px; color: #65715f; }
    .exc-item-desc { margin: 0 0 6px; font-size: 13px; color: #3d4a38; line-height: 1.5; }
    .exc-item-handler { font-size: 12px; color: #5a8fd9; margin-bottom: 6px; }
    .exc-item-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .exc-severity, .exc-status-tag, .exc-category { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; border: 1px solid; }
    .exc-severity { background: transparent; }
    .exc-status-tag { background: transparent; }
    .exc-category { background: #f0f5fc; color: #5a8fd9; border-color: #c4d9f0; }
    .exc-modal { max-width: 700px; }
    .exc-form { display: flex; flex-direction: column; gap: 16px; }
    .exc-filter-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .exc-filter-bar select, .exc-filter-bar input { flex: 1; min-width: 120px; padding: 8px 10px; font-size: 13px; }
    .exc-modal-items { display: flex; flex-direction: column; gap: 12px; }
    .exc-modal-item { border: 1px solid #e0e6d8; border-radius: 10px; padding: 14px 16px; background: #fbfcf9; }
    .exc-modal-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #e0e6d8; }
    .exc-modal-item-header strong { font-size: 15px; margin-right: 8px; }
    .exc-date { font-size: 12px; color: #65715f; margin-left: 6px; }
    .exc-modal-item-tags { display: flex; gap: 6px; align-items: center; }
    .exc-modal-item-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 13px; color: #65715f; }
    .exc-modal-item-desc { margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #3d4a38; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #edf0e8; }
    .exc-modal-item-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
    .exc-result-input { flex: 1; min-width: 140px; padding: 6px 8px !important; font-size: 12px !important; }
    .exc-result-row { display: flex; gap: 6px; align-items: flex-start; font-size: 13px; padding: 8px 10px; background: #f4f7ee; border-radius: 6px; margin-bottom: 6px; }
    .exc-result-row label { font-weight: 600; color: #3d4a38; white-space: nowrap; }
    .exc-result-row span { color: #4a5a45; line-height: 1.5; }

    .view-switcher { display: flex; gap: 4px; background: rgba(255,255,255,.12); padding: 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,.2); }
    .view-switcher button { background: transparent; color: rgba(255,255,255,.75); border: 0; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; white-space: nowrap; transition: all .15s ease; }
    .view-switcher button:hover { color: #fff; background: rgba(255,255,255,.08); }
    .view-switcher button.active-view { background: #fff; color: #315448; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    .hero-actions { display: flex; gap: 8px; align-items: center; }
    .hero-actions .ghost { background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.3); }
    .hero-actions .ghost:hover { background: rgba(255,255,255,.25); border-color: rgba(255,255,255,.45); }
    .hero-kitchen-btn { font-weight: 600; }
    .import-export-btn { white-space: nowrap; }
    .view-container { margin-top: 16px; }

    .import-export-modal { max-width: 720px; }
    .export-section { display: flex; flex-direction: column; gap: 20px; }
    .export-info h3 { margin: 0 0 8px; font-size: 16px; color: #315448; }
    .export-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .export-list li { padding: 10px 14px; background: #f7f8f4; border-radius: 8px; border: 1px solid #e2e7da; }
    .export-list li strong { font-size: 20px; color: #315448; margin-right: 6px; }
    .export-btn { padding: 14px 20px; font-size: 16px; background: #315448; }
    .export-btn:hover { background: #2c4a3f; }

    .import-section { display: flex; flex-direction: column; gap: 16px; }
    .import-upload-area { text-align: center; padding: 40px 20px; border: 2px dashed #cfd8ca; border-radius: 12px; background: #fbfcf9; }
    .upload-icon { font-size: 48px; margin-bottom: 12px; }
    .import-upload-area h3 { margin: 0 0 8px; color: #315448; }
    .file-input-label { display: inline-block; margin: 16px 0 8px; }
    .file-input-label span { display: inline-block; padding: 10px 24px; background: #315448; color: #fff; border-radius: 8px; cursor: pointer; }
    .file-input-label span:hover { background: #2c4a3f; }
    .import-tip { font-size: 12px; color: #99a593; margin-top: 8px; }

    .import-error { padding: 20px; background: #fff7ef; border: 1px solid #f0d9c4; border-radius: 10px; }
    .error-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .error-icon { font-size: 20px; }
    .error-header strong { color: #c75454; font-size: 15px; }
    .error-details { margin: 0 0 16px; padding-left: 20px; color: #b36a2e; font-size: 13px; }
    .error-details li { margin-bottom: 4px; }

    .import-success { text-align: center; padding: 40px 20px; }
    .success-icon { font-size: 56px; margin-bottom: 12px; }
    .import-success h3 { margin: 0 0 8px; color: #4a9f6d; font-size: 20px; }

    .import-preview { display: flex; flex-direction: column; gap: 16px; }
    .preview-header { display: flex; justify-content: space-between; align-items: center; }
    .preview-header h3 { margin: 0; font-size: 16px; color: #315448; }
    .preview-legend { display: flex; gap: 16px; padding: 10px 14px; background: #f7f8f4; border-radius: 8px; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #5a6b53; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
    .legend-dot.new { background: #4a9f6d; }
    .legend-dot.overwrite { background: #d9a84a; }
    .legend-dot.duplicate { background: #99a593; }

    .preview-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .preview-card { padding: 14px; background: #fbfcf9; border: 1px solid #e2e7da; border-radius: 8px; }
    .preview-card h4 { margin: 0 0 10px; font-size: 14px; color: #315448; }
    .preview-stats { display: flex; gap: 8px; }
    .preview-stats .stat { padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600; }
    .preview-stats .stat.new { background: #e8f3ec; color: #4a9f6d; }
    .preview-stats .stat.overwrite { background: #fdf3e0; color: #b3832a; }
    .preview-stats .stat.duplicate { background: #eff1ec; color: #8a9783; }

    .import-warning { padding: 12px 16px; background: #fff7ef; border-left: 4px solid #d9a84a; border-radius: 6px; font-size: 13px; color: #8a6a2a; }
    .import-warning strong { margin-right: 6px; }
    .import-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; }
    .confirm-btn { background: #4a9f6d; }
    .confirm-btn:hover { background: #3e8a5c; }

    @media (max-width: 600px) {
      .export-list { grid-template-columns: 1fr; }
      .preview-cards { grid-template-columns: 1fr 1fr; }
    }

    .phone-status-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .phone-status-item { text-align: center; border: 1px solid #e2e7da; border-radius: 8px; padding: 10px 6px; background: #fbfcf9; }
    .phone-status-item strong { display: block; font-size: 20px; margin-bottom: 2px; color: #315448; }
    .phone-status-item span { font-size: 12px; color: #65715f; }

    .phone-callback-list { display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; }
    .phone-callback-item { border: 1px solid #e0e6d8; border-radius: 8px; padding: 10px 12px; background: #fbfcf9; }
    .cb-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .cb-item-header strong { font-size: 14px; }
    .cb-status-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; border: 1px solid; }
    .cb-item-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: #65715f; margin-bottom: 4px; }
    .cb-item-time { font-size: 12px; color: #b36a2e; margin-bottom: 8px; }
    .cb-item-actions { display: flex; flex-wrap: wrap; gap: 6px; }

    .phone-notif-modal { max-width: 720px; }
    .phone-notif-list, .callback-task-list { display: flex; flex-direction: column; gap: 12px; }
    .phone-notif-items, .callback-items { display: flex; flex-direction: column; gap: 12px; }
    .phone-notif-item, .callback-item { border: 1px solid #e0e6d8; border-radius: 10px; padding: 14px 16px; background: #fbfcf9; }
    .phone-notif-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #e0e6d8; }
    .phone-notif-header strong { font-size: 15px; margin-right: 8px; }
    .phone-notif-date { font-size: 12px; color: #65715f; margin-left: 6px; }
    .phone-notif-tags { display: flex; gap: 6px; align-items: center; }
    .notif-source-tag { display: inline-block; padding: 2px 8px; background: #f0f5fc; color: #5a8fd9; border: 1px solid #c4d9f0; border-radius: 10px; font-size: 11px; font-weight: 500; }
    .notif-status-tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; border: 1px solid; }
    .phone-notif-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 13px; color: #65715f; }
    .phone-notif-remark { margin: 0 0 8px; font-size: 13px; line-height: 1.6; color: #3d4a38; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #edf0e8; }
    .phone-notif-callback-info { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; padding: 6px 10px; background: #fdf3e0; border-radius: 6px; font-size: 12px; }
    .cb-count { color: #b36a2e; font-weight: 500; }
    .cb-latest { color: #8a6a2a; }
    .phone-notif-actions { display: flex; flex-wrap: wrap; gap: 6px; }

    .callback-filter-bar { display: flex; gap: 8px; margin-bottom: 14px; }
    .callback-filter-bar select { flex: 1; min-width: 120px; padding: 8px 10px; font-size: 13px; }
    .callback-item-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px dashed #e0e6d8; }
    .callback-item-header strong { font-size: 15px; margin-right: 8px; }
    .cb-date { font-size: 12px; color: #65715f; margin-left: 6px; }
    .cb-status-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .callback-item-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 6px; font-size: 13px; color: #65715f; }
    .callback-item-time { font-size: 13px; color: #b36a2e; margin-bottom: 8px; font-weight: 500; }
    .callback-item-result { display: flex; gap: 6px; align-items: flex-start; font-size: 13px; padding: 8px 10px; background: #e8f3ec; border-radius: 6px; margin-bottom: 6px; }
    .callback-item-result label { font-weight: 600; color: #3d4a38; white-space: nowrap; }
    .callback-item-result span { color: #4a5a45; line-height: 1.5; }
    .callback-item-remark { margin: 0 0 8px; font-size: 13px; color: #65715f; }
    .callback-item-remark label { font-weight: 600; color: #5a6b53; }
    .callback-item-actions { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }

    .callback-form-modal { max-width: 520px; }
    .callback-form { display: flex; flex-direction: column; gap: 16px; }

    .callback-filter-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .callback-filter-bar select { flex: 1; min-width: 120px; padding: 8px 10px; font-size: 13px; }

    .sync-toast {
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      padding: 12px 18px; border-radius: 8px; background: #2c5144; color: white;
      box-shadow: 0 8px 24px rgba(0,0,0,.18); display: flex; align-items: center; gap: 10px;
      animation: toast-in .25s ease-out;
    }
    .sync-toast.toast-warn { background: #8a5a1d; }
    .sync-toast.toast-error { background: #8a3a3a; }
    @keyframes toast-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .conflict-modal-backdrop {
      position: fixed; inset: 0; background: rgba(20,25,20,.6);
      z-index: 9000; display: flex; align-items: center; justify-content: center;
      padding: 30px;
    }
    .conflict-modal {
      background: white; border-radius: 12px; width: 100%; max-width: 1200px;
      max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,.25);
    }
    .conflict-modal-header {
      padding: 20px 28px; border-bottom: 1px solid #e2e7da; display: flex; justify-content: space-between; align-items: start; gap: 16px;
      background: linear-gradient(135deg, #fff8ed, #f4f7f0);
    }
    .conflict-modal-header h2 { margin: 0 0 4px; font-size: 22px; color: #3d4a38; }
    .conflict-subtitle { margin: 0; color: #65715f; font-size: 13px; }
    .close-btn {
      background: none; border: none; font-size: 22px; color: #65715f; cursor: pointer;
      width: 32px; height: 32px; border-radius: 6px;
    }
    .close-btn:hover { background: #e2e7da; }

    .conflict-body {
      display: grid; grid-template-columns: 220px 320px 1fr; flex: 1; min-height: 0; overflow: hidden;
    }
    .conflict-groups {
      border-right: 1px solid #e2e7da; padding: 16px; background: #f9faf6; overflow-y: auto;
    }
    .conflict-groups h3 { margin: 0 0 12px; font-size: 13px; color: #65715f; text-transform: uppercase; letter-spacing: .5px; }
    .conflict-groups ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .conflict-groups li {
      display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 6px;
      cursor: pointer; font-size: 14px; color: #3d4a38;
    }
    .conflict-groups li:hover { background: #e8ede1; }
    .conflict-groups li.active { background: #2c5144; color: white; }
    .badge {
      background: #c75454; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
    }
    .conflict-groups li.active .badge { background: #ff6b6b; }

    .global-resolution-bar { margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e7da; display: flex; flex-direction: column; gap: 6px; }
    .global-resolution-bar button { width: 100%; font-size: 12px; padding: 8px 10px; }

    .conflict-content, .conflict-field-detail { padding: 18px; overflow-y: auto; min-height: 0; }
    .conflict-content { border-right: 1px solid #e2e7da; background: #fdfcf9; }

    .conflict-type-header, .selected-record-header {
      padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid #e2e7da;
    }
    .conflict-type-header h3, .selected-record-header h3 { margin: 0 0 10px; font-size: 15px; color: #3d4a38; }
    .resolution-switch, .record-resolution-switch {
      display: flex; flex-wrap: wrap; gap: 12px;
    }
    .resolution-switch label, .record-resolution-switch label, .diff-choice label {
      display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #4a5a45;
      cursor: pointer; padding: 4px 8px; border-radius: 4px;
    }
    .resolution-switch label:hover, .record-resolution-switch label:hover { background: #eef3e7; }

    .conflict-record-list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .conflict-record-list li {
      padding: 12px; border-radius: 6px; border: 1px solid #e2e7da; background: white;
      cursor: pointer; transition: all .15s;
    }
    .conflict-record-list li:hover { border-color: #2c5144; background: #f4f7f0; }
    .conflict-record-list li.active { border-color: #2c5144; background: #eaf2e4; box-shadow: 0 0 0 2px rgba(44,81,68,.15); }
    .rc-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .rc-row strong { font-size: 14px; color: #242923; }
    .rc-resolution { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .rc-resolution.rc-keep-local { background: #d9f0e0; color: #2d7a4c; }
    .rc-resolution.rc-adopt-remote { background: #d9e4f5; color: #2d5b9a; }
    .rc-resolution.rc-field-level { background: #f5ecd9; color: #8a5a1d; }
    .conflict-record-list li small { color: #65715f; font-size: 12px; }

    .field-diff-table { display: flex; flex-direction: column; gap: 0; border: 1px solid #e2e7da; border-radius: 8px; overflow: hidden; }
    .diff-row {
      display: grid; grid-template-columns: 180px 1fr 1fr 140px; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #eef3e7;
      align-items: start; font-size: 13px;
    }
    .diff-row:last-child { border-bottom: none; }
    .diff-header { background: #f4f7f0; font-weight: 600; color: #5a6b53; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
    .diff-field { color: #3d4a38; min-width: 0; word-break: break-word; }
    .diff-local, .diff-remote {
      min-width: 0; padding: 8px 10px; border-radius: 4px; background: #f9faf6;
      border: 1px solid transparent;
    }
    .diff-local code, .diff-remote code {
      display: block; white-space: pre-wrap; word-break: break-all; color: #242923; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
    }
    .diff-local.chosen { background: #e6f4ea; border-color: #4a9f6d; }
    .diff-remote.chosen { background: #e6eefb; border-color: #5a8fd9; }
    .diff-choice { display: flex; flex-direction: column; gap: 4px; justify-content: center; }
    .diff-choice label { padding: 2px 4px; }

    .conflict-modal-footer {
      padding: 16px 28px; border-top: 1px solid #e2e7da; display: flex; justify-content: space-between; align-items: center;
      background: #f9faf6;
    }
    .confirm-btn {
      background: #2c5144; color: white; border: none; padding: 10px 22px; border-radius: 6px;
      cursor: pointer; font-weight: 600; font-size: 14px;
    }
    .confirm-btn:hover { background: #1e3a30; }

    @media (max-width: 900px) {
      .conflict-body { grid-template-columns: 1fr; }
      .diff-row { grid-template-columns: 110px 1fr 1fr; }
      .diff-choice { grid-column: 1 / -1; flex-direction: row; justify-content: flex-start; }
      .conflict-groups, .conflict-content { border-right: none; border-bottom: 1px solid #e2e7da; }
    }

    .simulation-panel { border-color: #d4c56b; background: #fffdf5; }
    .simulation-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .simulation-title { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .simulation-title h2 { margin: 0; }
    .sim-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: #d4c56b; color: #5a4f1a; font-size: 12px; font-weight: 600; }
    .sim-date-range { color: #7a6d2e; font-size: 14px; }
    .simulation-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .submit-btn { background: #4a9f6d; }
    .submit-btn:hover { background: #3a8f5d; }
    .cancel-btn { color: #c75454 !important; }

    .simulation-day-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 14px; border-bottom: 1px solid #ede4c4; }
    .sim-day-tab { padding: 8px 14px; border: 1px solid #e5dcab; border-radius: 8px; background: #fff; cursor: pointer; white-space: nowrap; font-size: 13px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .sim-day-tab:hover { background: #faf6e3; }
    .sim-day-tab.active { background: #d4c56b; border-color: #c4b55b; color: #3d3510; font-weight: 600; }
    .sim-day-count { font-size: 11px; opacity: 0.8; }

    .simulation-summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .sim-summary-item { text-align: center; padding: 12px 8px; border-radius: 8px; background: #fff; border: 1px solid #ede4c4; }
    .sim-summary-item strong { display: block; font-size: 24px; color: #3d3510; }
    .sim-summary-item span { font-size: 12px; color: #7a6d2e; }
    .sim-summary-item.ok strong { color: #4a9f6d; }
    .sim-summary-item.warn strong { color: #d9a84a; }
    .sim-summary-item.muted strong { color: #8a9783; }
    .sim-summary-item.special strong { color: #b36a2e; }

    .sim-setup { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .sim-setup input { width: auto; min-width: 140px; }
    .sim-date-sep { color: #65715f; }
    .sim-desc { margin: 8px 0 0; font-size: 13px; }

    .simulation-modal { max-width: 900px; }
    .sim-date-selector { padding: 10px 22px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e8ede1; }
    .sim-date-selector select { width: auto; min-width: 180px; }

    .sim-overview, .sim-load, .sim-unassigned, .sim-paused, .sim-special, .sim-route { padding: 6px 0; }
    .sim-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .sim-stat-card { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 10px; background: #f7f8f4; border: 1px solid #e2e7da; }
    .sim-stat-icon { font-size: 28px; }
    .sim-stat-info strong { display: block; font-size: 22px; color: #242923; }
    .sim-stat-info span { font-size: 13px; color: #65715f; }
    .sim-stat-card.ok .sim-stat-info strong { color: #4a9f6d; }
    .sim-stat-card.warn .sim-stat-info strong { color: #d9a84a; }
    .sim-stat-card.muted .sim-stat-info strong { color: #8a9783; }
    .sim-stat-card.special .sim-stat-info strong { color: #b36a2e; }

    .sim-section { margin-top: 16px; }
    .sim-section h3 { margin: 0 0 10px; font-size: 15px; color: #315448; }

    .sim-tag-list { display: flex; flex-wrap: wrap; gap: 10px; }
    .sim-tag-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #fff; border: 1px solid #e2e7da; border-radius: 20px; }
    .sim-tag-item strong { font-size: 13px; color: #3d4a38; }

    .sim-load h3, .sim-unassigned h3, .sim-paused h3, .sim-special h3, .sim-route h3 { margin: 0 0 14px; font-size: 16px; color: #315448; }

    .sim-load-list { display: flex; flex-direction: column; gap: 10px; }
    .sim-load-item { padding: 12px; background: #f7f8f4; border-radius: 8px; border: 1px solid #e2e7da; }
    .sim-load-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .sim-load-header strong { font-size: 14px; }
    .sim-load-header span { font-size: 13px; color: #65715f; }
    .sim-load-header span.overloaded { color: #c75454; font-weight: 600; }

    .sim-unassigned-list { display: flex; flex-direction: column; gap: 8px; }
    .sim-unassigned-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 12px; background: #fff7ef; border: 1px solid #f0d9c4; border-radius: 8px; }
    .sim-unassigned-elder strong { font-size: 14px; display: block; }
    .sim-unassigned-elder small { color: #65715f; }
    .sim-unassigned-reason { font-size: 13px; color: #c75454; text-align: right; flex-shrink: 0; max-width: 50%; }

    .sim-paused-summary { padding: 12px; background: #f0f2ed; border-radius: 8px; margin-bottom: 12px; }
    .sim-paused-summary p { margin: 0; font-size: 14px; }
    .sim-paused-list { display: flex; flex-direction: column; gap: 8px; }
    .sim-paused-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f7f8f4; border: 1px solid #e2e7da; border-radius: 8px; }
    .sim-paused-item strong { font-size: 14px; display: block; }
    .sim-paused-item small { color: #65715f; }
    .sim-paused-contact { font-size: 13px; color: #5a8fd9; }

    .sim-special-list { display: flex; flex-direction: column; gap: 8px; }
    .sim-special-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 12px; background: #fdf5ec; border: 1px solid #f3e0c9; border-radius: 8px; }
    .sim-special-item strong { font-size: 14px; display: block; }
    .sim-special-item small { color: #65715f; }
    .sim-special-note { font-size: 13px; color: #b36a2e; text-align: right; max-width: 60%; }

    .sim-route-grid { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; }
    .sim-route-column { min-width: 220px; flex: 1; background: #f7f8f4; border: 1px solid #e2e7da; border-radius: 8px; padding: 12px; }
    .sim-route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e2e7da; }
    .sim-route-header strong { font-size: 14px; }
    .sim-route-header span { font-size: 12px; color: #65715f; }
    .sim-route-list { display: flex; flex-direction: column; gap: 6px; }
    .sim-route-item { display: flex; gap: 8px; align-items: flex-start; padding: 8px; background: #fff; border-radius: 6px; border: 1px solid #e2e7da; }
    .sim-route-order { flex-shrink: 0; width: 24px; height: 24px; line-height: 24px; text-align: center; background: #5a8fd9; color: #fff; border-radius: 50%; font-size: 12px; font-weight: 600; }
    .sim-route-info strong { font-size: 13px; display: block; }
    .sim-route-info small { font-size: 11px; color: #65715f; }

    .sim-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #e8ede1; }

    .center { text-align: center; }

    .simulation-diff-modal { max-width: 1000px; max-height: 90vh; }

    .diff-summary-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; padding: 14px 22px; background: #fafbf7; border-bottom: 1px solid #e8ede1; }
    .diff-sum-item { text-align: center; padding: 10px 6px; border-radius: 8px; background: #fff; border: 1px solid #e2e7da; }
    .diff-sum-item strong { display: block; font-size: 22px; }
    .diff-sum-item span { font-size: 12px; color: #65715f; }
    .diff-sum-item.added strong { color: #4a9f6d; }
    .diff-sum-item.removed strong { color: #c75454; }
    .diff-sum-item.volunteer strong { color: #5a8fd9; }
    .diff-sum-item.route strong { color: #9a6bd9; }
    .diff-sum-item.paused strong { color: #d9a84a; }
    .diff-sum-item.special strong { color: #b36a2e; }

    .diff-day-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 10px 22px; border-bottom: 1px solid #e8ede1; background: #fff; }
    .diff-day-tab { padding: 8px 14px; border: 1px solid #d5dcc8; border-radius: 8px; background: #fafbf7; cursor: pointer; white-space: nowrap; font-size: 13px; display: flex; align-items: center; gap: 6px; position: relative; }
    .diff-day-tab:hover { background: #f0f2ed; }
    .diff-day-tab.active { background: #4a9f6d; border-color: #3a8f5d; color: #fff; font-weight: 600; }
    .diff-day-tab.has-changes:not(.active) { border-color: #ffb74d; background: #fff8ed; }
    .diff-day-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; background: #ffb74d; color: #5a3900; font-size: 11px; border-radius: 10px; font-weight: 600; }
    .diff-day-tab.active .diff-day-badge { background: rgba(255,255,255,0.25); color: #fff; }

    .diff-modal-tabs { padding: 0 22px; border-bottom: 1px solid #e8ede1; flex-wrap: wrap; }
    .diff-modal-tabs button { position: relative; }
    .tab-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; background: #c75454; color: #fff; font-size: 11px; border-radius: 9px; margin-left: 4px; font-weight: 600; }
    .active-tab .tab-badge { background: rgba(255,255,255,0.3); }

    .diff-modal-body { max-height: 55vh; overflow-y: auto; padding: 18px 22px; }

    .diff-overview-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; }
    .diff-stat-card { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 10px; background: #f7f8f4; border: 1px solid #e2e7da; }
    .diff-stat-icon { font-size: 26px; flex-shrink: 0; }
    .diff-stat-info { flex: 1; min-width: 0; }
    .diff-stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 2px; }
    .diff-stat-row span { color: #8a9783; }
    .diff-stat-row strong { font-size: 15px; }
    .diff-stat-row.positive strong { color: #4a9f6d; }
    .diff-stat-row.negative strong { color: #c75454; }
    .diff-stat-info small { font-size: 12px; color: #65715f; display: block; margin-top: 4px; }
    .diff-stat-card.assigned { background: #edf7f0; }
    .diff-stat-card.added { background: #eaf5ee; border-color: #b8ddc5; }
    .diff-stat-card.removed { background: #fceced; border-color: #eeb9b9; }
    .diff-stat-card.volunteer { background: #eef3fb; border-color: #b9cfee; }
    .diff-stat-card.route { background: #f3eff8; border-color: #cebae9; }

    .diff-section { margin-top: 18px; }
    .diff-section h3 { margin: 0 0 12px; font-size: 15px; color: #315448; padding-bottom: 8px; border-bottom: 1px solid #e8ede1; }

    .diff-day-table { border: 1px solid #e2e7da; border-radius: 8px; overflow: hidden; }
    .diff-day-row { display: grid; grid-template-columns: 1.1fr 1.2fr 0.6fr 0.6fr 0.85fr 0.85fr 1fr 0.8fr 0.75fr; gap: 0; }
    .diff-day-row.header { background: #f0f2ed; font-weight: 600; font-size: 13px; }
    .diff-day-row.header span { padding: 10px 12px; border-bottom: 1px solid #e2e7da; }
    .diff-day-row span { padding: 9px 12px; font-size: 13px; border-bottom: 1px solid #f0f2ed; display: flex; align-items: center; }
    .diff-day-row:not(.header):last-child span { border-bottom: none; }
    .diff-day-row:not(.header):hover { background: #fafbf7; }
    .diff-day-row.no-changes { opacity: 0.6; }
    .date-cell { font-weight: 600; color: #315448; }
    .added-cell { color: #4a9f6d; font-weight: 600; }
    .removed-cell { color: #c75454; font-weight: 600; }
    .volunteer-cell { color: #5a8fd9; font-weight: 600; }
    .route-cell { color: #9a6bd9; font-weight: 600; }
    .pause-cell { color: #d9a84a; font-weight: 600; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .special-cell { color: #b36a2e; font-weight: 600; }
    .pause-mini-tag { display: inline-block; padding: 1px 6px; font-size: 10px; border-radius: 8px; font-weight: 600; line-height: 1.4; }
    .pause-new-mini { background: #fceced; color: #c75454; border: 1px solid #eeb9b9; }
    .pause-resume-mini { background: #eaf5ee; color: #4a9f6d; border: 1px solid #b8ddc5; }
    .status-tag { display: inline-block; padding: 3px 10px; font-size: 11px; border-radius: 12px; border: 1px solid; font-weight: 600; }

    .diff-list { display: flex; flex-direction: column; gap: 8px; }
    .diff-item { display: flex; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e7da; background: #fff; align-items: flex-start; gap: 12px; }
    .diff-item.added { border-left: 4px solid #4a9f6d; background: #f5faf6; }
    .diff-item.removed { border-left: 4px solid #c75454; background: #fbf4f4; }
    .diff-item.volunteer-change { border-left: 4px solid #5a8fd9; background: #f4f8fc; }
    .diff-item.special-change { border-left: 4px solid #b36a2e; background: #fcf6ee; }
    .diff-item.paused-item { border-left: 4px solid #d9a84a; background: #fcf7ed; }
    .diff-item.paused-item.new-pause { border-left-color: #c75454; background: #fbf4f4; }
    .diff-item.paused-item.resume { border-left-color: #4a9f6d; background: #f5faf6; }
    .diff-item-main { flex: 1; min-width: 0; }
    .diff-item-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 4px; }
    .diff-item-title strong { font-size: 14px; }
    .clickable { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
    .clickable:hover { color: #315448; }
    .route-order-tag { display: inline-block; padding: 2px 8px; background: #5a8fd9; color: #fff; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .diff-volunteer { font-size: 12px; padding: 3px 10px; border-radius: 12px; background: #e8efe6; color: #315448; border: 1px solid #d5dcc8; font-weight: 500; }
    .diff-volunteer.unassigned { background: #f0f2ed; color: #8a9783; }
    .reason-tag { display: inline-block; padding: 3px 10px; font-size: 11px; border-radius: 12px; font-weight: 600; }
    .reason-tag.resumed { background: #eaf5ee; color: #2e7d32; border: 1px solid #b8ddc5; }
    .reason-tag.new { background: #e8f0fa; color: #1565c0; border: 1px solid #b9cfee; }
    .reason-tag.paused { background: #fceced; color: #c62828; border: 1px solid #eeb9b9; }
    .reason-tag.removed { background: #fafafa; color: #616161; border: 1px solid #e0e0e0; }

    .change-arrow-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    .change-box { padding: 10px 14px; border-radius: 8px; flex: 1; min-width: 140px; }
    .change-box small { display: block; font-size: 11px; color: #8a9783; margin-bottom: 4px; }
    .change-box strong { font-size: 14px; }
    .change-box.old { background: #f0f2ed; border: 1px solid #d5dcc8; }
    .change-box.old .unassigned { color: #8a9783; font-weight: 500; }
    .change-box.new { background: #eaf5ee; border: 1px solid #b8ddc5; }
    .change-box.new .unassigned { color: #c75454; font-weight: 500; }
    .change-arrow { font-size: 20px; color: #8a9783; flex-shrink: 0; }
    .unassigned { color: #8a9783; font-weight: 500; }

    .pause-tag { display: inline-block; padding: 3px 10px; font-size: 11px; border-radius: 12px; font-weight: 600; }
    .pause-tag.new { background: #fceced; color: #c75454; border: 1px solid #eeb9b9; }
    .pause-tag.resume { background: #eaf5ee; color: #4a9f6d; border: 1px solid #b8ddc5; }
    .pause-tag.keep { background: #fff8ed; color: #d9a84a; border: 1px solid #f0d9a0; }
    .contact { color: #5a8fd9; margin-top: 2px; display: block; }
    .pause-status-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
    .pause-status { font-size: 12px; padding: 4px 10px; border-radius: 6px; background: #f0f2ed; color: #65715f; }
    .pause-status.active { background: #fceced; color: #c75454; font-weight: 500; }
    .pause-arrow { color: #8a9783; }

    .special-tag { display: inline-block; padding: 3px 10px; font-size: 11px; border-radius: 12px; font-weight: 600; }
    .special-tag.new { background: #fcf6ee; color: #b36a2e; border: 1px solid #efd4b4; }
    .special-tag.removed { background: #fceced; color: #c75454; border: 1px solid #eeb9b9; }
    .special-tag.changed { background: #eef3fb; color: #5a8fd9; border: 1px solid #b9cfee; }
    .special-compare { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
    .special-compare .change-box p { margin: 0; font-size: 13px; color: #3d4a38; }
    .special-single { margin-top: 8px; padding: 8px 12px; border-radius: 6px; }
    .special-single small { display: block; font-size: 11px; color: #8a9783; margin-bottom: 3px; }
    .special-single p { margin: 0; font-size: 13px; }
    .special-single.new { background: #fcf6ee; border: 1px solid #efd4b4; }
    .special-single.removed { background: #fceced; border: 1px solid #eeb9b9; text-decoration: line-through; opacity: 0.8; }

    .source-tag { display: inline-block; padding: 2px 8px; font-size: 11px; border-radius: 10px; background: #f0f2ed; color: #65715f; margin-left: 6px; font-weight: 500; }
    .change-detail-row { display: flex; align-items: flex-start; gap: 6px; margin-top: 8px; font-size: 12px; flex-wrap: wrap; }
    .change-detail-row .detail-label { color: #8a9783; flex-shrink: 0; }
    .change-detail-row .detail-text { color: #3d4a38; }
    .change-detail-row .detail-text.temp-reason { color: #9a6bd9; font-style: italic; }
    .source-compare-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
    .source-compare-row .source-label { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #f0f2ed; color: #65715f; }
    .source-compare-row .source-arrow { color: #8a9783; font-size: 12px; }

    .route-compare-grid { display: flex; flex-direction: column; gap: 14px; }
    .route-compare-card { border: 1px solid #e2e7da; border-radius: 10px; background: #fff; overflow: hidden; }
    .route-compare-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f7f8f4; border-bottom: 1px solid #e2e7da; }
    .route-compare-header strong { font-size: 14px; color: #315448; }
    .moved-count { font-size: 12px; padding: 3px 10px; background: #f3eff8; color: #9a6bd9; border-radius: 12px; font-weight: 500; }
    .comp-tag { display: inline-block; padding: 3px 10px; font-size: 11px; border-radius: 12px; font-weight: 600; margin-left: 4px; }
    .comp-tag.added { background: #eaf5ee; color: #2e7d32; border: 1px solid #b8ddc5; }
    .comp-tag.removed { background: #fceced; color: #c62828; border: 1px solid #eeb9b9; }
    .route-compare-body { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 0; padding: 12px; }
    .route-col h4 { margin: 0 0 8px; font-size: 12px; color: #65715f; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .route-col.old h4 { color: #c75454; }
    .route-col.new h4 { color: #4a9f6d; }
    .route-col-arrow { display: flex; align-items: center; justify-content: center; color: #8a9783; font-size: 18px; font-weight: 600; }
    .route-compare-list { display: flex; flex-direction: column; gap: 5px; }
    .route-compare-item { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 5px; background: #fafbf7; font-size: 12px; }
    .route-compare-item.moved { background: #fff8ed; border: 1px dashed #ffb74d; }
    .route-num { flex-shrink: 0; width: 22px; height: 22px; line-height: 22px; text-align: center; background: #d5dcc8; color: #3d4a38; border-radius: 50%; font-size: 11px; font-weight: 600; }
    .route-col.new .route-num { background: #4a9f6d; color: #fff; }
    .route-col.old .route-num { background: #c75454; color: #fff; }
    .moved-tag { margin-left: auto; font-size: 10px; padding: 2px 6px; background: #ffb74d; color: #5a3900; border-radius: 8px; font-weight: 600; }
    .route-moved-list { padding: 10px 14px; background: #fffbf2; border-top: 1px solid #f0d9a0; }
    .route-moved-list h5 { margin: 0 0 8px; font-size: 12px; color: #b36a2e; }
    .moved-item { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 12px; border-bottom: 1px dashed #f0d9a0; }
    .moved-item:last-child { border-bottom: none; }
    .moved-item span:last-child { color: #b36a2e; font-weight: 500; }

    .diff-modal-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 22px; border-top: 1px solid #e8ede1; background: #fafbf7; flex-wrap: wrap; }
    .diff-modal-footer .confirm-btn { background: linear-gradient(135deg, #4a9f6d, #3a8f5d); padding: 10px 24px; font-size: 14px; }
    .diff-modal-footer .confirm-btn:hover { background: linear-gradient(135deg, #3a8f5d, #2e7f4d); }

    .toast-success { background: #4a9f6d !important; color: #fff; }

    @media (max-width: 900px) {
      .diff-summary-bar { grid-template-columns: repeat(3, 1fr); }
      .diff-overview-grid { grid-template-columns: repeat(2, 1fr); }
      .route-compare-body { grid-template-columns: 1fr; gap: 10px; }
      .route-col-arrow { transform: rotate(90deg); padding: 4px 0; }
      .diff-day-row { grid-template-columns: 1.5fr 1fr repeat(4, 0.8fr); font-size: 11px; }
      .diff-day-row span { padding: 7px 6px; font-size: 11px; }
      .simulation-diff-modal { max-height: 92vh; }
      .diff-modal-body { max-height: 45vh; }
    }

    .temp-change-indicator { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
    .temp-change-badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #fff3e0; color: #b36a2e; border: 1px solid #f0c78a; }
    .temp-change-existing { margin-bottom: 16px; }
    .temp-change-existing h3 { font-size: 14px; margin: 0 0 8px; color: #65715f; }
    .temp-change-list-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px; border: 1px solid #e8ede1; border-radius: 6px; margin-bottom: 6px; background: #fffdf5; }
    .temp-change-list-info { display: flex; flex-direction: column; gap: 2px; }
    .temp-change-list-info strong { font-size: 13px; }
    .temp-change-list-summary { font-size: 12px; color: #b36a2e; }
    .temp-change-list-actions { display: flex; gap: 4px; }
    .temp-change-form h3 { font-size: 14px; margin: 0 0 10px; color: #315448; }
    .temp-change-conflict { margin: 12px 0; padding: 12px; border-radius: 8px; background: #fff7ef; border: 1px solid #d78b63; }
    .conflict-warning strong { color: #c75454; }
    .conflict-warning p { margin: 4px 0 0; font-size: 13px; color: #65715f; }
    .conflict-resolution { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .conflict-resolution label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
    .temp-change-modal .modal-body { max-height: 70vh; overflow-y: auto; }
    .required { color: #c75454; }
    .temp-change-card { border-left: 3px solid #d9a84a !important; background: #fffdf5 !important; }
    .temp-change-detail { color: #b36a2e; font-size: 11px; }
    .special-note { margin: 4px 0; padding: 4px 8px; background: #fff7ef; border-left: 2px solid #d9a84a; border-radius: 3px; }
    .special-note small { color: #8a5a2a; }
    .conflict-list { padding-left: 20px; margin: 4px 0; }
    .conflict-list li { font-size: 13px; color: #65715f; margin-bottom: 4px; }

    @media (max-width: 900px) {
      .simulation-summary { grid-template-columns: repeat(2, 1fr); }
      .sim-stat-grid { grid-template-columns: repeat(2, 1fr); }
      .simulation-header { flex-direction: column; }
      .simulation-actions { width: 100%; }
    }

    .temp-change-manage-btn { position: relative; }
    .tc-manage-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; height: 18px; padding: 0 5px;
      background: #c75454; color: #fff; font-size: 11px;
      border-radius: 9px; margin-left: 6px; font-weight: 600;
    }

    .temp-change-manage-modal { max-width: 900px; width: 95vw; }
    .temp-change-manage-modal .modal-body { max-height: 75vh; overflow-y: auto; padding: 0; }

    .tc-manage-summary-bar {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 20px; background: #f8f7f2;
      border-bottom: 1px solid #e8e5da;
      flex-wrap: wrap;
    }
    .tc-stat-item {
      display: flex; flex-direction: column; align-items: center;
      min-width: 70px; padding: 8px 14px;
      background: #fff; border-radius: 8px;
      border: 1px solid #e8e5da;
    }
    .tc-stat-item.total-item {
      background: linear-gradient(135deg, #f5efe4, #ece3d0);
      border-color: #d4c49c;
    }
    .tc-stat-num {
      font-size: 24px; font-weight: 700; color: #4a5040;
      line-height: 1.2;
    }
    .tc-stat-num.today-num { color: #c75454; }
    .tc-stat-num.upcoming-num { color: #d9a84a; }
    .tc-stat-num.expired-num { color: #8a9481; }
    .tc-stat-label {
      font-size: 12px; color: #65715f; margin-top: 2px;
    }
    .tc-manage-header-actions {
      margin-left: auto; display: flex; gap: 8px;
    }

    .tc-filter-tabs {
      display: flex; gap: 4px; padding: 12px 20px;
      border-bottom: 1px solid #e8e5da;
      background: #fafaf5;
    }
    .tc-filter-tabs button {
      padding: 6px 14px; border: none; background: transparent;
      border-radius: 6px; cursor: pointer;
      font-size: 13px; color: #65715f;
      transition: all 0.15s ease;
      display: flex; align-items: center; gap: 4px;
    }
    .tc-filter-tabs button:hover { background: #eeeadd; }
    .tc-filter-tabs button.active-filter {
      background: #7a8a5e; color: #fff;
    }
    .tc-filter-tabs button small { opacity: 0.7; font-size: 11px; }

    .tc-manage-body { padding: 16px 20px; }
    .tc-empty-state {
      text-align: center; padding: 48px 20px;
      color: #8a9481;
    }
    .tc-empty-icon { font-size: 48px; margin-bottom: 12px; }
    .tc-empty-state p { margin: 4px 0; font-size: 15px; color: #4a5040; }

    .tc-date-group { margin-bottom: 20px; }
    .tc-date-group:last-child { margin-bottom: 0; }
    .tc-date-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #f5efe4;
      border-radius: 8px 8px 0 0;
      border: 1px solid #e0d5be;
      border-bottom: none;
    }
    .tc-date-header h3 {
      margin: 0; font-size: 14px; color: #6b5a3a;
    }
    .tc-date-count {
      font-size: 12px; color: #8a7550;
      background: #fff; padding: 3px 10px;
      border-radius: 12px;
    }

    .tc-change-list {
      border: 1px solid #e0d5be;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
    }
    .tc-change-card {
      border-bottom: 1px solid #f0ead9;
      background: #fff;
      transition: background 0.15s ease;
    }
    .tc-change-card:last-child { border-bottom: none; }
    .tc-change-card.expanded { background: #fffdf5; }

    .tc-change-main {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; cursor: pointer;
      gap: 16px;
    }
    .tc-change-main:hover { background: #faf8f0; }

    .tc-change-info { flex: 1; min-width: 0; }
    .tc-change-elder-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 4px; flex-wrap: wrap;
    }
    .tc-elder-name {
      font-size: 15px; color: #4a5040;
    }
    .tc-status-tag {
      font-size: 11px; padding: 2px 8px;
      border-radius: 10px; font-weight: 500;
      border: 1px solid transparent;
    }
    .tc-status-tag.tc-status-today {
      background: #fde8e8; color: #c75454;
      border-color: #e8b4b4;
      animation: tc-today-pulse 2s ease-in-out infinite;
    }
    @keyframes tc-today-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(199, 84, 84, 0.3); }
      50% { box-shadow: 0 0 0 4px rgba(199, 84, 84, 0.08); }
    }
    .tc-status-tag.tc-status-upcoming {
      background: #fff4e0; color: #b38230;
      border-color: #e6cc8a;
    }
    .tc-status-tag.tc-status-expired {
      background: #f0f2ed; color: #7a8770;
      border-color: #d3d9cb;
      opacity: 0.8;
    }
    .tc-change-summary {
      font-size: 13px; color: #5a6350;
      margin-bottom: 2px;
    }
    .tc-change-reason {
      color: #8a7550; display: block;
      margin-top: 2px;
    }

    .tc-change-actions {
      display: flex; align-items: center; gap: 8px;
      flex-shrink: 0;
    }
    .cancel-tc-btn {
      background: #c75454; color: #fff;
      border: none; padding: 5px 12px;
      border-radius: 6px; cursor: pointer;
      font-size: 12px;
      transition: background 0.15s ease;
    }
    .cancel-tc-btn:hover { background: #a94444; }

    .tc-expand-arrow {
      font-size: 10px; color: #8a9481;
      transition: transform 0.2s ease;
      margin-left: 4px;
    }
    .tc-expand-arrow.rotated { transform: rotate(180deg); }

    .tc-change-detail {
      padding: 0 16px 16px;
      border-top: 1px dashed #e8e0ca;
    }
    .tc-detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .tc-detail-col h4 {
      margin: 0 0 10px 0; font-size: 13px;
      color: #6b5a3a; padding-bottom: 6px;
      border-bottom: 1px solid #f0ead9;
    }
    .tc-detail-row {
      display: flex; justify-content: space-between;
      font-size: 12px; padding: 4px 0;
    }
    .tc-detail-label { color: #8a9481; }
    .tc-detail-value { color: #4a5040; font-weight: 500; }
    .tc-detail-value.has-change {
      color: #7a8a5e; font-weight: 600;
    }

    .tc-detail-compare {
      display: flex; flex-direction: column; gap: 8px;
    }
    .tc-compare-item {
      padding: 10px; border-radius: 6px;
      font-size: 12px;
    }
    .tc-compare-item.original {
      background: #f8f7f2; border: 1px solid #e8e5da;
    }
    .tc-compare-item.new {
      background: #f5f8f0; border: 1px solid #d5e0c1;
    }
    .tc-compare-label {
      display: block; font-size: 11px;
      color: #8a9481; margin-bottom: 4px;
      font-weight: 500;
    }
    .tc-compare-item p {
      margin: 0; color: #4a5040;
      line-height: 1.5; word-break: break-all;
    }
    .tc-compare-arrow {
      text-align: center; color: #7a8a5e;
      font-size: 14px; font-weight: 600;
    }
    .tc-tag-row {
      display: flex; flex-wrap: wrap; gap: 4px;
    }

    @media (max-width: 640px) {
      .tc-manage-summary-bar { padding: 12px; gap: 8px; }
      .tc-stat-item { min-width: 58px; padding: 6px 10px; }
      .tc-stat-num { font-size: 18px; }
      .tc-filter-tabs { padding: 8px 12px; flex-wrap: wrap; }
      .tc-filter-tabs button { padding: 5px 10px; font-size: 12px; }
      .tc-manage-body { padding: 12px; }
      .tc-detail-grid { grid-template-columns: 1fr; }
      .tc-change-main { flex-direction: column; align-items: flex-start; gap: 10px; }
      .tc-change-actions { align-self: flex-end; }
    }
  `],
})
export class App implements AfterViewChecked, OnInit {
  @ViewChild('mealPrepComp') mealPrepComp!: MealPrepComponent;

  private sync = SYNC_INSTANCE();
  private syncUnsub?: () => void;

  constructor(
    private cdr: ChangeDetectorRef,
    private mealPrepService: MealPrepService,
    private volunteerDeliveryService: VolunteerDeliveryService,
  ) {
    this.load();
    this.loadKanbanSort();
    this.loadVisits();
    this.loadMealTags();
    this.loadExceptions();
    this.loadPhoneNotifications();
    this.loadCallbackTasks();
    this.loadTempChanges();
    if (this.tasks.length === 0) this.generateTasks();
  }

  ngOnInit() {
    this.initSyncSnapshots();
    this.syncUnsub = this.sync.subscribe((n) => {
      if (n.type === 'conflicts' && n.conflicts) {
        this.handleIncomingConflicts(n.conflicts);
      } else if (n.type === 'synced' && n.dataType) {
        this.refreshDataTypeFromStorage(n.dataType);
      }
    });
  }

  private initSyncSnapshots() {
    this.sync.captureLocalSnapshot('elders', this.elders);
    this.sync.captureLocalSnapshot('volunteers', this.volunteers);
    this.sync.captureLocalSnapshot('tasks', this.tasks);
    this.sync.captureLocalSnapshot('mealTags', this.mealTags);
    this.sync.captureLocalSnapshot('exceptionRecords', this.exceptionRecords);
    this.sync.captureLocalSnapshot('visitRecords', this.visitRecords);
    this.sync.captureLocalSnapshot('phoneNotifications', this.phoneNotifications);
    this.sync.captureLocalSnapshot('callbackTasks', this.callbackTasks);
    this.sync.captureLocalSnapshot('kanbanSort', this.kanbanSort);
    this.sync.captureLocalSnapshot('temporaryDeliveryChanges', this.temporaryDeliveryChanges);
  }

  private pendingConflictGroups: SyncConflictGroup[] = [];

  conflictPanelVisible = false;
  activeConflictGroups: SyncConflictGroup[] = [];
  selectedConflictGroupIndex = 0;
  selectedConflictRecordId: string | null = null;
  lastSyncMessage = '';
  lastSyncType: 'info' | 'warn' | 'error' | 'success' = 'info';
  syncToastVisible = false;
  private syncToastTimer: any;

  private showSyncToast(message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') {
    this.lastSyncMessage = message;
    this.lastSyncType = type;
    this.syncToastVisible = true;
    if (this.syncToastTimer) clearTimeout(this.syncToastTimer);
    this.syncToastTimer = setTimeout(() => {
      this.syncToastVisible = false;
    }, 3000);
  }

  private handleIncomingConflicts(groups: SyncConflictGroup[]) {
    this.activeConflictGroups = groups;
    this.selectedConflictGroupIndex = 0;
    if (groups.length > 0 && groups[0].conflicts.length > 0) {
      this.selectedConflictRecordId = groups[0].conflicts[0].recordId;
    }
    this.conflictPanelVisible = true;
    this.showSyncToast(`检测到 ${groups.reduce((s, g) => s + g.conflicts.length, 0)} 个数据冲突，请处理`, 'warn');
  }

  private refreshDataTypeFromStorage(dataType: SyncDataType) {
    switch (dataType) {
      case 'elders': this.elders = this.sync.readLocalData<Elder[]>('elders') || this.elders; this.sync.captureLocalSnapshot('elders', this.elders); break;
      case 'volunteers': this.volunteers = this.sync.readLocalData<Volunteer[]>('volunteers') || this.volunteers; this.sync.captureLocalSnapshot('volunteers', this.volunteers); break;
      case 'tasks': this.tasks = this.sync.readLocalData<MealTask[]>('tasks') || this.tasks; this.sync.captureLocalSnapshot('tasks', this.tasks); break;
      case 'mealTags': this.mealTags = this.sync.readLocalData<MealTag[]>('mealTags') || this.mealTags; this.sync.captureLocalSnapshot('mealTags', this.mealTags); break;
      case 'exceptionRecords': this.exceptionRecords = this.sync.readLocalData<ExceptionRecord[]>('exceptionRecords') || this.exceptionRecords; this.sync.captureLocalSnapshot('exceptionRecords', this.exceptionRecords); break;
      case 'visitRecords': this.visitRecords = this.sync.readLocalData<VisitRecord[]>('visitRecords') || this.visitRecords; this.sync.captureLocalSnapshot('visitRecords', this.visitRecords); break;
      case 'phoneNotifications': this.phoneNotifications = this.sync.readLocalData<PhoneNotification[]>('phoneNotifications') || this.phoneNotifications; this.sync.captureLocalSnapshot('phoneNotifications', this.phoneNotifications); break;
      case 'callbackTasks': this.callbackTasks = this.sync.readLocalData<CallbackTask[]>('callbackTasks') || this.callbackTasks; this.sync.captureLocalSnapshot('callbackTasks', this.callbackTasks); break;
      case 'kanbanSort': this.kanbanSort = this.sync.readLocalData<KanbanSortMap>('kanbanSort') || this.kanbanSort; this.sync.captureLocalSnapshot('kanbanSort', this.kanbanSort); break;
      case 'temporaryDeliveryChanges': this.temporaryDeliveryChanges = this.sync.readLocalData<TemporaryDeliveryChange[]>('temporaryDeliveryChanges') || this.temporaryDeliveryChanges; this.sync.captureLocalSnapshot('temporaryDeliveryChanges', this.temporaryDeliveryChanges); break;
    }
    this.showSyncToast('数据已同步更新', 'info');
    this.cdr.markForCheck();
  }

  viewMode: AppViewMode = 'schedule';

  private pendingKitchenPrint = false;

  elders: Elder[] = [
    { id: crypto.randomUUID(), name: '苏阿姨', preference: '少盐软饭', mealTags: ['low-salt', 'soft-food'], address: '松桂里3栋201', contact: '女儿13800001111', note: '午餐需敲门等候', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' },
    { id: crypto.randomUUID(), name: '何叔叔', preference: '糖尿病餐', mealTags: ['diabetic'], address: '松桂里5栋104', contact: '邻居王姐', note: '行动慢，放门口需电话确认', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '无糖、少碳水' },
    { id: crypto.randomUUID(), name: '林奶奶', preference: '素食', mealTags: ['vegetarian'], address: '梧桐巷12号', contact: '儿子13900002222', note: '周三加汤', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' }
  ];

  volunteers: Volunteer[] = [
    { id: crypto.randomUUID(), name: '小赵', phone: '13600003333', capacity: 4, area: '松桂里', availableDays: [1, 2, 3, 4, 5, 6, 7] },
    { id: crypto.randomUUID(), name: '陈姐', phone: '13700004444', capacity: 3, area: '梧桐巷', availableDays: [1, 2, 3, 4, 5, 6, 7] }
  ];

  tasks: MealTask[] = [];
  phoneNotifications: PhoneNotification[] = [];
  callbackTasks: CallbackTask[] = [];
  taskDate = today;
  kanbanSort: KanbanSortMap = {};
  elderForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' };
  volunteerForm: Omit<Volunteer, 'id'> = { name: '', phone: '', capacity: 3, area: '', availableDays: [1, 2, 3, 4, 5, 6, 7] };

  mealTags: MealTag[] = [...PRESET_TAGS];
  newTagName = '';
  editingTagId: string | null = null;
  editingTagName = '';

  editingElderId: string | null = null;
  elderEditForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' };

  get viewModeLabel(): string {
    switch (this.viewMode) {
      case 'schedule': return '排班前端';
      case 'meal-prep': return '备餐产能与出餐核对';
      case 'volunteer-delivery': return '志愿者配送';
      case 'closure-dashboard': return '当日闭环仪表盘';
      default: return '排班前端';
    }
  }

  visitRecords: VisitRecord[] = [];
  visitPanelVisible = false;
  visitTab: 'form' | 'history' = 'form';
  selectedElderId: string | null = null;
  selectedElderIdForVisit: string = '';
  visitForm: Omit<VisitRecord, 'id' | 'elderId' | 'createdAt'> = {
    visitDate: today,
    visitMethod: '电话',
    healthFeedback: '',
    mealFeedback: '',
    nextAttention: ''
  };

  autoAssignResult: AutoAssignResult | null = null;

  simulationMode: SimulationMode = 'off';
  simulationData: SimulationData | null = null;
  simulationStartDate = today;
  simulationEndDate = today;
  simulationViewDate = today;
  simulationPanelVisible = false;
  simulationDetailTab: 'overview' | 'load' | 'unassigned' | 'paused' | 'special' | 'route' = 'overview';
  simulationDiffVisible = false;
  simulationDiffResult: SimulationDiffResult | null = null;
  simulationDiffDate: string = '';
  simulationDiffTab: 'summary' | 'tasks' | 'volunteer' | 'route' | 'paused' | 'special' = 'summary';

  exceptionRecords: ExceptionRecord[] = [];
  exceptionPanelVisible = false;
  exceptionPanelTab: 'form' | 'list' = 'form';
  exceptionFormTaskId: string = '';
  exceptionForm: Omit<ExceptionRecord, 'id' | 'taskId' | 'elderId' | 'date' | 'createdAt' | 'updatedAt'> = {
    category: '无人应答',
    severity: '一般',
    description: '',
    handler: '',
    status: '待处理',
    result: '',
    source: '手动登记'
  };
  exceptionListFilter: ExceptionStatus | '全部' = '全部';
  exceptionListDate = '';
  exceptionListElderId = '';
  exceptionHistoryVisible = false;
  exceptionHistoryElderId = '';
  exceptionHistoryDate = '';

  phoneNotificationPanelVisible = false;
  phoneNotificationTab: 'list' | 'callback' = 'list';
  phoneNotificationFilter: '全部' | '未通知' | '已通知' | '未接通' | '稍后再拨' = '全部';
  callbackFilterStatus: '全部' | '待回拨' | '回拨中' | '已完成' | '已取消' = '全部';

  callbackFormVisible = false;
  editingCallbackId: string | null = null;
  callbackForm: Omit<CallbackTask, 'id' | 'notificationId' | 'taskId' | 'elderId' | 'date' | 'phone' | 'callbackCount' | 'createdAt' | 'updatedAt'> = {
    nextCallbackTime: '',
    handler: '',
    status: '待回拨',
    result: '',
    remark: ''
  };
  selectedNotificationForCallback: PhoneNotification | null = null;

  importExportPanelVisible = false;
  importTab: 'export' | 'import' = 'export';
  importPreview: ImportPreview | null = null;
  importError: ImportError | null = null;
  importedData: BackupData | null = null;
  importSuccess = false;

  temporaryDeliveryChanges: TemporaryDeliveryChange[] = [];
  tempChangePanelVisible = false;
  tempChangeFormElderId: string | null = null;
  tempChangeForm: Omit<TemporaryDeliveryChange, 'id' | 'elderId' | 'createdAt'> = {
    date: today,
    reason: '',
  };
  tempChangeConflictInfo: string | null = null;
  tempChangeConflictResolution: 'overwrite-task' | 'keep-both' | 'cancel' = 'keep-both';
  editingTempChangeId: string | null = null;

  tempChangeManagePanelVisible = false;
  tempChangeManageFilter: 'all' | 'today' | 'upcoming' | 'expired' = 'all';
  tempChangeManageSelectedDate: string | null = null;
  tempChangeManageExpandedId: string | null = null;

  readonly todayStr = today;

  private readonly BACKUP_VERSION = '1.0.0';

  EXCEPTION_CATEGORIES: ExceptionCategory[] = ['无人应答', '地址错误', '老人拒收', '餐食问题', '配送延误', '老人身体不适', '其他'];
  EXCEPTION_SEVERITIES: ExceptionSeverity[] = ['一般', '较重', '紧急'];
  EXCEPTION_STATUSES: ExceptionStatus[] = ['待处理', '处理中', '已解决'];

  get selectedElderForVisit(): Elder | undefined {
    return this.elders.find((e) => e.id === this.selectedElderIdForVisit);
  }

  get tempChangeFormElderName(): string {
    if (!this.tempChangeFormElderId) return '';
    return this.elders.find(e => e.id === this.tempChangeFormElderId)?.name || '';
  }

  get tempChangeFormElderAddress(): string {
    if (!this.tempChangeFormElderId) return '';
    return this.elders.find(e => e.id === this.tempChangeFormElderId)?.address || '';
  }

  setViewMode(mode: AppViewMode) {
    this.viewMode = mode;
  }

  quickOpenKitchenPrint() {
    if (this.viewMode === 'meal-prep' && this.mealPrepComp) {
      this.mealPrepComp.openPrintView();
    } else {
      this.pendingKitchenPrint = true;
      this.viewMode = 'meal-prep';
    }
  }

  ngAfterViewChecked() {
    if (this.pendingKitchenPrint && this.mealPrepComp) {
      this.pendingKitchenPrint = false;
      setTimeout(() => {
        this.mealPrepComp.openPrintView();
      }, 0);
    }
  }

  onPrepExceptionCreated(exc: PrepExceptionRecord) {
    if (this.isExceptionDuplicate(exc.taskId, '备餐缺餐', (exc as any).category || '餐食问题')) {
      this.showSyncToast('检测到重复异常记录，已忽略', 'warn');
      return;
    }
    this.exceptionRecords = [exc as any, ...this.exceptionRecords];
    this.saveExceptions();
  }

  onPrepNotificationCreated(notif: PrepPhoneNotification) {
    const n = notif as unknown as PhoneNotification;
    if (this.isNotificationDuplicate(n.taskId, n.source, n.targetId)) {
      this.showSyncToast('检测到重复电话通知，已忽略', 'warn');
      return;
    }
    const exists = this.phoneNotifications.some(pn => pn.id === n.id);
    if (!exists) {
      this.phoneNotifications = [n, ...this.phoneNotifications];
      this.savePhoneNotifications();
      if (this.shouldCreateAutoCallback(n)) {
        this.createAutoCallbackTask(n, 2);
      }
    }
  }

  onPrepTaskUpdated(data: { taskId: string; status: MealTask['status']; exception: string }) {
    this.tasks = this.tasks.map(t =>
      t.id === data.taskId ? { ...t, status: data.status, exception: data.exception || t.exception } : t
    );
    this.save();
  }

  onDeliveryStatusUpdated(data: any) {
    if (data.taskUpdated) {
      this.tasks = this.tasks.map(t =>
        t.id === data.taskUpdated.taskId ? {
          ...t,
          status: data.taskUpdated.status,
          exception: data.taskUpdated.exception || t.exception,
        } : t
      );
      this.save();
    }
    if (data.exceptionCreated) {
      const exc = data.exceptionCreated;
      if (this.isExceptionDuplicate(exc.taskId, exc.source, exc.category)) {
        this.showSyncToast('检测到重复配送异常记录，已忽略', 'warn');
      } else {
        const exists = this.exceptionRecords.some(r => r.id === exc.id);
        if (!exists) {
          this.exceptionRecords = [exc, ...this.exceptionRecords];
          this.saveExceptions();
        }
      }
    }
    if (data.notificationCreated) {
      const n = data.notificationCreated as PhoneNotification;
      if (this.isNotificationDuplicate(n.taskId, n.source, n.targetId)) {
        this.showSyncToast('检测到重复配送通知，已忽略', 'warn');
      } else {
        const exists = this.phoneNotifications.some(pn => pn.id === n.id);
        if (!exists) {
          this.phoneNotifications = [n, ...this.phoneNotifications];
          this.savePhoneNotifications();
          if (this.shouldCreateAutoCallback(n)) {
            this.createAutoCallbackTask(n, 1);
          }
        }
      }
    }
  }

  refreshDashboardData() {
    this.save();
    this.showSyncToast('数据已刷新', 'info');
  }

  onDashboardStatusChanged(result: ClosureStatusUpdateResult) {
    if (result.taskUpdated && result.taskUpdated.id) {
      const taskId = result.taskUpdated.id;
      this.tasks = this.tasks.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          ...(result.taskUpdated!.status ? { status: result.taskUpdated!.status } : {}),
          ...(result.taskUpdated!.exception !== undefined ? { exception: result.taskUpdated!.exception } : {}),
          ...(result.taskUpdated!.volunteerId !== undefined ? { volunteerId: result.taskUpdated!.volunteerId } : {}),
          ...(result.taskUpdated!.isManuallyModified !== undefined ? { isManuallyModified: result.taskUpdated!.isManuallyModified } : {}),
        };
      });
      this.save();
    }

    if (result.volunteerAssigned) {
      this.assignTask(result.volunteerAssigned.taskId, result.volunteerAssigned.volunteerId);
    }

    if (result.exceptionCreated) {
      const exc = result.exceptionCreated;
      if (!this.isExceptionDuplicate(exc.taskId, exc.source, exc.category)) {
        const exists = this.exceptionRecords.some(r => r.id === exc.id);
        if (!exists) {
          this.exceptionRecords = [exc, ...this.exceptionRecords];
          this.saveExceptions();
        }
      }
    }

    if (result.exceptionUpdated) {
      const excId = result.exceptionUpdated.id;
      const existingIdx = this.exceptionRecords.findIndex(r => r.id === excId);
      if (existingIdx !== -1) {
        if (result.exceptionUpdated.status === undefined && !result.exceptionUpdated.category) {
          this.exceptionRecords = this.exceptionRecords.filter(r => r.id !== excId);
        } else {
          this.exceptionRecords = this.exceptionRecords.map(r =>
            r.id === excId ? { ...r, ...result.exceptionUpdated! } : r
          );
        }
        this.saveExceptions();
      }
    }

    if (result.notificationCreated) {
      const n = result.notificationCreated;
      if (!this.isNotificationDuplicate(n.taskId, n.source, n.targetId)) {
        const exists = this.phoneNotifications.some(pn => pn.id === n.id);
        if (!exists) {
          this.phoneNotifications = [n, ...this.phoneNotifications];
          this.savePhoneNotifications();
          if (this.shouldCreateAutoCallback(n)) {
            this.createAutoCallbackTask(n, 2);
          }
        }
      }
    }

    if (result.notificationUpdated) {
      const nId = result.notificationUpdated.id;
      this.phoneNotifications = this.phoneNotifications.map(n =>
        n.id === nId ? { ...n, ...result.notificationUpdated! } : n
      );
      this.savePhoneNotifications();
    }

    if (result.callbackCreated) {
      const cb = result.callbackCreated;
      const exists = this.callbackTasks.some(c => c.id === cb.id);
      if (!exists) {
        this.callbackTasks = [cb, ...this.callbackTasks];
        this.saveCallbackTasks();
      }
    }

    if (result.callbackUpdated) {
      const cbId = result.callbackUpdated.id;
      const existingIdx = this.callbackTasks.findIndex(c => c.id === cbId);
      if (existingIdx !== -1) {
        if (result.callbackUpdated.status === undefined && !result.callbackUpdated.result) {
          this.callbackTasks = this.callbackTasks.filter(c => c.id !== cbId);
        } else {
          this.callbackTasks = this.callbackTasks.map(c =>
            c.id === cbId ? { ...c, ...result.callbackUpdated! } : c
          );
        }
        this.saveCallbackTasks();
      }
    }

    this.showSyncToast('状态已同步更新', 'info');
  }

  private isExceptionDuplicate(taskId: string, source: ExceptionSource, category?: ExceptionCategory): boolean {
    return this.exceptionRecords.some(r =>
      r.taskId === taskId && r.source === source && (!category || r.category === category)
    );
  }

  private isNotificationDuplicate(taskId: string, source: ExceptionSource, targetId: string): boolean {
    return this.phoneNotifications.some(n =>
      n.taskId === taskId && n.source === source && n.targetId === targetId
    );
  }

  private buildPhoneNotification(task: MealTask, elder: Elder, remark: string, source: ExceptionSource): PhoneNotification {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const effectiveElder = this.applyTempChangeToElderRef(elder, task.date);
    const match = effectiveElder.contact.match(/1[3-9]\d{9}/);
    return {
      id: crypto.randomUUID(),
      date: task.date,
      targetType: 'elder',
      targetId: elder.id,
      phone: match ? match[0] : effectiveElder.contact,
      taskId: task.id,
      notificationStatus: '未通知',
      remark,
      source,
      updatedAt: timeStr,
    };
  }

  private isCallbackDuplicate(notificationId: string, status: string): boolean {
    return this.callbackTasks.some(c =>
      c.notificationId === notificationId && c.status !== '已完成' && c.status !== '已取消'
    );
  }

  addElder() {
    if (!this.elderForm.name.trim()) return;
    this.elders = [{ id: crypto.randomUUID(), ...this.elderForm }, ...this.elders];
    this.elderForm = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' };
    this.save();
  }

  addVolunteer() {
    if (!this.volunteerForm.name.trim()) return;
    this.volunteers = [{ id: crypto.randomUUID(), ...this.volunteerForm, capacity: Number(this.volunteerForm.capacity || 1) }, ...this.volunteers];
    this.volunteerForm = { name: '', phone: '', capacity: 3, area: '', availableDays: [1, 2, 3, 4, 5, 6, 7] };
    this.save();
  }

  generateTasks() {
    const existing = new Set(this.tasks.filter((task) => task.date === this.taskDate).map((task) => task.elderId));
    const created = this.elders
      .filter((elder) => !existing.has(elder.id))
      .map((elder) => {
        const effectiveElder = this.applyTempChangeToElderRef(elder, this.taskDate);
        const tempChange = this.getTempChangeForElderDate(elder.id, this.taskDate);
        return {
          id: crypto.randomUUID(),
          elderId: elder.id,
          date: this.taskDate,
          volunteerId: tempChange?.volunteerId || '',
          status: (tempChange?.volunteerId ? '配送中' : '待分配') as '配送中' | '待分配',
          exception: '',
          isManuallyModified: !!tempChange,
          specialMealNote: effectiveElder.specialMealNote || '',
        };
      });
    this.tasks = [...created, ...this.tasks];
    this.save();
  }

  filteredTasks() {
    return this.currentScheduleTasks();
  }

  private currentScheduleDate(): string {
    return this.simulationMode === 'active' ? this.simulationViewDate : this.taskDate;
  }

  private currentScheduleTasks(): MealTask[] {
    const date = this.currentScheduleDate();
    if (this.simulationMode === 'active') {
      return this.simulationData?.tasks.filter((task) => task.date === date) || [];
    }
    return this.tasks.filter((task) => task.date === date);
  }

  private currentKanbanSort(): Record<string, string[]> {
    const date = this.currentScheduleDate();
    if (this.simulationMode === 'active') {
      if (!this.simulationData) return {};
      if (!this.simulationData.kanbanSort[date]) {
        this.simulationData.kanbanSort[date] = {};
      }
      return this.simulationData.kanbanSort[date];
    }
    if (!this.kanbanSort[date]) {
      this.kanbanSort[date] = {};
    }
    return this.kanbanSort[date];
  }

  todayTasks() {
    return this.tasks.filter((task) => task.date === today);
  }

  exceptionTasks() {
    const resolvedTaskIds = new Set(this.exceptionRecords.filter((r) => r.status === '已解决').map((r) => r.taskId));
    return this.tasks.filter((task) => task.status === '异常' && !resolvedTaskIds.has(task.id));
  }

  assignTask(id: string, volunteerId: string) {
    const task = this.currentScheduleTasks().find((t) => t.id === id);
    const oldVolunteerId = task?.volunteerId;
    if (this.simulationMode === 'active' && this.simulationData) {
      this.simulationData.tasks = this.simulationData.tasks.map((t) =>
        t.id === id ? { ...t, volunteerId, status: volunteerId ? '配送中' : '待分配' } : t
      );
    } else {
      this.tasks = this.tasks.map((t) => t.id === id ? { ...t, volunteerId, status: volunteerId ? '配送中' : '待分配' } : t);
    }
    const dateSort = this.currentKanbanSort();
    if (oldVolunteerId && dateSort[oldVolunteerId]) {
      dateSort[oldVolunteerId] = dateSort[oldVolunteerId].filter((tid) => tid !== id);
    }
    if (volunteerId) {
      if (!dateSort[volunteerId]) {
        dateSort[volunteerId] = this.filteredTasks()
          .filter((t) => t.volunteerId === volunteerId)
          .map((t) => t.id);
      } else if (!dateSort[volunteerId].includes(id)) {
        dateSort[volunteerId].push(id);
      }
    }
    if (this.simulationMode === 'active') {
      this.computeAllSimulationStats();
      return;
    }
    this.saveKanbanSort();
    this.save();
  }

  autoAssignTasks() {
    const dateTasks = this.filteredTasks();
    const date = this.currentScheduleDate();
    const unassigned = dateTasks.filter((t) => !t.volunteerId && t.status === '待分配');
    if (unassigned.length === 0) {
      this.autoAssignResult = { assigned: [], failed: [] };
      return;
    }

    const currentLoad = new Map<string, number>();
    for (const v of this.volunteers) {
      currentLoad.set(v.id, this.assignedCount(v.id));
    }

    const assigned: AutoAssignEntry[] = [];
    const failed: AutoAssignFailure[] = [];

    for (const task of unassigned) {
      const rawElder = this.elders.find((e) => e.id === task.elderId);
      if (!rawElder) {
        failed.push({ taskId: task.id, elderId: task.elderId, elderName: '未知老人', elderAddress: '', reason: '老人档案不存在' });
        continue;
      }
      const elder = this.applyTempChangeToElderRef(rawElder, date);

      const candidates = this.volunteers
        .filter((v) => {
          const load = currentLoad.get(v.id) || 0;
          if (load >= v.capacity) return false;
          if (!v.area.trim() || !elder.address.trim()) return false;
          return elder.address.includes(v.area);
        })
        .sort((a, b) => {
          const loadA = currentLoad.get(a.id) || 0;
          const loadB = currentLoad.get(b.id) || 0;
          const remainA = a.capacity - loadA;
          const remainB = b.capacity - loadB;
          if (remainA !== remainB) return remainB - remainA;
          return loadA - loadB;
        });

      if (candidates.length === 0) {
        const matchingVolunteers = this.volunteers.filter((v) => v.area.trim() && elder.address.trim() && elder.address.includes(v.area));
        let reason = '';
        if (matchingVolunteers.length > 0) {
          const fullNames = matchingVolunteers
            .filter((v) => (currentLoad.get(v.id) || 0) >= v.capacity)
            .map((v) => v.name);
          if (fullNames.length === matchingVolunteers.length) {
            reason = `片区匹配的志愿者（${fullNames.join('、')}）均已满载`;
          } else {
            reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
          }
        } else if (!this.volunteers.some((v) => v.area.trim())) {
          reason = '无志愿者配置片区信息';
        } else {
          reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
        }
        failed.push({ taskId: task.id, elderId: elder.id, elderName: elder.name, elderAddress: elder.address, reason });
        continue;
      }

      const chosen = candidates[0];
      this.tasks = this.tasks.map((t) =>
        t.id === task.id ? { ...t, volunteerId: chosen.id, status: '配送中' as const } : t
      );
      currentLoad.set(chosen.id, (currentLoad.get(chosen.id) || 0) + 1);
      assigned.push({
        taskId: task.id,
        elderId: elder.id,
        elderName: elder.name,
        elderAddress: elder.address,
        volunteerId: chosen.id,
        volunteerName: chosen.name,
      });
    }

    const dateSort = this.kanbanSort[this.taskDate];
    if (dateSort) {
      for (const entry of assigned) {
        if (!dateSort[entry.volunteerId]) {
          dateSort[entry.volunteerId] = this.filteredTasks()
            .filter((t) => t.volunteerId === entry.volunteerId)
            .map((t) => t.id);
        } else if (!dateSort[entry.volunteerId].includes(entry.taskId)) {
          dateSort[entry.volunteerId].push(entry.taskId);
        }
      }
      this.saveKanbanSort();
    }

    this.autoAssignResult = { assigned, failed };
    this.save();
  }

  private generateDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  startSimulation() {
    if (this.simulationStartDate > this.simulationEndDate) {
      this.showSyncToast('开始日期不能晚于结束日期', 'error');
      return;
    }
    const dates = this.generateDateRange(this.simulationStartDate, this.simulationEndDate);
    if (dates.length === 0) {
      this.showSyncToast('请选择有效的日期范围', 'error');
      return;
    }
    this.simulationData = {
      startDate: this.simulationStartDate,
      endDate: this.simulationEndDate,
      dates,
      tasks: [],
      kanbanSort: {},
      autoAssignResults: {},
      dayStats: {},
    };
    this.simulationViewDate = dates[0];
    this.simulationMode = 'active';
    this.generateSimulationTasks();
    this.showSyncToast(`已进入模拟模式，共 ${dates.length} 天`, 'info');
  }

  private generateSimulationTasks() {
    if (!this.simulationData) return;
    const allTasks: MealTask[] = [];
    for (const date of this.simulationData.dates) {
      const dayOfWeek = new Date(date).getDay() || 7;
      const dayElders = this.elders.filter((e) => e.deliveryDays.includes(dayOfWeek));
      const existingTaskIds = new Set(
        this.tasks.filter((t) => t.date === date).map((t) => t.elderId)
      );
      const created = dayElders
        .filter((elder) => !existingTaskIds.has(elder.id))
        .map((elder) => ({
          id: `sim-${date}-${elder.id}`,
          elderId: elder.id,
          date,
          volunteerId: '',
          status: '待分配' as const,
          exception: '',
          isManuallyModified: false,
          specialMealNote: elder.specialMealNote || '',
        }));
      const existingTasks = this.tasks
        .filter((t) => t.date === date)
        .map((t) => ({ ...t, id: `sim-${t.id}` }));
      allTasks.push(...existingTasks, ...created);
    }
    this.simulationData.tasks = allTasks;
    this.computeAllSimulationStats();
  }

  autoAssignSimulationTasks() {
    if (!this.simulationData) return;
    for (const date of this.simulationData.dates) {
      this.autoAssignSimulationForDate(date);
    }
    this.computeAllSimulationStats();
    this.showSyncToast('模拟自动分配完成', 'info');
  }

  private autoAssignSimulationForDate(date: string) {
    if (!this.simulationData) return;
    const dateTasks = this.simulationData.tasks.filter((t) => t.date === date);
    const unassigned = dateTasks.filter((t) => !t.volunteerId && t.status === '待分配');
    if (unassigned.length === 0) {
      this.simulationData.autoAssignResults[date] = { assigned: [], failed: [] };
      return;
    }
    const currentLoad = new Map<string, number>();
    for (const v of this.volunteers) {
      const assigned = dateTasks.filter((t) => t.volunteerId === v.id).length;
      currentLoad.set(v.id, assigned);
    }
    const assigned: AutoAssignEntry[] = [];
    const failed: AutoAssignFailure[] = [];
    for (const task of unassigned) {
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (!elder) {
        failed.push({ taskId: task.id, elderId: task.elderId, elderName: '未知老人', elderAddress: '', reason: '老人档案不存在' });
        continue;
      }
      const isPaused = elder.pauseDates?.includes(date);
      if (isPaused) {
        failed.push({ taskId: task.id, elderId: elder.id, elderName: elder.name, elderAddress: elder.address, reason: '当日暂停送餐' });
        continue;
      }
      const candidates = this.volunteers
        .filter((v) => {
          const load = currentLoad.get(v.id) || 0;
          if (load >= v.capacity) return false;
          if (!v.area.trim() || !elder.address.trim()) return false;
          return elder.address.includes(v.area);
        })
        .sort((a, b) => {
          const loadA = currentLoad.get(a.id) || 0;
          const loadB = currentLoad.get(b.id) || 0;
          const remainA = a.capacity - loadA;
          const remainB = b.capacity - loadB;
          if (remainA !== remainB) return remainB - remainA;
          return loadA - loadB;
        });
      if (candidates.length === 0) {
        const matchingVolunteers = this.volunteers.filter((v) => v.area.trim() && elder.address.trim() && elder.address.includes(v.area));
        let reason = '';
        if (matchingVolunteers.length > 0) {
          const fullNames = matchingVolunteers
            .filter((v) => (currentLoad.get(v.id) || 0) >= v.capacity)
            .map((v) => v.name);
          if (fullNames.length === matchingVolunteers.length) {
            reason = `片区匹配的志愿者（${fullNames.join('、')}）均已满载`;
          } else {
            reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
          }
        } else if (!this.volunteers.some((v) => v.area.trim())) {
          reason = '无志愿者配置片区信息';
        } else {
          reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
        }
        failed.push({ taskId: task.id, elderId: elder.id, elderName: elder.name, elderAddress: elder.address, reason });
        continue;
      }
      const chosen = candidates[0];
      this.simulationData.tasks = this.simulationData.tasks.map((t) =>
        t.id === task.id ? { ...t, volunteerId: chosen.id, status: '配送中' as const } : t
      );
      currentLoad.set(chosen.id, (currentLoad.get(chosen.id) || 0) + 1);
      assigned.push({
        taskId: task.id,
        elderId: elder.id,
        elderName: elder.name,
        elderAddress: elder.address,
        volunteerId: chosen.id,
        volunteerName: chosen.name,
      });
    }
    if (!this.simulationData.kanbanSort[date]) {
      this.simulationData.kanbanSort[date] = {};
    }
    const dateSort = this.simulationData.kanbanSort[date];
    for (const entry of assigned) {
      if (!dateSort[entry.volunteerId]) {
        dateSort[entry.volunteerId] = this.simulationData.tasks
          .filter((t) => t.date === date && t.volunteerId === entry.volunteerId)
          .map((t) => t.id);
      } else if (!dateSort[entry.volunteerId].includes(entry.taskId)) {
        dateSort[entry.volunteerId].push(entry.taskId);
      }
    }
    this.simulationData.autoAssignResults[date] = { assigned, failed };
  }

  private computeAllSimulationStats() {
    if (!this.simulationData) return;
    for (const date of this.simulationData.dates) {
      this.simulationData.dayStats[date] = this.computeDaySimulationStats(date);
    }
  }

  private computeDaySimulationStats(date: string): DaySimulationStats {
    if (!this.simulationData) {
      return {
        date,
        totalTasks: 0,
        assignedCount: 0,
        unassignedCount: 0,
        pausedCount: 0,
        specialMealCount: 0,
        volunteerLoad: [],
        unassignedReasons: [],
        routeOrder: [],
        tagBreakdown: [],
        pausedElders: [],
      };
    }
    const dateTasks = this.simulationData.tasks.filter((t) => t.date === date);
    const elderMap = new Map(this.elders.map((e) => [e.id, e]));
    const tagMap = new Map(this.mealTags.map((t) => [t.id, t]));
    const pausedEldersList: Array<{ elderId: string; elderName: string; address: string; contact: string }> = [];
    let pausedCount = 0;
    let specialMealCount = 0;
    const tagCounts = new Map<string, number>();
    for (const task of dateTasks) {
      const rawElder = elderMap.get(task.elderId);
      if (!rawElder) continue;
      const elder = this.applyTempChangeToElderRef(rawElder, date);
      const isPaused = elder.pauseDates?.includes(date);
      if (isPaused) {
        pausedCount++;
        pausedEldersList.push({
          elderId: elder.id,
          elderName: elder.name,
          address: elder.address,
          contact: elder.contact,
        });
      }
      if (task.specialMealNote || elder.specialMealNote) {
        specialMealCount++;
      }
      for (const tagId of elder.mealTags || []) {
        tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
      }
    }
    const tagBreakdown: Array<{ tagId: string; tagName: string; count: number; color: string }> = [];
    for (const [tagId, count] of tagCounts.entries()) {
      const tag = tagMap.get(tagId);
      if (tag) {
        tagBreakdown.push({ tagId, tagName: tag.name, count, color: tag.color });
      }
    }
    tagBreakdown.sort((a, b) => b.count - a.count);
    const volunteerLoad: Array<{
      volunteerId: string;
      volunteerName: string;
      assigned: number;
      capacity: number;
      area: string;
    }> = this.volunteers.map((v) => ({
      volunteerId: v.id,
      volunteerName: v.name,
      assigned: dateTasks.filter((t) => t.volunteerId === v.id).length,
      capacity: v.capacity,
      area: v.area,
    }));
    const autoAssignResult = this.simulationData.autoAssignResults[date];
    const unassignedReasons = autoAssignResult?.failed || [];
    const dateSort = this.simulationData.kanbanSort[date] || {};
    const routeOrder: KanbanGroup[] = this.volunteers.map((volunteer) => {
      let vTasks = dateTasks.filter((t) => t.volunteerId === volunteer.id);
      const order = dateSort[volunteer.id];
      if (order && order.length) {
        const orderIndex = new Map(order.map((id, i) => [id, i]));
        vTasks = [...vTasks].sort((a, b) => {
          const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : order.length;
          const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : order.length;
          return ai - bi;
        });
      }
      return { volunteer, tasks: vTasks };
    });
    const assignedCount = dateTasks.filter((t) => t.volunteerId).length;
    const unassignedCount = dateTasks.filter((t) => !t.volunteerId).length - pausedCount;
    return {
      date,
      totalTasks: dateTasks.length,
      assignedCount,
      unassignedCount: Math.max(0, unassignedCount),
      pausedCount,
      specialMealCount,
      volunteerLoad,
      unassignedReasons,
      routeOrder,
      tagBreakdown,
      pausedElders: pausedEldersList,
    };
  }

  getSimulationDayStats(date: string): DaySimulationStats | null {
    return this.simulationData?.dayStats?.[date] || null;
  }

  getCurrentSimulationStats(): DaySimulationStats | null {
    return this.getSimulationDayStats(this.simulationViewDate);
  }

  computeSimulationDiff(): SimulationDiffResult | null {
    if (!this.simulationData) return null;
    const dayDiffs: Record<string, DaySimulationDiff> = {};
    let totalAdded = 0;
    let totalRemoved = 0;
    let totalVolunteerChanges = 0;
    let totalRouteChanges = 0;
    let totalPauseChanges = 0;
    let totalSpecialMealChanges = 0;
    let totalPausedNew = 0;
    let totalPausedResumed = 0;
    const datesWithChanges: string[] = [];

    for (const date of this.simulationData.dates) {
      const simTasks = this.simulationData.tasks.filter((t) => t.date === date);
      const realTasks = this.tasks.filter((t) => t.date === date);
      const simTaskMap = new Map(simTasks.map((t) => [t.elderId, t]));
      const realTaskMap = new Map(realTasks.map((t) => [t.elderId, t]));
      const elderMap = new Map(this.elders.map((e) => [e.id, e]));
      const volunteerMap = new Map(this.volunteers.map((v) => [v.id, v]));

      const addedTasks: SimDiffAddedTask[] = [];
      const removedTasks: SimDiffRemovedTask[] = [];
      const volunteerChanges: SimDiffVolunteerChange[] = [];
      const pausedChanges: SimDiffPausedItem[] = [];
      const specialMealChanges: SimDiffSpecialMealItem[] = [];

      const allElderIds = new Set([...simTaskMap.keys(), ...realTaskMap.keys()]);

      for (const elderId of allElderIds) {
        const simTask = simTaskMap.get(elderId);
        const realTask = realTaskMap.get(elderId);
        const elder = elderMap.get(elderId);
        const elderName = elder?.name || '未知老人';
        const elderAddress = elder?.address || '';
        const simVolId = simTask?.volunteerId;
        const realVolId = realTask?.volunteerId;
        const simVolName = simVolId ? volunteerMap.get(simVolId)?.name : undefined;
        const realVolName = realVolId ? volunteerMap.get(realVolId)?.name : undefined;
        const isPausedNow = elder?.pauseDates?.includes(date) || false;

        const simSort = this.simulationData.kanbanSort[date]?.[simVolId || ''] || [];
        const realSort = this.kanbanSort[date]?.[realVolId || ''] || [];
        const simRouteOrder = simVolId && simTask ? simSort.indexOf(simTask.id) + 1 : undefined;
        const realRouteOrder = realVolId && realTask ? realSort.indexOf(realTask.id) + 1 : undefined;

        const simSpecialNote = simTask?.specialMealNote || elder?.specialMealNote || '';
        const realSpecialNote = realTask?.specialMealNote || elder?.specialMealNote || '';

        const wasPaused = elder?.pauseDates?.includes(date) || false;
        if (!realTask && simTask) {
          let addReason: SimDiffAddedTask['addReason'];
          if (wasPaused && !isPausedNow) {
            addReason = 'resumed-from-pause';
          } else {
            const elderHasAnyRealTask = this.tasks.some(t => t.elderId === elderId);
            if (!elderHasAnyRealTask) {
              addReason = 'new-elder';
            } else {
              addReason = 'delivery-day-added';
            }
          }
          addedTasks.push({
            changeType: 'added',
            taskId: simTask.id,
            elderId,
            elderName,
            elderAddress,
            volunteerId: simVolId,
            volunteerName: simVolName,
            routeOrder: simRouteOrder,
            specialMealNote: simSpecialNote || undefined,
            isPaused: isPausedNow,
            addReason,
          });
        } else if (realTask && !simTask) {
          let removeReason: SimDiffRemovedTask['removeReason'];
          if (!wasPaused && isPausedNow) {
            removeReason = 'paused';
          } else {
            const elderStillExists = elderMap.has(elderId);
            if (!elderStillExists) {
              removeReason = 'elder-removed';
            } else {
              removeReason = 'delivery-day-removed';
            }
          }
          removedTasks.push({
            changeType: 'removed',
            taskId: realTask.id,
            elderId,
            elderName,
            elderAddress,
            volunteerId: realVolId,
            volunteerName: realVolName,
            routeOrder: realRouteOrder,
            specialMealNote: realSpecialNote || undefined,
            isPaused: isPausedNow,
            removeReason,
          });
        } else if (realTask && simTask) {
          if (simVolId !== realVolId) {
            volunteerChanges.push({
              changeType: 'volunteer',
              taskId: simTask.id,
              elderId,
              elderName,
              elderAddress,
              oldVolunteerId: realVolId || undefined,
              oldVolunteerName: realVolName,
              newVolunteerId: simVolId || undefined,
              newVolunteerName: simVolName,
              routeOrder: simRouteOrder,
            });
          }
        }

        if (elder) {
          let pauseChangeType: SimDiffPausedItem['changeType'] = 'pause-unchanged';
          let pauseChangeSource: SimDiffPausedItem['changeSource'];
          let pauseChangeDetail = '';
          const realTaskForElder = realTaskMap.get(elderId);
          const simTaskForElder = simTaskMap.get(elderId);
          const wasInReal = !!realTaskForElder && !wasPaused;
          const isInSim = !!simTaskForElder && !isPausedNow;

          if (!wasPaused && isPausedNow) {
            pauseChangeType = 'pause-new';
            totalPauseChanges++;
            totalPausedNew++;
            if (elder.pauseDates?.includes(date)) {
              pauseChangeSource = 'elder-pause-date';
              pauseChangeDetail = `老人基础信息中新增暂停日期：${date}`;
            } else {
              pauseChangeSource = 'simulation-algorithm';
              pauseChangeDetail = '模拟排班算法判定该老人当日暂停送餐';
            }
          } else if (wasPaused && !isPausedNow) {
            pauseChangeType = 'pause-resume';
            totalPauseChanges++;
            totalPausedResumed++;
            if (!elder.pauseDates?.includes(date)) {
              pauseChangeSource = 'elder-pause-date';
              pauseChangeDetail = `老人基础信息中移除暂停日期：${date}`;
            } else {
              pauseChangeSource = 'simulation-algorithm';
              pauseChangeDetail = '模拟排班算法判定该老人当日恢复送餐';
            }
          }

          if (pauseChangeType !== 'pause-unchanged' || wasPaused || isPausedNow) {
            pausedChanges.push({
              elderId,
              elderName: elder.name,
              address: elder.address,
              contact: elder.contact,
              wasPaused,
              isPaused: isPausedNow,
              changeType: pauseChangeType,
              changeSource: pauseChangeSource,
              changeDetail: pauseChangeDetail,
            });
          }
        }

        if (simSpecialNote !== realSpecialNote) {
          let specialChangeType: SimDiffSpecialMealItem['changeType'] = 'special-unchanged';
          let specialChangeSource: SimDiffSpecialMealItem['changeSource'];
          let specialChangeDetail = '';
          let oldSource: SimDiffSpecialMealItem['oldSource'];
          let newSource: SimDiffSpecialMealItem['newSource'];
          let relatedTempChangeId: string | undefined;
          let relatedTempChangeReason: string | undefined;

          const realTempChange = this.temporaryDeliveryChanges.find(c => c.elderId === elderId && c.date === date);
          if (realTempChange?.specialMealNote !== undefined) {
            oldSource = 'temp-change';
            relatedTempChangeId = realTempChange.id;
            relatedTempChangeReason = realTempChange.reason;
          } else if (realTask?.specialMealNote) {
            oldSource = 'task-override';
          } else if (elder?.specialMealNote) {
            oldSource = 'elder-basic';
          }

          const simTaskInSim = simTask;
          const elderInSim = elder;
          if (realTempChange?.specialMealNote !== undefined) {
            newSource = 'temp-change';
          } else if (simTaskInSim?.specialMealNote) {
            newSource = 'task-override';
          } else if (elderInSim?.specialMealNote) {
            newSource = 'elder-basic';
          }

          if (!realSpecialNote && simSpecialNote) {
            specialChangeType = 'special-new';
          } else if (realSpecialNote && !simSpecialNote) {
            specialChangeType = 'special-removed';
          } else if (realSpecialNote && simSpecialNote) {
            specialChangeType = 'special-changed';
          }

          if (oldSource && newSource && oldSource !== newSource) {
            specialChangeSource = newSource;
            const sourceMap: Record<string, string> = {
              'elder-basic': '老人基础信息',
              'task-override': '任务单独备注',
              'temp-change': '临时送餐变更'
            };
            specialChangeDetail = `备注来源变更：${sourceMap[oldSource]} → ${sourceMap[newSource]}`;
          } else if (oldSource === newSource && oldSource) {
            specialChangeSource = oldSource;
            const sourceMap: Record<string, string> = {
              'elder-basic': '老人基础信息',
              'task-override': '任务单独备注',
              'temp-change': '临时送餐变更'
            };
            specialChangeDetail = `备注内容变更（来源：${sourceMap[oldSource]}）`;
          }

          if (specialChangeType !== 'special-unchanged') {
            totalSpecialMealChanges++;
            specialMealChanges.push({
              taskId: simTask?.id || realTask?.id || '',
              elderId,
              elderName,
              oldNote: realSpecialNote || undefined,
              newNote: simSpecialNote || undefined,
              changeType: specialChangeType,
              changeSource: specialChangeSource,
              changeDetail: specialChangeDetail,
              oldSource,
              newSource,
              relatedTempChangeId,
              relatedTempChangeReason,
            });
          }
        }
      }

      const routeChanges: SimDiffRouteChange[] = [];
      for (const volunteer of this.volunteers) {
        const simDateSort = this.simulationData.kanbanSort[date]?.[volunteer.id] || [];
        const realDateSort = this.kanbanSort[date]?.[volunteer.id] || [];
        const simVolTasks = simTasks
          .filter((t) => t.volunteerId === volunteer.id)
          .map((t, i) => {
            const idx = simDateSort.indexOf(t.id);
            const pos = idx >= 0 ? idx + 1 : simDateSort.length + i + 1;
            return { taskId: t.id, elderId: t.elderId, elderName: elderMap.get(t.elderId)?.name || '', position: pos };
          })
          .sort((a, b) => a.position - b.position);
        const realVolTasks = realTasks
          .filter((t) => t.volunteerId === volunteer.id)
          .map((t, i) => {
            const idx = realDateSort.indexOf(t.id);
            const pos = idx >= 0 ? idx + 1 : realDateSort.length + i + 1;
            return { taskId: t.id, elderId: t.elderId, elderName: elderMap.get(t.elderId)?.name || '', position: pos };
          })
          .sort((a, b) => a.position - b.position);
        const oldOrderMap = new Map(realVolTasks.map((o) => [o.elderId, o.position]));
        const newOrderMap = new Map(simVolTasks.map((n) => [n.elderId, n.position]));
        const movedTasks: SimDiffRouteChange['movedTasks'] = [];
        const allElderForRoute = new Set([...oldOrderMap.keys(), ...newOrderMap.keys()]);
        for (const eid of allElderForRoute) {
          const oldPos = oldOrderMap.get(eid);
          const newPos = newOrderMap.get(eid);
          if (oldPos !== undefined && newPos !== undefined && oldPos !== newPos) {
            const t = simVolTasks.find((x) => x.elderId === eid) || realVolTasks.find((x) => x.elderId === eid);
            if (t) {
              movedTasks.push({ taskId: t.taskId, elderId: eid, elderName: t.elderName, oldPos, newPos });
            }
          }
        }
        const simIds = new Set(simVolTasks.map((t) => t.taskId));
        const realIds = new Set(realVolTasks.map((t) => t.taskId));
        const hasCompositionChange = simIds.size !== realIds.size || [...simIds].some((id) => !realIds.has(id));
        const addedElderIds = [...simIds].filter(id => !realIds.has(id));
        const removedElderIds = [...realIds].filter(id => !simIds.has(id));
        const addedElders = addedElderIds.map(id => {
          const t = simVolTasks.find(x => x.taskId === id);
          return { elderId: t?.elderId || '', elderName: t?.elderName || '' };
        }).filter(x => x.elderId);
        const removedElders = removedElderIds.map(id => {
          const t = realVolTasks.find(x => x.taskId === id);
          return { elderId: t?.elderId || '', elderName: t?.elderName || '' };
        }).filter(x => x.elderId);
        if (movedTasks.length > 0 || hasCompositionChange) {
          totalRouteChanges++;
          routeChanges.push({
            changeType: 'route',
            volunteerId: volunteer.id,
            volunteerName: volunteer.name,
            oldOrder: realVolTasks,
            newOrder: simVolTasks,
            movedTasks,
            compositionChanged: hasCompositionChange,
            addedElders,
            removedElders,
          });
        }
      }

      const beforeTotal = realTasks.length;
      const afterTotal = simTasks.length;
      const beforeAssigned = realTasks.filter((t) => t.volunteerId).length;
      const afterAssigned = simTasks.filter((t) => t.volunteerId).length;
      const hasChanges = addedTasks.length > 0 || removedTasks.length > 0 || volunteerChanges.length > 0 || routeChanges.length > 0 || pausedChanges.some((p) => p.changeType !== 'pause-unchanged') || specialMealChanges.length > 0;
      totalAdded += addedTasks.length;
      totalRemoved += removedTasks.length;
      totalVolunteerChanges += volunteerChanges.length;
      if (hasChanges) datesWithChanges.push(date);

      const newPausedAffected = pausedChanges.filter(p => p.changeType === 'pause-new').length;
      const resumedAffected = pausedChanges.filter(p => p.changeType === 'pause-resume').length;
      const totalPausedIncluded = pausedChanges.length;

      dayDiffs[date] = {
        date,
        totalTasks: { before: beforeTotal, after: afterTotal, diff: afterTotal - beforeTotal },
        assignedTasks: { before: beforeAssigned, after: afterAssigned, diff: afterAssigned - beforeAssigned },
        addedTasks,
        removedTasks,
        volunteerChanges,
        routeChanges,
        pausedChanges,
        specialMealChanges,
        hasChanges,
        pauseEffectiveCount: {
          newPausedAffected,
          resumedAffected,
          totalPausedIncluded,
        },
      };
    }

    return {
      dayDiffs,
      summary: {
        totalAdded,
        totalRemoved,
        totalVolunteerChanges,
        totalRouteChanges,
        totalPauseChanges,
        totalSpecialMealChanges,
        datesWithChanges,
        totalPausedNew,
        totalPausedResumed,
      },
    };
  }

  openSimulationDiffPreview() {
    this.simulationDiffResult = this.computeSimulationDiff();
    if (this.simulationDiffResult && this.simulationData) {
      this.simulationDiffDate = this.simulationDiffResult.summary.datesWithChanges[0] || this.simulationData.dates[0];
      this.simulationDiffTab = 'summary';
      this.simulationDiffVisible = true;
    }
  }

  closeSimulationDiffPreview() {
    this.simulationDiffVisible = false;
  }

  locateElderInDiff(elderId: string) {
    this.selectedElderId = elderId;
    if (this.simulationDiffDate && this.simulationData) {
      this.simulationViewDate = this.simulationDiffDate;
      this.taskDate = this.simulationDiffDate;
    }
    this.closeSimulationDiffPreview();
    const elder = this.elders.find((e) => e.id === elderId);
    if (elder) {
      this.showSyncToast(`已定位到老人：${elder.name}（${this.simulationDiffDate || '当前日期'}）`, 'info');
    }
  }

  locateVolunteerInDiff(volunteerId: string) {
    const volunteer = this.volunteers.find((v) => v.id === volunteerId);
    if (volunteer && this.simulationData) {
      if (this.simulationDiffDate) {
        this.simulationViewDate = this.simulationDiffDate;
        this.taskDate = this.simulationDiffDate;
      }
      this.closeSimulationDiffPreview();
      this.simulationPanelVisible = true;
      this.simulationDetailTab = 'route';
      this.showSyncToast(`已定位到志愿者：${volunteer.name}，请查看路线顺序页签（${this.simulationViewDate || '当前日期'}）`, 'info');
    }
  }

  getCurrentDiffDay(): DaySimulationDiff | null {
    if (!this.simulationDiffResult || !this.simulationDiffDate) return null;
    return this.simulationDiffResult.dayDiffs[this.simulationDiffDate] || null;
  }

  getDiffDayForDate(date: string): DaySimulationDiff | null {
    if (!this.simulationDiffResult) return null;
    return this.simulationDiffResult.dayDiffs[date] || null;
  }

  getDiffDayHasChanges(date: string): boolean {
    const day = this.getDiffDayForDate(date);
    return day?.hasChanges || false;
  }

  getDiffDayBadgeCount(date: string): number {
    const day = this.getDiffDayForDate(date);
    if (!day) return 0;
    return day.addedTasks.length + day.removedTasks.length + day.volunteerChanges.length + day.routeChanges.length + day.specialMealChanges.length;
  }

  getDiffDayTotalBefore(date: string): number {
    return this.getDiffDayForDate(date)?.totalTasks?.before || 0;
  }

  getDiffDayTotalAfter(date: string): number {
    return this.getDiffDayForDate(date)?.totalTasks?.after || 0;
  }

  getDiffDayAddedCount(date: string): number {
    return this.getDiffDayForDate(date)?.addedTasks?.length || 0;
  }

  getDiffDayRemovedCount(date: string): number {
    return this.getDiffDayForDate(date)?.removedTasks?.length || 0;
  }

  getDiffDayVolunteerCount(date: string): number {
    return this.getDiffDayForDate(date)?.volunteerChanges?.length || 0;
  }

  getDiffDayRouteCount(date: string): number {
    return this.getDiffDayForDate(date)?.routeChanges?.length || 0;
  }

  getDiffDaySpecialCount(date: string): number | string {
    const day = this.getDiffDayForDate(date);
    if (!day) return '-';
    const count = day.specialMealChanges.length;
    return count > 0 ? count : '-';
  }

  getDiffDayNewPausedCount(date: string): number {
    return this.getDiffDayForDate(date)?.pauseEffectiveCount?.newPausedAffected || 0;
  }

  getDiffDayResumedCount(date: string): number {
    return this.getDiffDayForDate(date)?.pauseEffectiveCount?.resumedAffected || 0;
  }

  getPauseChangeSourceText(source?: string): string {
    const map: Record<string, string> = {
      'elder-pause-date': '📋 老人基础信息',
      'simulation-algorithm': '🤖 模拟算法',
      'temp-change': '📝 临时变更'
    };
    return source ? map[source] || source : '';
  }

  getSpecialChangeSourceText(source?: string): string {
    const map: Record<string, string> = {
      'elder-basic': '📋 老人基础信息',
      'task-override': '✏️ 任务单独备注',
      'temp-change': '📝 临时送餐变更',
      'simulation-algorithm': '🤖 模拟算法'
    };
    return source ? map[source] || source : '';
  }

  getCurrentDiffDayAddedCount(): number {
    return this.getCurrentDiffDay()?.addedTasks?.length || 0;
  }

  getCurrentDiffDayRemovedCount(): number {
    return this.getCurrentDiffDay()?.removedTasks?.length || 0;
  }

  getCurrentDiffDayVolunteerCount(): number {
    return this.getCurrentDiffDay()?.volunteerChanges?.length || 0;
  }

  getCurrentDiffDayRouteCount(): number {
    return this.getCurrentDiffDay()?.routeChanges?.length || 0;
  }

  getCurrentDiffDayPausedCount(): number {
    return this.getCurrentDiffDay()?.pausedChanges?.length || 0;
  }

  getCurrentDiffDaySpecialCount(): number {
    return this.getCurrentDiffDay()?.specialMealChanges?.length || 0;
  }

  getSummaryDatesWithChangesCount(): number {
    return this.simulationDiffResult?.summary?.datesWithChanges?.length || 0;
  }

  getSummaryTotalAdded(): number {
    return this.simulationDiffResult?.summary?.totalAdded || 0;
  }

  getSummaryTotalRemoved(): number {
    return this.simulationDiffResult?.summary?.totalRemoved || 0;
  }

  getSummaryTotalVolunteerChanges(): number {
    return this.simulationDiffResult?.summary?.totalVolunteerChanges || 0;
  }

  getSummaryTotalRouteChanges(): number {
    return this.simulationDiffResult?.summary?.totalRouteChanges || 0;
  }

  getSummaryTotalPauseChanges(): number {
    return this.simulationDiffResult?.summary?.totalPauseChanges || 0;
  }

  getSummaryTotalSpecialMealChanges(): number {
    return this.simulationDiffResult?.summary?.totalSpecialMealChanges || 0;
  }

  getSummaryTotalPausedNew(): number {
    return this.simulationDiffResult?.summary?.totalPausedNew || 0;
  }

  getSummaryTotalPausedResumed(): number {
    return this.simulationDiffResult?.summary?.totalPausedResumed || 0;
  }

  getMovedTaskByElder(
    movedTasks: Array<{ taskId: string; elderId: string; elderName: string; oldPos: number; newPos: number }>,
    elderId: string
  ): { oldPos: number; newPos: number } | null {
    const found = movedTasks.find((m) => m.elderId === elderId);
    return found ? { oldPos: found.oldPos, newPos: found.newPos } : null;
  }

  getTaskChangeVolunteerText(
    oldVol: string | undefined,
    newVol: string | undefined
  ): string {
    return `${oldVol || '未分配'} → ${newVol || '未分配'}`;
  }

  hasMovedTask(
    movedTasks: Array<{ taskId: string; elderId: string; elderName: string; oldPos: number; newPos: number }>,
    elderId: string
  ): boolean {
    return movedTasks.some((m) => m.elderId === elderId);
  }

  getCurrentDiffDayAddedTasks(): SimDiffAddedTask[] {
    return this.getCurrentDiffDay()?.addedTasks || [];
  }

  getCurrentDiffDayRemovedTasks(): SimDiffRemovedTask[] {
    return this.getCurrentDiffDay()?.removedTasks || [];
  }

  getCurrentDiffDayVolunteerChanges(): SimDiffVolunteerChange[] {
    return this.getCurrentDiffDay()?.volunteerChanges || [];
  }

  getCurrentDiffDayRouteChanges(): SimDiffRouteChange[] {
    return this.getCurrentDiffDay()?.routeChanges || [];
  }

  getCurrentDiffDayPausedChanges(): SimDiffPausedItem[] {
    return this.getCurrentDiffDay()?.pausedChanges || [];
  }

  getCurrentDiffDaySpecialChanges(): SimDiffSpecialMealItem[] {
    return this.getCurrentDiffDay()?.specialMealChanges || [];
  }

  getCurrentDiffDayTotalBefore(): number {
    return this.getCurrentDiffDay()?.totalTasks?.before || 0;
  }

  getCurrentDiffDayTotalAfter(): number {
    return this.getCurrentDiffDay()?.totalTasks?.after || 0;
  }

  getCurrentDiffDayTotalDiff(): number {
    return this.getCurrentDiffDay()?.totalTasks?.diff || 0;
  }

  getCurrentDiffDayAssignedBefore(): number {
    return this.getCurrentDiffDay()?.assignedTasks?.before || 0;
  }

  getCurrentDiffDayAssignedAfter(): number {
    return this.getCurrentDiffDay()?.assignedTasks?.after || 0;
  }

  getCurrentDiffDayAssignedDiff(): number {
    return this.getCurrentDiffDay()?.assignedTasks?.diff || 0;
  }

  submitSimulation() {
    if (!this.simulationData) return;
    this.openSimulationDiffPreview();
  }

  confirmSubmitSimulation() {
    if (!this.simulationData) return;
    const newTasks: MealTask[] = [];
    const existingTaskMap = new Map(this.tasks.map((t) => [`${t.date}-${t.elderId}`, t]));
    const submittedTasks: MealTask[] = [];
    const updatedExistingTaskIds = new Set<string>();
    const volunteerChangedTaskIdsByDate: Record<string, string[]> = {};
    const removedTaskIdsByDate: Record<string, string[]> = {};
    const allRemovedTaskIds = new Set<string>();
    const allAddedTaskIds = new Set<string>();
    let countAdded = 0;
    let countUpdated = 0;
    let countRemoved = 0;

    for (const simTask of this.simulationData.tasks) {
      const key = `${simTask.date}-${simTask.elderId}`;
      const existing = existingTaskMap.get(key);
      if (existing) {
        const oldVolunteerId = existing.volunteerId;
        existing.volunteerId = simTask.volunteerId;
        existing.status = simTask.volunteerId ? '配送中' : '待分配';
        existing.isManuallyModified = true;
        existing.specialMealNote = simTask.specialMealNote || existing.specialMealNote;
        submittedTasks.push(existing);
        updatedExistingTaskIds.add(existing.id);
        countUpdated++;
        if (oldVolunteerId !== simTask.volunteerId) {
          if (!volunteerChangedTaskIdsByDate[simTask.date]) {
            volunteerChangedTaskIdsByDate[simTask.date] = [];
          }
          volunteerChangedTaskIdsByDate[simTask.date].push(existing.id);
        }
      } else {
        const realTask: MealTask = {
          id: crypto.randomUUID(),
          elderId: simTask.elderId,
          date: simTask.date,
          volunteerId: simTask.volunteerId,
          status: simTask.volunteerId ? '配送中' : '待分配',
          exception: '',
          isManuallyModified: false,
          specialMealNote: simTask.specialMealNote,
        };
        newTasks.push(realTask);
        submittedTasks.push(realTask);
        allAddedTaskIds.add(realTask.id);
        countAdded++;
      }
    }

    for (const date of this.simulationData.dates) {
      const simElderIds = new Set(
        this.simulationData.tasks.filter(t => t.date === date).map(t => t.elderId)
      );
      const realDateTasks = this.tasks.filter(t => t.date === date);
      for (const rt of realDateTasks) {
        if (!simElderIds.has(rt.elderId)) {
          if (!removedTaskIdsByDate[date]) {
            removedTaskIdsByDate[date] = [];
          }
          removedTaskIdsByDate[date].push(rt.id);
          allRemovedTaskIds.add(rt.id);
          countRemoved++;
        }
      }
    }

    const rebuiltTasks: MealTask[] = this.tasks
      .filter(t => !allRemovedTaskIds.has(t.id))
      .map(t => updatedExistingTaskIds.has(t.id) ? { ...t } : t);
    this.tasks = [...rebuiltTasks, ...newTasks];

    for (const date of this.simulationData.dates) {
      if (!this.kanbanSort[date]) {
        this.kanbanSort[date] = {};
      }
      const simDateSort = this.simulationData.kanbanSort[date];
      const finalDateTaskIds = new Set(
        this.tasks.filter(t => t.date === date).map(t => t.id)
      );
      if (simDateSort) {
        for (const volId of Object.keys(simDateSort)) {
          const realIds = simDateSort[volId].map((simId) => {
            const simTask = this.simulationData!.tasks.find((t) => t.id === simId);
            if (!simTask) return simId;
            const key = `${simTask.date}-${simTask.elderId}`;
            const existing = existingTaskMap.get(key);
            return existing?.id || this.tasks.find((t) => t.date === simTask.date && t.elderId === simTask.elderId)?.id || simId;
          }).filter((id) => id && finalDateTaskIds.has(id));
          this.kanbanSort[date][volId] = realIds;
        }
      }
      for (const volId of Object.keys(this.kanbanSort[date])) {
        this.kanbanSort[date][volId] = this.kanbanSort[date][volId].filter(id => finalDateTaskIds.has(id));
      }
      const volIdsOnDate = new Set([
        ...Object.keys(this.kanbanSort[date] || {}),
        ...Object.keys(this.simulationData.kanbanSort[date] || {}),
      ]);
      const simVolIds = new Set(Object.keys(this.simulationData.kanbanSort[date] || {}));
      for (const vid of volIdsOnDate) {
        if (!simVolIds.has(vid)) {
          delete this.kanbanSort[date][vid];
        } else if (this.kanbanSort[date][vid]?.length === 0) {
          delete this.kanbanSort[date][vid];
        }
      }
    }
    this.kanbanSort = { ...this.kanbanSort };

    for (const date of this.simulationData.dates) {
      const validTaskIds = new Set(
        this.tasks.filter(t => t.date === date).map(t => t.id)
      );
      const resetIds: string[] = [
        ...(volunteerChangedTaskIdsByDate[date] || []),
        ...(removedTaskIdsByDate[date] || []),
      ];
      if (resetIds.length > 0) {
        this.mealPrepService.clearPrepStateForTaskIds(date, resetIds);
        this.volunteerDeliveryService.clearDeliveryStateForTaskIds(date, resetIds);
      }
      this.mealPrepService.cleanupOrphanedStorageForDate(date, validTaskIds);
      this.volunteerDeliveryService.cleanupOrphanedStorageForDate(date, validTaskIds);
    }

    const createdNotifications: PhoneNotification[] = [];
    for (const task of submittedTasks) {
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (!elder || elder.pauseDates?.includes(task.date)) continue;
      if (this.isNotificationDuplicate(task.id, '手动登记', elder.id)) continue;
      const volunteer = this.volunteers.find((v) => v.id === task.volunteerId);
      const assignText = volunteer ? `，由${volunteer.name}配送` : '，暂未分配志愿者';
      createdNotifications.push(this.buildPhoneNotification(
        task,
        elder,
        `排班提交通知：${task.date}送餐任务已生成${assignText}`,
        '手动登记',
      ));
    }
    if (createdNotifications.length > 0) {
      this.phoneNotifications = [...createdNotifications, ...this.phoneNotifications];
      this.savePhoneNotifications();
    }
    this.save();
    this.saveKanbanSort();
    this.closeSimulationDiffPreview();
    this.cancelSimulation(false);
    const parts: string[] = [];
    if (countAdded > 0) parts.push(`新增${countAdded}单`);
    if (countUpdated > 0) parts.push(`更新${countUpdated}单`);
    if (countRemoved > 0) parts.push(`移除${countRemoved}单`);
    const detail = parts.length > 0 ? `（${parts.join('、')}）` : '';
    this.showSyncToast(`模拟排班已提交${detail}，正式数据、备餐/配送/闭环看板已同步更新`, 'success');
  }

  cancelSimulation(showConfirm: boolean = true) {
    if (showConfirm && !confirm('确认取消模拟排班？所有模拟数据将被清除，不会影响正式数据。')) {
      return;
    }
    this.simulationMode = 'off';
    this.simulationData = null;
    this.simulationPanelVisible = false;
    this.simulationDiffVisible = false;
    this.simulationDiffResult = null;
    if (showConfirm) {
      this.showSyncToast('已退出模拟模式', 'info');
    }
  }

  openSimulationPanel() {
    this.simulationDetailTab = 'overview';
    this.simulationPanelVisible = true;
  }

  closeSimulationPanel() {
    this.simulationPanelVisible = false;
  }

  setSimulationViewDate(date: string) {
    this.simulationViewDate = date;
  }

  getSimulationTasksForDate(date: string): MealTask[] {
    return this.simulationData?.tasks.filter((t) => t.date === date) || [];
  }

  setStatus(id: string, status: MealTask['status']) {
    if (this.simulationMode === 'active' && this.simulationData) {
      this.simulationData.tasks = this.simulationData.tasks.map((task) =>
        task.id === id ? { ...task, status, exception: status === '异常' ? task.exception : '' } : task
      );
      this.computeAllSimulationStats();
      return;
    }
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, status, exception: status === '异常' ? task.exception : '' } : task);
    this.save();
  }

  taskModConflictVisible = false;
  taskModConflict: {
    taskId: string;
    operation: 'assign-volunteer' | 'set-status';
    newValue: any;
    tempChange: TemporaryDeliveryChange;
    conflicts: string[];
    resolution: 'override-temp' | 'apply-task-only' | 'cancel';
  } | null = null;

  private openTaskModConflict(
    taskId: string,
    operation: 'assign-volunteer' | 'set-status',
    newValue: any,
    tempChange: TemporaryDeliveryChange,
    conflicts: string[],
  ) {
    this.taskModConflict = {
      taskId,
      operation,
      newValue,
      tempChange,
      conflicts,
      resolution: 'apply-task-only',
    };
    this.taskModConflictVisible = true;
  }

  closeTaskModConflict() {
    this.taskModConflictVisible = false;
    this.taskModConflict = null;
  }

  resolveTaskModConflict() {
    if (!this.taskModConflict) { this.closeTaskModConflict(); return; }
    const c = this.taskModConflict;

    if (c.resolution === 'cancel') {
      this.closeTaskModConflict();
      return;
    }

    if (c.operation === 'assign-volunteer') {
      const newVolunteerId = c.resolution === 'override-temp' ? c.newValue : c.newValue;
      if (c.resolution === 'override-temp') {
        this.temporaryDeliveryChanges = this.temporaryDeliveryChanges.map(tc => {
          if (tc.id === c.tempChange.id) {
            return { ...tc, volunteerId: newVolunteerId || undefined };
          }
          return tc;
        });
        this.saveTempChanges();
      }
      this.assignTask(c.taskId, newVolunteerId);
    } else if (c.operation === 'set-status') {
      this.setStatus(c.taskId, c.newValue);
    }

    this.closeTaskModConflict();
  }

  assignTaskWithConflictCheck(taskId: string, volunteerId: string) {
    const task = this.currentScheduleTasks().find(t => t.id === taskId);
    if (!task) { this.assignTask(taskId, volunteerId); return; }
    const tempChange = this.getTempChangeForElderDate(task.elderId, task.date);
    if (!tempChange) { this.assignTask(taskId, volunteerId); return; }

    const conflicts: string[] = [];
    if (tempChange.volunteerId && tempChange.volunteerId !== volunteerId) {
      const curVol = this.volunteers.find(v => v.id === tempChange.volunteerId);
      const newVol = volunteerId ? this.volunteers.find(v => v.id === volunteerId)?.name : '未分配';
      conflicts.push(`临时变更中原本指定志愿者为「${curVol?.name || tempChange.volunteerId}」，当前选择为「${newVol}」`);
    }
    if (tempChange.volunteerId && !volunteerId) {
      const curVol = this.volunteers.find(v => v.id === tempChange.volunteerId);
      conflicts.push(`临时变更原本指定了志愿者「${curVol?.name || tempChange.volunteerId}」，当前选择「未分配」将取消指定`);
    }

    if (conflicts.length === 0) {
      this.assignTask(taskId, volunteerId);
      return;
    }
    this.openTaskModConflict(taskId, 'assign-volunteer', volunteerId, tempChange, conflicts);
  }

  setStatusWithConflictCheck(taskId: string, status: MealTask['status']) {
    const task = this.currentScheduleTasks().find(t => t.id === taskId);
    if (!task) { this.setStatus(taskId, status); return; }
    const tempChange = this.getTempChangeForElderDate(task.elderId, task.date);
    if (!tempChange) { this.setStatus(taskId, status); return; }

    const conflicts: string[] = [];
    if (status === '已送达' && tempChange.address !== undefined && tempChange.address !== '') {
      conflicts.push(`该日期有临时送餐地址变更「${tempChange.address}」，请确认配送至正确地址`);
    }
    if (status === '配送中' && tempChange.contact !== undefined && tempChange.contact !== '') {
      conflicts.push(`该日期有临时联系方式变更「${tempChange.contact}」，请使用最新联系方式`);
    }

    if (conflicts.length === 0) {
      this.setStatus(taskId, status);
      return;
    }
    this.openTaskModConflict(taskId, 'set-status', status, tempChange, conflicts);
  }

  recordException(taskId: string) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return;
    this.exceptionFormTaskId = taskId;
    this.exceptionForm = {
      category: '无人应答',
      severity: '一般',
      description: task.exception || '',
      handler: '',
      status: '待处理',
      result: '',
      source: '手动登记'
    };
    this.exceptionPanelTab = 'form';
    this.exceptionPanelVisible = true;
  }

  closeExceptionPanel() {
    this.exceptionPanelVisible = false;
  }

  submitException() {
    const task = this.tasks.find((t) => t.id === this.exceptionFormTaskId);
    if (!task) return;
    if (!this.exceptionForm.description.trim()) return;
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const record: ExceptionRecord = {
      id: crypto.randomUUID(),
      taskId: this.exceptionFormTaskId,
      elderId: task.elderId,
      date: task.date,
      ...this.exceptionForm,
      createdAt: timeStr,
      updatedAt: timeStr
    };
    this.exceptionRecords = [record, ...this.exceptionRecords];
    this.tasks = this.tasks.map((t) =>
      t.id === this.exceptionFormTaskId ? { ...t, status: '异常' as const, exception: this.exceptionForm.description } : t
    );
    this.saveExceptions();
    this.save();
    this.exceptionPanelTab = 'list';
  }

  updateExceptionStatus(recordId: string, newStatus: ExceptionStatus) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.exceptionRecords = this.exceptionRecords.map((r) =>
      r.id === recordId ? { ...r, status: newStatus, updatedAt: timeStr } : r
    );
    if (newStatus === '已解决') {
      const record = this.exceptionRecords.find((r) => r.id === recordId);
      if (record) {
        this.tasks = this.tasks.map((t) =>
          t.id === record.taskId && t.status === '异常' ? { ...t, status: '已送达' as const, exception: '' } : t
        );
        this.save();
      }
    }
    this.saveExceptions();
  }

  updateExceptionResult(recordId: string, result: string) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.exceptionRecords = this.exceptionRecords.map((r) =>
      r.id === recordId ? { ...r, result, updatedAt: timeStr } : r
    );
    this.saveExceptions();
  }

  deleteException(recordId: string) {
    if (!confirm('确认删除此异常记录？')) return;
    this.exceptionRecords = this.exceptionRecords.filter((r) => r.id !== recordId);
    this.saveExceptions();
  }

  openExceptionHistory() {
    this.exceptionHistoryVisible = true;
  }

  closeExceptionHistory() {
    this.exceptionHistoryVisible = false;
  }

  filteredExceptionRecords(): ExceptionRecord[] {
    let records = [...this.exceptionRecords];
    if (this.exceptionListFilter !== '全部') {
      records = records.filter((r) => r.status === this.exceptionListFilter);
    }
    if (this.exceptionListDate) {
      records = records.filter((r) => r.date === this.exceptionListDate);
    }
    if (this.exceptionListElderId) {
      records = records.filter((r) => r.elderId === this.exceptionListElderId);
    }
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  historyExceptionRecords(): ExceptionRecord[] {
    let records = [...this.exceptionRecords];
    if (this.exceptionHistoryDate) {
      records = records.filter((r) => r.date === this.exceptionHistoryDate);
    }
    if (this.exceptionHistoryElderId) {
      records = records.filter((r) => r.elderId === this.exceptionHistoryElderId);
    }
    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  exceptionCountByStatus(status: ExceptionStatus): number {
    return this.exceptionRecords.filter((r) => r.date === this.taskDate && r.status === status).length;
  }

  todayUnresolvedExceptions(): ExceptionRecord[] {
    return this.exceptionRecords.filter((r) => r.date === today && r.status !== '已解决');
  }

  severityColor(severity: ExceptionSeverity): string {
    if (severity === '紧急') return '#c75454';
    if (severity === '较重') return '#d9a84a';
    return '#4a9f6d';
  }

  statusColor(status: ExceptionStatus): string {
    if (status === '已解决') return '#4a9f6d';
    if (status === '处理中') return '#5a8fd9';
    return '#c75454';
  }

  exceptionFormElderName(): string {
    const task = this.tasks.find((t) => t.id === this.exceptionFormTaskId);
    return task ? this.elderName(task.elderId) : '';
  }

  exceptionFormDate(): string {
    const task = this.tasks.find((t) => t.id === this.exceptionFormTaskId);
    return task ? task.date : '';
  }

  countByStatus(status: MealTask['status']) {
    return this.filteredTasks().filter((task) => task.status === status).length;
  }

  assignedCount(volunteerId: string) {
    return this.filteredTasks().filter((task) => task.volunteerId === volunteerId).length;
  }

  elderName(id: string) {
    return this.elders.find((elder) => elder.id === id)?.name || '未知老人';
  }

  elderAddress(id: string, date?: string) {
    const elder = this.elders.find((elder) => elder.id === id);
    if (!elder) return '';
    if (!date) return elder.address;
    return this.applyTempChangeToElderRef(elder, date).address;
  }

  elderPreference(id: string, date?: string) {
    const elder = this.elders.find((elder) => elder.id === id);
    if (!elder) return '';
    if (!date) return elder.preference;
    const change = this.getTempChangeForElderDate(id, date);
    if (change?.mealTagIds) {
      const tagNames = change.mealTagIds.map(tid => this.mealTags.find(t => t.id === tid)?.name).filter(Boolean).join('、');
      return tagNames || elder.preference;
    }
    return elder.preference;
  }

  elderSpecialNote(id: string, date?: string) {
    const elder = this.elders.find((elder) => elder.id === id);
    if (!elder) return '';
    if (!date) return elder.specialMealNote || '';
    return this.applyTempChangeToElderRef(elder, date).specialMealNote || '';
  }

  elderContact(id: string, date?: string) {
    const elder = this.elders.find((elder) => elder.id === id);
    if (!elder) return '';
    if (!date) return elder.contact;
    return this.applyTempChangeToElderRef(elder, date).contact;
  }

  safeLoadPercent(assigned: number, capacity: number): number {
    if (capacity <= 0) return 0;
    return Math.min((assigned / capacity) * 100, 100);
  }

  getActiveVolunteerCount(stats: DaySimulationStats | null): number {
    if (!stats || !stats.volunteerLoad) return 0;
    return stats.volunteerLoad.filter(v => v.assigned > 0).length;
  }

  getSimulationDatesCount(): number {
    return this.simulationData?.dates?.length || 0;
  }

  kanbanGroups(): KanbanGroup[] {
    const dateTasks = this.filteredTasks();
    const dateSort = this.currentKanbanSort();
    return this.volunteers.map((volunteer) => {
      let vTasks = dateTasks.filter((t) => t.volunteerId === volunteer.id);
      const order = dateSort[volunteer.id];
      if (order && order.length) {
        const orderIndex = new Map(order.map((id, i) => [id, i]));
        vTasks = [...vTasks].sort((a, b) => {
          const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : order.length;
          const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : order.length;
          return ai - bi;
        });
      }
      return { volunteer, tasks: vTasks };
    });
  }

  unassignedKanbanTasks(): MealTask[] {
    return this.filteredTasks().filter((t) => !t.volunteerId);
  }

  moveTask(volunteerId: string, taskId: string, direction: -1 | 1) {
    const dateSort = this.currentKanbanSort();
    if (!dateSort[volunteerId]) {
      dateSort[volunteerId] = this.filteredTasks()
        .filter((t) => t.volunteerId === volunteerId)
        .map((t) => t.id);
    }
    const list = dateSort[volunteerId];
    let idx = list.indexOf(taskId);
    if (idx === -1) {
      list.push(taskId);
      idx = list.length - 1;
    }
    const target = idx + direction;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    if (this.simulationMode === 'active') {
      this.computeAllSimulationStats();
      return;
    }
    this.saveKanbanSort();
  }

  private saveKanbanSort() {
    this.sync.writeLocalData('kanbanSort', this.kanbanSort);
  }

  private loadKanbanSort() {
    const raw = this.sync.readLocalData<KanbanSortMap>('kanbanSort');
    if (raw) this.kanbanSort = raw;
  }

  private load() {
    const elders = this.sync.readLocalData<Elder[]>('elders');
    const volunteers = this.sync.readLocalData<Volunteer[]>('volunteers');
    const tasks = this.sync.readLocalData<MealTask[]>('tasks');
    if (elders) this.elders = elders.map((e: Elder) => ({ ...e, mealTags: e.mealTags || [] }));
    if (volunteers) this.volunteers = volunteers;
    if (tasks) this.tasks = tasks;
  }

  private save() {
    this.sync.writeLocalData('elders', this.elders);
    this.sync.writeLocalData('volunteers', this.volunteers);
    this.sync.writeLocalData('tasks', this.tasks);
  }

  selectElder(id: string) {
    this.selectedElderId = this.selectedElderId === id ? null : id;
  }

  openVisitPanel(elderId: string) {
    this.selectedElderIdForVisit = elderId;
    this.selectedElderId = elderId;
    this.visitTab = 'form';
    this.resetVisitForm();
    this.visitPanelVisible = true;
  }

  closeVisitPanel() {
    this.visitPanelVisible = false;
  }

  resetVisitForm() {
    this.visitForm = {
      visitDate: today,
      visitMethod: '电话',
      healthFeedback: '',
      mealFeedback: '',
      nextAttention: ''
    };
  }

  submitVisit() {
    if (!this.selectedElderIdForVisit || !this.visitForm.visitDate) return;
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const record: VisitRecord = {
      id: crypto.randomUUID(),
      elderId: this.selectedElderIdForVisit,
      ...this.visitForm,
      createdAt: timeStr
    };
    this.visitRecords = [record, ...this.visitRecords];
    this.saveVisits();
    this.resetVisitForm();
    this.visitTab = 'history';
  }

  deleteVisit(id: string) {
    if (!confirm('确认删除这条回访记录？')) return;
    this.visitRecords = this.visitRecords.filter((r) => r.id !== id);
    this.saveVisits();
  }

  getElderVisits(elderId: string): VisitRecord[] {
    return this.visitRecords
      .filter((r) => r.elderId === elderId)
      .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  }

  getLastVisit(elderId: string): VisitRecord | null {
    const visits = this.getElderVisits(elderId);
    return visits.length > 0 ? visits[0] : null;
  }

  summarizeVisit(record: VisitRecord): string {
    const parts: string[] = [];
    if (record.healthFeedback) parts.push('健康：' + this.truncate(record.healthFeedback, 30));
    if (record.mealFeedback) parts.push('用餐：' + this.truncate(record.mealFeedback, 30));
    if (record.nextAttention) parts.push('关注：' + this.truncate(record.nextAttention, 30));
    return parts.length > 0 ? parts.join(' | ') : '已回访，无特殊记录';
  }

  addMealTag() {
    if (!this.newTagName.trim()) return;
    const id = 'custom-' + crypto.randomUUID().slice(0, 8);
    const colorIndex = this.mealTags.length % TAG_COLORS.length;
    this.mealTags = [...this.mealTags, { id, name: this.newTagName.trim(), color: TAG_COLORS[colorIndex] }];
    this.newTagName = '';
    this.saveMealTags();
  }

  startEditTag(tag: MealTag) {
    this.editingTagId = tag.id;
    this.editingTagName = tag.name;
  }

  saveEditTag() {
    if (!this.editingTagId || !this.editingTagName.trim()) return;
    this.mealTags = this.mealTags.map((t) =>
      t.id === this.editingTagId ? { ...t, name: this.editingTagName.trim() } : t
    );
    this.editingTagId = null;
    this.editingTagName = '';
    this.saveMealTags();
  }

  cancelEditTag() {
    this.editingTagId = null;
    this.editingTagName = '';
  }

  removeMealTag(id: string) {
    this.mealTags = this.mealTags.filter((t) => t.id !== id);
    this.elders = this.elders.map((e) => ({
      ...e,
      mealTags: e.mealTags.filter((tid) => tid !== id),
    }));
    this.saveMealTags();
    this.save();
  }

  toggleElderTag(tagId: string) {
    const tags = this.elderForm.mealTags;
    if (tags.includes(tagId)) {
      this.elderForm = { ...this.elderForm, mealTags: tags.filter((t) => t !== tagId) };
    } else {
      this.elderForm = { ...this.elderForm, mealTags: [...tags, tagId] };
    }
  }

  startEditElder(elder: Elder) {
    this.editingElderId = elder.id;
    this.elderEditForm = {
      name: elder.name,
      preference: elder.preference,
      mealTags: [...(elder.mealTags || [])],
      address: elder.address,
      contact: elder.contact,
      note: elder.note,
      deliveryDays: elder.deliveryDays || [1, 2, 3, 4, 5, 6, 7],
      pauseDates: elder.pauseDates || [],
      specialMealNote: elder.specialMealNote || '',
    };
  }

  toggleElderEditTag(tagId: string) {
    const tags = this.elderEditForm.mealTags;
    if (tags.includes(tagId)) {
      this.elderEditForm = { ...this.elderEditForm, mealTags: tags.filter((t) => t !== tagId) };
    } else {
      this.elderEditForm = { ...this.elderEditForm, mealTags: [...tags, tagId] };
    }
  }

  saveEditElder() {
    if (!this.editingElderId || !this.elderEditForm.name.trim()) return;
    this.elders = this.elders.map((e) =>
      e.id === this.editingElderId ? { ...e, ...this.elderEditForm } : e
    );
    this.cancelEditElder();
    this.save();
  }

  cancelEditElder() {
    this.editingElderId = null;
    this.elderEditForm = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5, 6, 7], pauseDates: [], specialMealNote: '' };
  }

  openTempChangePanel(elderId: string) {
    this.tempChangeFormElderId = elderId;
    this.tempChangePanelVisible = true;
    this.tempChangeConflictInfo = null;
    this.editingTempChangeId = null;
    const elder = this.elders.find(e => e.id === elderId);
    this.tempChangeForm = {
      date: today,
      reason: '',
      address: '',
      contact: '',
      mealTagIds: undefined,
      specialMealNote: '',
      volunteerId: '',
    };
  }

  closeTempChangePanel() {
    this.tempChangePanelVisible = false;
    this.tempChangeFormElderId = null;
    this.tempChangeConflictInfo = null;
    this.editingTempChangeId = null;
  }

  editTempChange(change: TemporaryDeliveryChange) {
    this.editingTempChangeId = change.id;
    this.tempChangeForm = {
      date: change.date,
      reason: change.reason,
      address: change.address || '',
      contact: change.contact || '',
      mealTagIds: change.mealTagIds ? [...change.mealTagIds] : undefined,
      specialMealNote: change.specialMealNote || '',
      volunteerId: change.volunteerId || '',
    };
    this.tempChangeConflictInfo = null;
  }

  toggleTempChangeFormTag(tagId: string) {
    const tags = this.tempChangeForm.mealTagIds || [];
    if (tags.includes(tagId)) {
      this.tempChangeForm = { ...this.tempChangeForm, mealTagIds: tags.filter(t => t !== tagId) };
    } else {
      this.tempChangeForm = { ...this.tempChangeForm, mealTagIds: [...tags, tagId] };
    }
  }

  getElderTempChanges(elderId: string): TemporaryDeliveryChange[] {
    return this.temporaryDeliveryChanges.filter(c => c.elderId === elderId);
  }

  getTempChangeForElderDate(elderId: string, date: string): TemporaryDeliveryChange | undefined {
    return this.temporaryDeliveryChanges.find(c => c.elderId === elderId && c.date === date);
  }

  private detectTempChangeConflicts(elderId: string, date: string): string[] {
    const conflicts: string[] = [];
    const task = this.tasks.find(t => t.elderId === elderId && t.date === date);
    if (task) {
      if (task.isManuallyModified) {
        conflicts.push(`该日期存在手动修改的任务（状态：${task.status}），临时变更将覆盖任务中的志愿者分配和特殊餐食备注`);
      }
      if (task.status === '异常') {
        conflicts.push(`该日期存在异常状态的任务（异常信息：${task.exception || '无'}），请确认是否仍要变更`);
      }
    }
    const exceptions = this.exceptionRecords.filter(r => r.elderId === elderId && r.date === date && r.status !== '已解决');
    if (exceptions.length > 0) {
      conflicts.push(`该日期存在 ${exceptions.length} 条未解决的异常记录，变更可能影响异常处理流程`);
    }
    const existingChange = this.temporaryDeliveryChanges.find(c => c.elderId === elderId && c.date === date && c.id !== this.editingTempChangeId);
    if (existingChange) {
      conflicts.push(`该日期已存在临时变更记录，保存将覆盖原变更`);
    }
    return conflicts;
  }

  saveTempChange() {
    if (!this.tempChangeFormElderId || !this.tempChangeForm.date || !this.tempChangeForm.reason.trim()) return;

    const conflicts = this.detectTempChangeConflicts(this.tempChangeFormElderId, this.tempChangeForm.date);
    if (conflicts.length > 0 && !this.tempChangeConflictInfo) {
      this.tempChangeConflictInfo = conflicts.join('\n');
      return;
    }

    if (this.tempChangeConflictInfo && this.tempChangeConflictResolution === 'cancel') {
      this.tempChangeConflictInfo = null;
      return;
    }

    const now = new Date();
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const form = this.tempChangeForm;
    const changeData: Omit<TemporaryDeliveryChange, 'id' | 'createdAt'> = {
      elderId: this.tempChangeFormElderId,
      date: form.date,
      reason: form.reason,
      address: form.address || undefined,
      contact: form.contact || undefined,
      mealTagIds: form.mealTagIds && form.mealTagIds.length > 0 ? form.mealTagIds : undefined,
      specialMealNote: form.specialMealNote || undefined,
      volunteerId: form.volunteerId || undefined,
    };

    if (this.editingTempChangeId) {
      this.temporaryDeliveryChanges = this.temporaryDeliveryChanges.map(c =>
        c.id === this.editingTempChangeId ? { ...c, ...changeData } : c
      );
    } else {
      this.temporaryDeliveryChanges = [
        { id: crypto.randomUUID(), ...changeData, createdAt },
        ...this.temporaryDeliveryChanges,
      ];
    }

    if (!this.tempChangeConflictInfo || this.tempChangeConflictResolution === 'overwrite-task') {
      this.applyTempChangeToTasks(this.tempChangeFormElderId, form.date);
    } else if (this.tempChangeConflictResolution === 'keep-both') {
      this.markTaskTempChangeConflict(this.tempChangeFormElderId, form.date);
    }
    this.saveTempChanges();
    this.tempChangeConflictInfo = null;
    this.tempChangeConflictResolution = 'keep-both';
    this.editingTempChangeId = null;
    this.tempChangeForm = { date: today, reason: '' };
  }

  deleteTempChange(id: string, fromManagePanel: boolean = false) {
    const change = this.temporaryDeliveryChanges.find(c => c.id === id);
    if (!change) return;

    const confirmMsg = fromManagePanel
      ? `确认取消「${change.date}」的临时变更？\n老人：${this.elders.find(e => e.id === change.elderId)?.name || '未知'}\n原因：${change.reason}\n\n取消后该日期将恢复使用老人长期档案信息，并同步刷新备餐、配送和闭环数据。`
      : '确认删除此临时变更？删除后该日期将恢复使用老人长期档案信息。';

    if (!confirm(confirmMsg)) return;

    const elderIdToTaskIdMap = this.buildElderIdDateTaskIdMap();
    const prepImpactTaskIds = this.mealPrepService.onTempChangeCancelled(change, elderIdToTaskIdMap);

    this.revertTaskFromTempChange(change.elderId, change.date);
    this.temporaryDeliveryChanges = this.temporaryDeliveryChanges.filter(c => c.id !== id);

    if (prepImpactTaskIds.length > 0) {
      this.mealPrepService.clearPrepStateForTaskIds(change.date, prepImpactTaskIds);
    }

    this.saveTempChanges();

    if (fromManagePanel) {
      const impact = this.mealPrepService.getTempChangePrepImpactSummary([change], change.date);
      if (prepImpactTaskIds.length > 0) {
        this.showSyncToast(`临时变更已取消，已重置 ${prepImpactTaskIds.length} 条备餐状态，相关数据已同步`, 'info');
      } else if (impact.affectedCount > 0) {
        this.showSyncToast('临时变更已取消，相关数据已同步刷新', 'info');
      } else {
        this.showSyncToast('临时变更已取消', 'info');
      }
    }
  }

  private buildElderIdDateTaskIdMap(): Map<string, Map<string, string>> {
    const result = new Map<string, Map<string, string>>();
    for (const task of this.tasks) {
      if (!result.has(task.elderId)) {
        result.set(task.elderId, new Map());
      }
      result.get(task.elderId)!.set(task.date, task.id);
    }
    return result;
  }

  private revertTaskFromTempChange(elderId: string, date: string) {
    const elder = this.elders.find(e => e.id === elderId);
    if (!elder) return;
    const task = this.tasks.find(t => t.elderId === elderId && t.date === date);
    if (!task) return;
    const change = this.getTempChangeForElderDate(elderId, date);
    if (!change) return;

    this.tasks = this.tasks.map(t => {
      if (t.id !== task.id) return t;
      const updates: Partial<MealTask> = {};
      if (change.volunteerId !== undefined) {
        const activeAssignmentsForElder = this.temporaryDeliveryChanges
          .filter(c => c.elderId === elderId && c.date === date && c.id !== change.id && c.volunteerId !== undefined);
        if (activeAssignmentsForElder.length === 0) {
          updates.volunteerId = '';
          updates.status = '待分配';
        }
      }
      if (change.specialMealNote !== undefined) {
        const activeNoteChanges = this.temporaryDeliveryChanges
          .filter(c => c.elderId === elderId && c.date === date && c.id !== change.id && c.specialMealNote !== undefined);
        if (activeNoteChanges.length === 0) {
          updates.specialMealNote = elder.specialMealNote || '';
        }
      }
      if (Object.keys(updates).length > 0) {
        return { ...t, ...updates, isManuallyModified: true };
      }
      return t;
    });
    this.save();
  }

  private applyTempChangeToTasks(elderId: string, date: string) {
    const change = this.getTempChangeForElderDate(elderId, date);
    if (!change) return;
    const task = this.tasks.find(t => t.elderId === elderId && t.date === date);
    if (task) {
      this.tasks = this.tasks.map(t => {
        if (t.id !== task.id) return t;
        const updates: Partial<MealTask> = {};
        if (change.volunteerId !== undefined) {
          updates.volunteerId = change.volunteerId;
          updates.status = change.volunteerId ? '配送中' : '待分配';
        }
        if (change.specialMealNote !== undefined) {
          updates.specialMealNote = change.specialMealNote;
        }
        return { ...t, ...updates, isManuallyModified: true };
      });
      this.save();
    }
  }

  private markTaskTempChangeConflict(elderId: string, date: string) {
    const task = this.tasks.find(t => t.elderId === elderId && t.date === date);
    if (!task) return;
    this.tasks = this.tasks.map(t => t.id === task.id ? { ...t, isManuallyModified: true } : t);
    this.save();
  }

  applyTempChangeToElderRef(elder: Elder, date: string): Elder {
    const change = this.getTempChangeForElderDate(elder.id, date);
    if (!change) return elder;
    return {
      ...elder,
      address: change.address !== undefined ? change.address : elder.address,
      contact: change.contact !== undefined ? change.contact : elder.contact,
      mealTags: change.mealTagIds !== undefined ? change.mealTagIds : elder.mealTags,
      specialMealNote: change.specialMealNote !== undefined ? change.specialMealNote : elder.specialMealNote,
    };
  }

  private saveTempChanges() {
    this.sync.writeLocalData('temporaryDeliveryChanges', this.temporaryDeliveryChanges);
    this.sync.captureLocalSnapshot('temporaryDeliveryChanges', this.temporaryDeliveryChanges);
  }

  private loadTempChanges() {
    const raw = this.sync.readLocalData<TemporaryDeliveryChange[]>('temporaryDeliveryChanges');
    if (raw) this.temporaryDeliveryChanges = raw;
    this.sync.captureLocalSnapshot('temporaryDeliveryChanges', this.temporaryDeliveryChanges);
  }

  hasTempChangeOnDate(elderId: string, date: string): boolean {
    return this.temporaryDeliveryChanges.some(c => c.elderId === elderId && c.date === date);
  }

  tempChangeSummary(elderId: string, date: string): string {
    const change = this.getTempChangeForElderDate(elderId, date);
    if (!change) return '';
    const parts: string[] = [];
    if (change.address) parts.push('地址已变更');
    if (change.contact) parts.push('联系方式已变更');
    if (change.mealTagIds) parts.push('餐食标签已变更');
    if (change.specialMealNote) parts.push('特殊餐食备注已变更');
    if (change.volunteerId) {
      const vol = this.volunteers.find(v => v.id === change.volunteerId);
      parts.push(vol ? `志愿者指定为${vol.name}` : '志愿者已变更');
    }
    return parts.length > 0 ? parts.join('、') : '临时变更';
  }

  openTempChangeManagePanel() {
    this.tempChangeManagePanelVisible = true;
    this.tempChangeManageSelectedDate = this.taskDate || today;
    this.tempChangeManageExpandedId = null;
  }

  closeTempChangeManagePanel() {
    this.tempChangeManagePanelVisible = false;
    this.tempChangeManageExpandedId = null;
  }

  setTempChangeManageFilter(filter: 'all' | 'today' | 'upcoming' | 'expired') {
    this.tempChangeManageFilter = filter;
  }

  toggleTempChangeManageExpand(id: string) {
    this.tempChangeManageExpandedId = this.tempChangeManageExpandedId === id ? null : id;
  }

  getTempChangeStatus(change: TemporaryDeliveryChange): 'today' | 'upcoming' | 'expired' {
    const changeDate = new Date(change.date);
    const todayDate = new Date(today);
    changeDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((changeDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays < 0) return 'expired';
    return 'upcoming';
  }

  getTempChangeStatusLabel(change: TemporaryDeliveryChange): string {
    const status = this.getTempChangeStatus(change);
    if (status === 'today') return '今日生效';
    if (status === 'expired') return '已过期';
    const diffDays = Math.ceil((new Date(change.date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays}天后生效`;
  }

  getTempChangeStatusClass(change: TemporaryDeliveryChange): string {
    const status = this.getTempChangeStatus(change);
    if (status === 'today') return 'tc-status-today';
    if (status === 'expired') return 'tc-status-expired';
    return 'tc-status-upcoming';
  }

  getFilteredTempChanges(): TemporaryDeliveryChange[] {
    let changes = [...this.temporaryDeliveryChanges];
    if (this.tempChangeManageFilter !== 'all') {
      changes = changes.filter(c => this.getTempChangeStatus(c) === this.tempChangeManageFilter);
    }
    return changes.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  getTempChangesGroupedByDate(): Map<string, TemporaryDeliveryChange[]> {
    const filtered = this.getFilteredTempChanges();
    const groups = new Map<string, TemporaryDeliveryChange[]>();
    for (const change of filtered) {
      if (!groups.has(change.date)) {
        groups.set(change.date, []);
      }
      groups.get(change.date)!.push(change);
    }
    return groups;
  }

  getGroupedDateKeys(): string[] {
    return Array.from(this.getTempChangesGroupedByDate().keys());
  }

  getTempChangeElderName(change: TemporaryDeliveryChange): string {
    return this.elders.find(e => e.id === change.elderId)?.name || '未知老人';
  }

  getTempChangeOriginalAddress(change: TemporaryDeliveryChange): string {
    return this.elders.find(e => e.id === change.elderId)?.address || '-';
  }

  getTempChangeOriginalContact(change: TemporaryDeliveryChange): string {
    return this.elders.find(e => e.id === change.elderId)?.contact || '-';
  }

  getTempChangeOriginalSpecialNote(change: TemporaryDeliveryChange): string {
    return this.elders.find(e => e.id === change.elderId)?.specialMealNote || '';
  }

  getTempChangeOriginalMealTags(change: TemporaryDeliveryChange): MealTag[] {
    const elder = this.elders.find(e => e.id === change.elderId);
    if (!elder) return [];
    return this.mealTags.filter(t => (elder.mealTags || []).includes(t.id));
  }

  getTempChangeEffectiveMealTags(change: TemporaryDeliveryChange): MealTag[] {
    if (change.mealTagIds === undefined) return this.getTempChangeOriginalMealTags(change);
    return this.mealTags.filter(t => change.mealTagIds!.includes(t.id));
  }

  getTempChangeVolunteerName(change: TemporaryDeliveryChange): string {
    if (!change.volunteerId) return '-';
    return this.volunteers.find(v => v.id === change.volunteerId)?.name || '未知志愿者';
  }

  getTempChangeCountByStatus(): { today: number; upcoming: number; expired: number } {
    const result = { today: 0, upcoming: 0, expired: 0 };
    for (const change of this.temporaryDeliveryChanges) {
      result[this.getTempChangeStatus(change)]++;
    }
    return result;
  }

  cleanupExpiredTempChanges() {
    const expired = this.temporaryDeliveryChanges.filter(c => this.getTempChangeStatus(c) === 'expired');
    if (expired.length === 0) {
      this.showSyncToast('当前没有已过期的临时变更', 'info');
      return;
    }
    if (!confirm(`确认清理 ${expired.length} 条已过期的临时变更？\n这些变更日期已过，不再影响任何排班数据。`)) return;

    const elderIdToTaskIdMap = this.buildElderIdDateTaskIdMap();
    const batchImpact = this.mealPrepService.onTempChangesCancelledBatch(expired, elderIdToTaskIdMap);
    if (batchImpact.size > 0) {
      const dateTaskMap = new Map<string, string[]>();
      for (const [changeId, taskIds] of batchImpact) {
        const tc = expired.find(c => c.id === changeId);
        if (tc) {
          if (!dateTaskMap.has(tc.date)) dateTaskMap.set(tc.date, []);
          for (const tid of taskIds) {
            if (!dateTaskMap.get(tc.date)!.includes(tid)) {
              dateTaskMap.get(tc.date)!.push(tid);
            }
          }
        }
      }
      for (const [date, taskIds] of dateTaskMap) {
        this.mealPrepService.clearPrepStateForTaskIds(date, taskIds);
      }
    }

    const expiredIds = new Set(expired.map(c => c.id));
    this.temporaryDeliveryChanges = this.temporaryDeliveryChanges.filter(c => !expiredIds.has(c.id));
    this.saveTempChanges();

    const resetInfo = batchImpact.size > 0 ? `，并重置 ${Array.from(batchImpact.values()).flat().length} 条备餐状态` : '';
    this.showSyncToast(`已清理 ${expired.length} 条过期临时变更${resetInfo}`, 'info');
  }

  elderMealTags(elderId: string, date?: string): MealTag[] {
    const elder = this.elders.find((e) => e.id === elderId);
    if (!elder) return [];
    if (!date) {
      return this.mealTags.filter((t) => (elder.mealTags || []).includes(t.id));
    }
    const effectiveElder = this.applyTempChangeToElderRef(elder, date);
    return this.mealTags.filter((t) => (effectiveElder.mealTags || []).includes(t.id));
  }

  todayTagStats(): { tag: MealTag; count: number }[] {
    const todayTasks = this.filteredTasks();
    const tagCount = new Map<string, number>();
    for (const task of todayTasks) {
      const tags = this.elderMealTags(task.elderId, task.date);
      for (const tag of tags) {
        tagCount.set(tag.id, (tagCount.get(tag.id) || 0) + 1);
      }
    }
    return this.mealTags
      .map((tag) => ({ tag, count: tagCount.get(tag.id) || 0 }))
      .filter((s) => s.count > 0);
  }

  private saveMealTags() {
    this.sync.writeLocalData('mealTags', this.mealTags);
  }

  private loadMealTags() {
    const loaded = this.sync.readLocalData<MealTag[]>('mealTags');
    if (loaded) {
      this.mealTags = loaded.map((t: MealTag, i: number) => ({
        ...t,
        color: t.color || TAG_COLORS[i % TAG_COLORS.length]
      }));
    }
  }

  private truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private saveExceptions() {
    this.sync.writeLocalData('exceptionRecords', this.exceptionRecords);
  }

  private loadExceptions() {
    const raw = this.sync.readLocalData<ExceptionRecord[]>('exceptionRecords');
    if (raw) this.exceptionRecords = raw;
  }

  private saveVisits() {
    this.sync.writeLocalData('visitRecords', this.visitRecords);
  }

  private loadVisits() {
    const raw = this.sync.readLocalData<VisitRecord[]>('visitRecords');
    if (raw) this.visitRecords = raw;
  }

  private savePhoneNotifications() {
    this.sync.writeLocalData('phoneNotifications', this.phoneNotifications);
  }

  private loadPhoneNotifications() {
    const raw = this.sync.readLocalData<PhoneNotification[]>('phoneNotifications');
    if (raw) this.phoneNotifications = raw;
  }

  private saveCallbackTasks() {
    this.sync.writeLocalData('callbackTasks', this.callbackTasks);
  }

  private loadCallbackTasks() {
    const raw = this.sync.readLocalData<CallbackTask[]>('callbackTasks');
    if (raw) this.callbackTasks = raw;
  }

  openPhoneNotificationPanel() {
    this.phoneNotificationPanelVisible = true;
    this.phoneNotificationTab = 'list';
  }

  closePhoneNotificationPanel() {
    this.phoneNotificationPanelVisible = false;
    this.callbackFormVisible = false;
    this.editingCallbackId = null;
    this.selectedNotificationForCallback = null;
  }

  filteredPhoneNotifications(): PhoneNotification[] {
    let notifications = [...this.phoneNotifications];
    if (this.phoneNotificationFilter !== '全部') {
      notifications = notifications.filter(n => n.notificationStatus === this.phoneNotificationFilter);
    }
    return notifications.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getNotificationElderName(notification: PhoneNotification): string {
    if (notification.targetType === 'elder') {
      return this.elders.find(e => e.id === notification.targetId)?.name || '未知老人';
    }
    return this.volunteers.find(v => v.id === notification.targetId)?.name || '未知志愿者';
  }

  updateNotificationStatus(notificationId: string, status: PhoneNotification['notificationStatus'], remark?: string) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.phoneNotifications = this.phoneNotifications.map(n =>
      n.id === notificationId ? { ...n, notificationStatus: status, remark: remark ?? n.remark, updatedAt: timeStr } : n
    );
    this.savePhoneNotifications();
  }

  openCallbackForm(notification: PhoneNotification) {
    this.selectedNotificationForCallback = notification;
    this.editingCallbackId = null;
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const defaultTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.callbackForm = {
      nextCallbackTime: defaultTime,
      handler: '',
      status: '待回拨',
      result: '',
      remark: ''
    };
    this.callbackFormVisible = true;
  }

  editCallbackTask(callbackId: string) {
    const task = this.callbackTasks.find(t => t.id === callbackId);
    if (!task) return;
    this.editingCallbackId = callbackId;
    const notification = this.phoneNotifications.find(n => n.id === task.notificationId);
    this.selectedNotificationForCallback = notification || null;
    this.callbackForm = {
      nextCallbackTime: task.nextCallbackTime,
      handler: task.handler,
      status: task.status,
      result: task.result,
      remark: task.remark
    };
    this.callbackFormVisible = true;
  }

  closeCallbackForm() {
    this.callbackFormVisible = false;
    this.editingCallbackId = null;
    this.selectedNotificationForCallback = null;
  }

  submitCallbackTask() {
    if (!this.selectedNotificationForCallback) return;
    if (!this.callbackForm.nextCallbackTime) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (this.editingCallbackId) {
      this.callbackTasks = this.callbackTasks.map(t =>
        t.id === this.editingCallbackId ? {
          ...t,
          ...this.callbackForm,
          updatedAt: timeStr
        } : t
      );

      const task = this.callbackTasks.find(t => t.id === this.editingCallbackId);
      if (task && task.status === '已完成') {
        this.completeCallbackTask(task.id);
      }
    } else {
      const newTask: CallbackTask = {
        id: crypto.randomUUID(),
        notificationId: this.selectedNotificationForCallback.id,
        taskId: this.selectedNotificationForCallback.taskId,
        elderId: this.selectedNotificationForCallback.targetId,
        date: this.selectedNotificationForCallback.date,
        phone: this.selectedNotificationForCallback.phone,
        ...this.callbackForm,
        callbackCount: 0,
        createdAt: timeStr,
        updatedAt: timeStr
      };
      this.callbackTasks = [newTask, ...this.callbackTasks];
    }

    this.saveCallbackTasks();
    this.closeCallbackForm();
  }

  completeCallbackTask(taskId: string) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const task = this.callbackTasks.find(t => t.id === taskId);
    if (!task) return;

    this.callbackTasks = this.callbackTasks.map(t =>
      t.id === taskId ? {
        ...t,
        status: '已完成',
        callbackCount: t.callbackCount + 1,
        updatedAt: timeStr
      } : t
    );

    this.phoneNotifications = this.phoneNotifications.map(n =>
      n.id === task.notificationId ? {
        ...n,
        notificationStatus: '已通知',
        updatedAt: timeStr
      } : n
    );
    this.savePhoneNotifications();

    const relatedException = this.exceptionRecords.find(e => e.taskId === task.taskId && e.status !== '已解决');
    if (relatedException && task.result) {
      this.exceptionRecords = this.exceptionRecords.map(e =>
        e.id === relatedException.id ? {
          ...e,
          result: task.result,
          updatedAt: timeStr
        } : e
      );
      this.saveExceptions();
    }

    this.saveCallbackTasks();
  }

  updateCallbackStatus(taskId: string, status: CallbackTask['status']) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    this.callbackTasks = this.callbackTasks.map(t =>
      t.id === taskId ? { ...t, status, updatedAt: timeStr } : t
    );

    if (status === '已完成') {
      const task = this.callbackTasks.find(t => t.id === taskId);
      if (task) {
        this.phoneNotifications = this.phoneNotifications.map(n =>
          n.id === task.notificationId ? { ...n, notificationStatus: '已通知', updatedAt: timeStr } : n
        );
        this.savePhoneNotifications();
      }
    }

    this.saveCallbackTasks();
  }

  deleteCallbackTask(taskId: string) {
    if (!confirm('确认删除此回拨任务？')) return;
    this.callbackTasks = this.callbackTasks.filter(t => t.id !== taskId);
    this.saveCallbackTasks();
  }

  getPendingCallbackCount(): number {
    return this.callbackTasks.filter(t => t.status === '待回拨' || t.status === '回拨中').length;
  }

  getPendingNotificationCount(): number {
    return this.phoneNotifications.filter(n => n.notificationStatus === '未通知').length;
  }

  getCallbackRequiredNotificationCount(): number {
    return this.phoneNotifications.filter(n => this.shouldCreateAutoCallback(n)).length;
  }

  activeCallbackTasksPreview(): CallbackTask[] {
    return this.callbackTasks
      .filter(t => t.status === '待回拨' || t.status === '回拨中')
      .slice(0, 3);
  }

  hasActiveCallbackTask(taskId: string): boolean {
    return this.getTaskCallbacks(taskId).some(t => t.status !== '已完成' && t.status !== '已取消');
  }

  getTaskCallbacks(taskId: string): CallbackTask[] {
    return this.callbackTasks
      .filter(t => t.taskId === taskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private shouldCreateAutoCallback(notification: PhoneNotification): boolean {
    return notification.notificationStatus === '未接通' || notification.notificationStatus === '稍后再拨';
  }

  createAutoCallbackTask(notification: PhoneNotification, defaultDelayHours: number = 1) {
    if (this.isCallbackDuplicate(notification.id, notification.notificationStatus)) {
      return;
    }

    const now = new Date();
    now.setHours(now.getHours() + defaultDelayHours);
    const nextTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newTask: CallbackTask = {
      id: crypto.randomUUID(),
      notificationId: notification.id,
      taskId: notification.taskId,
      elderId: notification.targetId,
      date: notification.date,
      phone: notification.phone,
      nextCallbackTime: nextTime,
      handler: '',
      status: '待回拨',
      result: '',
      callbackCount: 0,
      remark: '系统自动生成回拨任务',
      createdAt: timeStr,
      updatedAt: timeStr
    };
    this.callbackTasks = [newTask, ...this.callbackTasks];
    this.saveCallbackTasks();
  }

  // ---------- Conflict Resolution UI Methods ----------

  get currentConflictGroup(): SyncConflictGroup | undefined {
    return this.activeConflictGroups[this.selectedConflictGroupIndex];
  }

  get currentConflictsForGroup(): RecordConflict[] {
    return this.currentConflictGroup?.conflicts || [];
  }

  get selectedRecordConflict(): RecordConflict | undefined {
    return this.currentConflictsForGroup.find(c => c.recordId === this.selectedConflictRecordId);
  }

  selectConflictGroup(index: number) {
    this.selectedConflictGroupIndex = index;
    const group = this.activeConflictGroups[index];
    if (group && group.conflicts.length > 0) {
      this.selectedConflictRecordId = group.conflicts[0].recordId;
    } else {
      this.selectedConflictRecordId = null;
    }
  }

  selectConflictRecord(recordId: string) {
    this.selectedConflictRecordId = recordId;
  }

  setGroupDefaultResolution(groupIndex: number, resolution: ConflictResolution) {
    const group = this.activeConflictGroups[groupIndex];
    if (!group) return;
    group.defaultResolution = resolution;
    for (const rc of group.conflicts) {
      rc.resolution = resolution;
      if (resolution === 'field-level') {
        rc.fieldResolutions = rc.fieldResolutions || {};
        for (const fc of rc.fieldConflicts) {
          if (!(fc.field in rc.fieldResolutions)) {
            rc.fieldResolutions[fc.field] = 'local';
          }
        }
      }
    }
  }

  setRecordResolution(recordId: string, resolution: ConflictResolution) {
    const rc = this.findRecordConflict(recordId);
    if (!rc) return;
    rc.resolution = resolution;
    if (resolution === 'field-level') {
      rc.fieldResolutions = rc.fieldResolutions || {};
      for (const fc of rc.fieldConflicts) {
        if (!(fc.field in rc.fieldResolutions)) {
          rc.fieldResolutions[fc.field] = 'local';
        }
      }
    }
  }

  setFieldChoice(recordId: string, field: string, choice: 'local' | 'remote') {
    const rc = this.findRecordConflict(recordId);
    if (!rc) return;
    rc.fieldResolutions = rc.fieldResolutions || {};
    rc.fieldResolutions[field] = choice;
    const fc = rc.fieldConflicts.find(f => f.field === field);
    if (fc) fc.resolved = choice;
  }

  private findRecordConflict(recordId: string): RecordConflict | undefined {
    for (const g of this.activeConflictGroups) {
      const rc = g.conflicts.find(c => c.recordId === recordId);
      if (rc) return rc;
    }
    return undefined;
  }

  applyAllConflicts() {
    for (const group of this.activeConflictGroups) {
      this.applyConflictGroup(group);
    }
    this.initSyncSnapshots();
    this.activeConflictGroups = [];
    this.conflictPanelVisible = false;
    this.selectedConflictRecordId = null;

    if (this.isImportConflictResolutionMode && this.pendingImportData) {
      const backup = this.pendingImportData;
      const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
        const map = new Map(existing.map(e => [e.id, e]));
        for (const item of incoming) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        return Array.from(map.values());
      };
      const mergeKanbanSort = (incoming: KanbanSortMap): KanbanSortMap => {
        const merged: KanbanSortMap = JSON.parse(JSON.stringify(this.kanbanSort || {}));
        if (incoming && typeof incoming === 'object') {
          for (const date of Object.keys(incoming)) {
            if (!merged[date]) merged[date] = incoming[date];
          }
        }
        return merged;
      };
      this.elders = mergeById(this.elders, backup.elders);
      this.volunteers = mergeById(this.volunteers, backup.volunteers);
      this.tasks = mergeById(this.tasks, backup.tasks);
      this.mealTags = mergeById(this.mealTags, backup.mealTags);
      this.exceptionRecords = mergeById(this.exceptionRecords, backup.exceptionRecords);
      this.visitRecords = mergeById(this.visitRecords, backup.visitRecords);
      this.phoneNotifications = mergeById(this.phoneNotifications, backup.phoneNotifications);
      this.callbackTasks = mergeById(this.callbackTasks, backup.callbackTasks);
      if (backup.kanbanSort) this.kanbanSort = mergeKanbanSort(backup.kanbanSort);

      if (backup.prepData) {
        const current = this.mealPrepService.exportStorageData();
        const merged = this.mergeNestedDateTask(current, backup.prepData);
        this.mealPrepService.importStorageData(merged, false);
      }
      if (backup.deliveryData) {
        const current = this.volunteerDeliveryService.exportStorageData();
        const merged = this.mergeNestedDateTask(current, backup.deliveryData);
        this.volunteerDeliveryService.importStorageData(merged, false);
      }
      this.exceptionRecords = this.sync.deduplicateArray(
        this.exceptionRecords,
        (r) => this.sync.buildDedupKeyForException({ taskId: r.taskId, source: r.source, category: r.category })
      );
      this.phoneNotifications = this.sync.deduplicateArray(
        this.phoneNotifications,
        (n) => this.sync.buildDedupKeyForNotification({ taskId: n.taskId, source: n.source, targetId: n.targetId })
      );
      this.callbackTasks = this.sync.deduplicateArray(
        this.callbackTasks,
        (c) => this.sync.buildDedupKeyForCallback({ notificationId: c.notificationId, status: c.status })
      );
      this.temporaryDeliveryChanges = mergeById(this.temporaryDeliveryChanges, backup.temporaryDeliveryChanges || []);
      this.save(); this.saveKanbanSort(); this.saveMealTags(); this.saveExceptions();
      this.saveVisits(); this.savePhoneNotifications(); this.saveCallbackTasks(); this.saveTempChanges();
      this.finalizeImportComplete();
    }

    this.showSyncToast('冲突已解决，数据已合并', 'info');
  }

  private applyConflictGroup(group: SyncConflictGroup) {
    const dataType = group.dataType;
    switch (dataType) {
      case 'elders':
        this.elders = this.sync.mergeConflicts(group, this.elders) as Elder[];
        this.save();
        break;
      case 'volunteers':
        this.volunteers = this.sync.mergeConflicts(group, this.volunteers) as Volunteer[];
        this.save();
        break;
      case 'tasks':
        this.tasks = this.sync.mergeConflicts(group, this.tasks) as MealTask[];
        this.save();
        break;
      case 'mealTags':
        this.mealTags = this.sync.mergeConflicts(group, this.mealTags) as MealTag[];
        this.saveMealTags();
        break;
      case 'exceptionRecords':
        this.exceptionRecords = this.sync.mergeConflicts(group, this.exceptionRecords) as ExceptionRecord[];
        this.saveExceptions();
        break;
      case 'visitRecords':
        this.visitRecords = this.sync.mergeConflicts(group, this.visitRecords) as VisitRecord[];
        this.saveVisits();
        break;
      case 'phoneNotifications':
        this.phoneNotifications = this.sync.mergeConflicts(group, this.phoneNotifications) as PhoneNotification[];
        this.savePhoneNotifications();
        break;
      case 'callbackTasks':
        this.callbackTasks = this.sync.mergeConflicts(group, this.callbackTasks) as CallbackTask[];
        this.saveCallbackTasks();
        break;
      case 'kanbanSort':
        this.kanbanSort = this.sync.mergeConflicts(group, this.kanbanSort) as KanbanSortMap;
        this.saveKanbanSort();
        break;
      case 'temporaryDeliveryChanges':
        this.temporaryDeliveryChanges = this.sync.mergeConflicts(group, this.temporaryDeliveryChanges) as TemporaryDeliveryChange[];
        this.saveTempChanges();
        break;
      case 'prepData':
        this.mealPrepService.mergeResolvedConflicts(group);
        break;
      case 'deliveryData':
        this.volunteerDeliveryService.mergeResolvedConflicts(group);
        break;
    }
  }

  dismissConflictPanel() {
    if (this.activeConflictGroups.length > 0 && !confirm('仍有未解决的冲突，忽略可能导致数据不一致。确认关闭？')) {
      return;
    }
    this.conflictPanelVisible = false;
  }

  keepAllLocal() {
    for (let i = 0; i < this.activeConflictGroups.length; i++) {
      this.setGroupDefaultResolution(i, 'keep-local');
    }
  }

  adoptAllRemote() {
    for (let i = 0; i < this.activeConflictGroups.length; i++) {
      this.setGroupDefaultResolution(i, 'adopt-remote');
    }
  }

  notifStatusColor(status: PhoneNotification['notificationStatus']): string {
    switch (status) {
      case '已通知': return '#4a9f6d';
      case '未接通': return '#c75454';
      case '稍后再拨': return '#d9a84a';
      case '未通知': return '#8a9783';
      default: return '#8a9783';
    }
  }

  cbStatusBgColor(status: CallbackTask['status']): string {
    switch (status) {
      case '已完成': return '#4a9f6d';
      case '回拨中': return '#5a8fd9';
      case '待回拨': return '#d9a84a';
      case '已取消': return '#8a9783';
      default: return '#8a9783';
    }
  }

  filteredCallbackTasks(): CallbackTask[] {
    let tasks = [...this.callbackTasks];
    if (this.callbackFilterStatus !== '全部') {
      tasks = tasks.filter(t => t.status === this.callbackFilterStatus);
    }
    return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  openImportExportPanel() {
    this.importExportPanelVisible = true;
    this.importTab = 'export';
    this.importPreview = null;
    this.importError = null;
    this.importedData = null;
    this.importSuccess = false;
  }

  closeImportExportPanel() {
    this.importExportPanelVisible = false;
  }

  exportData() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const timestamp = `${dateStr}_${timeStr}`;

    const backup: BackupData = {
      version: this.BACKUP_VERSION,
      exportedAt: now.toISOString(),
      elders: [...this.elders],
      volunteers: [...this.volunteers],
      tasks: [...this.tasks],
      mealTags: [...this.mealTags],
      exceptionRecords: [...this.exceptionRecords],
      visitRecords: [...this.visitRecords],
      phoneNotifications: [...this.phoneNotifications],
      callbackTasks: [...this.callbackTasks],
      kanbanSort: { ...this.kanbanSort },
      prepData: this.mealPrepService.exportStorageData(),
      deliveryData: this.volunteerDeliveryService.exportStorageData(),
      temporaryDeliveryChanges: [...this.temporaryDeliveryChanges],
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `zfl-backup-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importPreview = null;
    this.importError = null;
    this.importedData = null;
    this.importSuccess = false;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        this.validateAndPreviewBackup(data);
      } catch (err) {
        this.importError = {
          type: 'parse',
          message: 'JSON 格式错误',
          details: ['文件无法解析为有效的 JSON 格式', '请确保选择的是正确的备份文件']
        };
      }
    };
    reader.onerror = () => {
      this.importError = {
        type: 'unknown',
        message: '文件读取失败',
        details: ['无法读取选择的文件', '请检查文件是否损坏或权限是否正确']
      };
    };
    reader.readAsText(file);
    input.value = '';
  }

  private validateAndPreviewBackup(data: any) {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      this.importError = {
        type: 'validation',
        message: '备份文件格式无效',
        details: ['文件内容不是有效的对象']
      };
      return;
    }

    if (!data.version || typeof data.version !== 'string') {
      errors.push('缺少 version 字段（版本信息）或类型不为字符串');
    }

    if (!data.exportedAt || typeof data.exportedAt !== 'string') {
      errors.push('缺少 exportedAt 字段（导出时间）或类型不为字符串');
    }

    if (!Array.isArray(data.elders)) {
      errors.push('缺少 elders 字段或格式不正确（必须为数组）');
    } else {
      const ELDER_FIELDS: [string, string][] = [
        ['id', 'string'], ['name', 'string'], ['preference', 'string'],
        ['mealTags', 'array'], ['address', 'string'], ['contact', 'string'], ['note', 'string']
      ];
      for (let i = 0; i < data.elders.length; i++) {
        const elder = data.elders[i];
        if (!elder || typeof elder !== 'object') {
          errors.push(`老人[${i}]: 不是有效的对象`);
          continue;
        }
        for (const [field, type] of ELDER_FIELDS) {
          if (!(field in elder)) {
            errors.push(`老人[${i}]: 缺少 ${field} 字段`);
          } else if (type === 'string' && typeof elder[field] !== 'string') {
            errors.push(`老人[${i}]: ${field} 应为字符串`);
          } else if (type === 'array' && !Array.isArray(elder[field])) {
            errors.push(`老人[${i}]: ${field} 应为数组`);
          }
        }
      }
    }

    if (!Array.isArray(data.volunteers)) {
      errors.push('缺少 volunteers 字段或格式不正确（必须为数组）');
    } else {
      const VOLUNTEER_FIELDS: [string, string][] = [
        ['id', 'string'], ['name', 'string'], ['phone', 'string'],
        ['capacity', 'number'], ['area', 'string']
      ];
      for (let i = 0; i < data.volunteers.length; i++) {
        const vol = data.volunteers[i];
        if (!vol || typeof vol !== 'object') {
          errors.push(`志愿者[${i}]: 不是有效的对象`);
          continue;
        }
        for (const [field, type] of VOLUNTEER_FIELDS) {
          if (!(field in vol)) {
            errors.push(`志愿者[${i}]: 缺少 ${field} 字段`);
          } else if (type === 'string' && typeof vol[field] !== 'string') {
            errors.push(`志愿者[${i}]: ${field} 应为字符串`);
          } else if (type === 'number' && typeof vol[field] !== 'number') {
            errors.push(`志愿者[${i}]: ${field} 应为数字`);
          }
        }
      }
    }

    if (!Array.isArray(data.tasks)) {
      errors.push('缺少 tasks 字段或格式不正确（必须为数组）');
    } else {
      const TASK_FIELDS: [string, string][] = [
        ['id', 'string'], ['elderId', 'string'], ['date', 'string'],
        ['volunteerId', 'string'], ['status', 'string'], ['exception', 'string']
      ];
      const VALID_STATUSES = ['待分配', '配送中', '已送达', '异常'];
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i];
        if (!task || typeof task !== 'object') {
          errors.push(`任务[${i}]: 不是有效的对象`);
          continue;
        }
        for (const [field, type] of TASK_FIELDS) {
          if (!(field in task)) {
            errors.push(`任务[${i}]: 缺少 ${field} 字段`);
          } else if (type === 'string' && typeof task[field] !== 'string') {
            errors.push(`任务[${i}]: ${field} 应为字符串`);
          }
        }
        if ('status' in task && typeof task.status === 'string' && !VALID_STATUSES.includes(task.status)) {
          errors.push(`任务[${i}]: status 值"${task.status}"无效，应为 ${VALID_STATUSES.join('/')}`);
        }
      }
    }

    if (data.mealTags !== undefined) {
      if (!Array.isArray(data.mealTags)) {
        errors.push('mealTags 字段格式不正确（必须为数组）');
      } else {
        const TAG_FIELDS: [string, string][] = [
          ['id', 'string'], ['name', 'string'], ['color', 'string']
        ];
        for (let i = 0; i < data.mealTags.length; i++) {
          const tag = data.mealTags[i];
          if (!tag || typeof tag !== 'object') {
            errors.push(`餐食标签[${i}]: 不是有效的对象`);
            continue;
          }
          for (const [field, type] of TAG_FIELDS) {
            if (!(field in tag)) {
              errors.push(`餐食标签[${i}]: 缺少 ${field} 字段`);
            } else if (type === 'string' && typeof tag[field] !== 'string') {
              errors.push(`餐食标签[${i}]: ${field} 应为字符串`);
            }
          }
        }
      }
    }

    if (data.exceptionRecords !== undefined) {
      if (!Array.isArray(data.exceptionRecords)) {
        errors.push('exceptionRecords 字段格式不正确（必须为数组）');
      } else {
        const EXC_FIELDS: [string, string][] = [
          ['id', 'string'], ['taskId', 'string'], ['elderId', 'string'],
          ['date', 'string'], ['category', 'string'], ['severity', 'string'],
          ['description', 'string'], ['handler', 'string'], ['status', 'string'],
          ['result', 'string'], ['createdAt', 'string'], ['updatedAt', 'string']
        ];
        const VALID_CATEGORIES = ['无人应答', '地址错误', '老人拒收', '餐食问题', '配送延误', '老人身体不适', '其他'];
        const VALID_SEVERITIES = ['一般', '较重', '紧急'];
        const VALID_EXC_STATUSES = ['待处理', '处理中', '已解决'];
        for (let i = 0; i < data.exceptionRecords.length; i++) {
          const exc = data.exceptionRecords[i];
          if (!exc || typeof exc !== 'object') {
            errors.push(`异常记录[${i}]: 不是有效的对象`);
            continue;
          }
          for (const [field, type] of EXC_FIELDS) {
            if (!(field in exc)) {
              errors.push(`异常记录[${i}]: 缺少 ${field} 字段`);
            } else if (type === 'string' && typeof exc[field] !== 'string') {
              errors.push(`异常记录[${i}]: ${field} 应为字符串`);
            }
          }
          if ('category' in exc && typeof exc.category === 'string' && !VALID_CATEGORIES.includes(exc.category)) {
            errors.push(`异常记录[${i}]: category 值"${exc.category}"无效`);
          }
          if ('severity' in exc && typeof exc.severity === 'string' && !VALID_SEVERITIES.includes(exc.severity)) {
            errors.push(`异常记录[${i}]: severity 值"${exc.severity}"无效`);
          }
          if ('status' in exc && typeof exc.status === 'string' && !VALID_EXC_STATUSES.includes(exc.status)) {
            errors.push(`异常记录[${i}]: status 值"${exc.status}"无效`);
          }
        }
      }
    }

    if (data.visitRecords !== undefined) {
      if (!Array.isArray(data.visitRecords)) {
        errors.push('visitRecords 字段格式不正确（必须为数组）');
      } else {
        const VISIT_FIELDS: [string, string][] = [
          ['id', 'string'], ['elderId', 'string'], ['visitDate', 'string'],
          ['visitMethod', 'string'], ['healthFeedback', 'string'],
          ['mealFeedback', 'string'], ['nextAttention', 'string'], ['createdAt', 'string']
        ];
        const VALID_METHODS = ['电话', '上门', '视频', '其他'];
        for (let i = 0; i < data.visitRecords.length; i++) {
          const visit = data.visitRecords[i];
          if (!visit || typeof visit !== 'object') {
            errors.push(`回访记录[${i}]: 不是有效的对象`);
            continue;
          }
          for (const [field, type] of VISIT_FIELDS) {
            if (!(field in visit)) {
              errors.push(`回访记录[${i}]: 缺少 ${field} 字段`);
            } else if (type === 'string' && typeof visit[field] !== 'string') {
              errors.push(`回访记录[${i}]: ${field} 应为字符串`);
            }
          }
          if ('visitMethod' in visit && typeof visit.visitMethod === 'string' && !VALID_METHODS.includes(visit.visitMethod)) {
            errors.push(`回访记录[${i}]: visitMethod 值"${visit.visitMethod}"无效`);
          }
        }
      }
    }

    if (data.prepData !== undefined && (!data.prepData || typeof data.prepData !== 'object' || Array.isArray(data.prepData))) {
      errors.push('prepData 字段格式不正确（必须为对象）');
    }

    if (data.deliveryData !== undefined && (!data.deliveryData || typeof data.deliveryData !== 'object' || Array.isArray(data.deliveryData))) {
      errors.push('deliveryData 字段格式不正确（必须为对象）');
    }

    if (data.temporaryDeliveryChanges !== undefined && !Array.isArray(data.temporaryDeliveryChanges)) {
      errors.push('temporaryDeliveryChanges 字段格式不正确（必须为数组）');
    }

    if (errors.length > 0) {
      this.importError = {
        type: 'validation',
        message: `备份文件字段验证失败（共 ${errors.length} 项错误）`,
        details: errors
      };
      return;
    }

    const backup: BackupData = {
      version: data.version,
      exportedAt: data.exportedAt,
      elders: data.elders,
      volunteers: data.volunteers,
      tasks: data.tasks,
      mealTags: data.mealTags || [],
      exceptionRecords: data.exceptionRecords || [],
      visitRecords: data.visitRecords || [],
      phoneNotifications: data.phoneNotifications || [],
      callbackTasks: data.callbackTasks || [],
      kanbanSort: data.kanbanSort || {},
      prepData: data.prepData || {},
      deliveryData: data.deliveryData || {},
      temporaryDeliveryChanges: data.temporaryDeliveryChanges || [],
    };

    const nestedStatusCount = (storageData: Record<string, Record<string, unknown>> | undefined): number => {
      if (!storageData) return 0;
      return Object.values(storageData).reduce((sum, dayData) => sum + Object.keys(dayData || {}).length, 0);
    };

    const totalCount = backup.elders.length + backup.volunteers.length + backup.tasks.length
      + backup.mealTags.length + backup.exceptionRecords.length + backup.visitRecords.length
      + backup.phoneNotifications.length + backup.callbackTasks.length + (backup.temporaryDeliveryChanges || []).length
      + nestedStatusCount(backup.prepData) + nestedStatusCount(backup.deliveryData);

    if (totalCount === 0) {
      this.importError = {
        type: 'empty',
        message: '备份文件为空',
        details: ['备份文件中没有任何数据', '请选择包含有效数据的备份文件']
      };
      return;
    }

    this.importedData = backup;
    this.importPreview = this.generateImportPreview(backup);
  }

  private generateImportPreview(backup: BackupData): ImportPreview {
    const elderIdMap = new Map(this.elders.map(e => [e.id, e]));
    const volunteerIdMap = new Map(this.volunteers.map(v => [v.id, v]));
    const taskIdMap = new Map(this.tasks.map(t => [t.id, t]));
    const tagIdMap = new Map(this.mealTags.map(t => [t.id, t]));
    const exceptionIdMap = new Map(this.exceptionRecords.map(r => [r.id, r]));
    const visitIdMap = new Map(this.visitRecords.map(r => [r.id, r]));
    const notificationIdMap = new Map(this.phoneNotifications.map(n => [n.id, n]));
    const callbackIdMap = new Map(this.callbackTasks.map(c => [c.id, c]));
    const tempChangeIdMap = new Map(this.temporaryDeliveryChanges.map(c => [c.id, c]));

    const classify = <T extends { id: string }>(items: T[], existingMap: Map<string, T>): ImportPreviewItem<T>[] => {
      return items.map(item => {
        const existing = existingMap.get(item.id);
        let status: 'new' | 'duplicate' | 'overwrite' = 'new';
        if (existing) {
          status = JSON.stringify(item) === JSON.stringify(existing) ? 'duplicate' : 'overwrite';
        }
        return { item, status };
      });
    };

    return {
      elders: classify(backup.elders, elderIdMap),
      volunteers: classify(backup.volunteers, volunteerIdMap),
      tasks: classify(backup.tasks, taskIdMap),
      mealTags: classify(backup.mealTags, tagIdMap),
      exceptionRecords: classify(backup.exceptionRecords, exceptionIdMap),
      visitRecords: classify(backup.visitRecords, visitIdMap),
      phoneNotifications: classify(backup.phoneNotifications, notificationIdMap),
      callbackTasks: classify(backup.callbackTasks, callbackIdMap),
      temporaryDeliveryChanges: classify(backup.temporaryDeliveryChanges || [], tempChangeIdMap)
    };
  }

  private countImportItemsByStatus<T>(items: ImportPreviewItem<T>[], status: 'new' | 'duplicate' | 'overwrite'): number {
    return items.filter(i => i.status === status).length;
  }

  get importPreviewSummary() {
    if (!this.importPreview) return null;
    const p = this.importPreview;
    return {
      elders: { total: p.elders.length, new: this.countImportItemsByStatus(p.elders, 'new'), duplicate: this.countImportItemsByStatus(p.elders, 'duplicate'), overwrite: this.countImportItemsByStatus(p.elders, 'overwrite') },
      volunteers: { total: p.volunteers.length, new: this.countImportItemsByStatus(p.volunteers, 'new'), duplicate: this.countImportItemsByStatus(p.volunteers, 'duplicate'), overwrite: this.countImportItemsByStatus(p.volunteers, 'overwrite') },
      tasks: { total: p.tasks.length, new: this.countImportItemsByStatus(p.tasks, 'new'), duplicate: this.countImportItemsByStatus(p.tasks, 'duplicate'), overwrite: this.countImportItemsByStatus(p.tasks, 'overwrite') },
      mealTags: { total: p.mealTags.length, new: this.countImportItemsByStatus(p.mealTags, 'new'), duplicate: this.countImportItemsByStatus(p.mealTags, 'duplicate'), overwrite: this.countImportItemsByStatus(p.mealTags, 'overwrite') },
      exceptionRecords: { total: p.exceptionRecords.length, new: this.countImportItemsByStatus(p.exceptionRecords, 'new'), duplicate: this.countImportItemsByStatus(p.exceptionRecords, 'duplicate'), overwrite: this.countImportItemsByStatus(p.exceptionRecords, 'overwrite') },
      visitRecords: { total: p.visitRecords.length, new: this.countImportItemsByStatus(p.visitRecords, 'new'), duplicate: this.countImportItemsByStatus(p.visitRecords, 'duplicate'), overwrite: this.countImportItemsByStatus(p.visitRecords, 'overwrite') },
      phoneNotifications: { total: p.phoneNotifications.length, new: this.countImportItemsByStatus(p.phoneNotifications, 'new'), duplicate: this.countImportItemsByStatus(p.phoneNotifications, 'duplicate'), overwrite: this.countImportItemsByStatus(p.phoneNotifications, 'overwrite') },
      callbackTasks: { total: p.callbackTasks.length, new: this.countImportItemsByStatus(p.callbackTasks, 'new'), duplicate: this.countImportItemsByStatus(p.callbackTasks, 'duplicate'), overwrite: this.countImportItemsByStatus(p.callbackTasks, 'overwrite') },
      temporaryDeliveryChanges: { total: p.temporaryDeliveryChanges.length, new: this.countImportItemsByStatus(p.temporaryDeliveryChanges, 'new'), duplicate: this.countImportItemsByStatus(p.temporaryDeliveryChanges, 'duplicate'), overwrite: this.countImportItemsByStatus(p.temporaryDeliveryChanges, 'overwrite') },
    };
  }

  private isValidElder(e: any): boolean {
    return e && typeof e === 'object'
      && typeof e.id === 'string' && typeof e.name === 'string'
      && typeof e.preference === 'string' && Array.isArray(e.mealTags)
      && typeof e.address === 'string' && typeof e.contact === 'string'
      && typeof e.note === 'string';
  }

  private isValidVolunteer(v: any): boolean {
    return v && typeof v === 'object'
      && typeof v.id === 'string' && typeof v.name === 'string'
      && typeof v.phone === 'string' && typeof v.capacity === 'number'
      && typeof v.area === 'string';
  }

  private isValidTask(t: any): boolean {
    return t && typeof t === 'object'
      && typeof t.id === 'string' && typeof t.elderId === 'string'
      && typeof t.date === 'string' && typeof t.volunteerId === 'string'
      && typeof t.status === 'string' && typeof t.exception === 'string'
      && ['待分配', '配送中', '已送达', '异常'].includes(t.status);
  }

  private isValidMealTag(t: any): boolean {
    return t && typeof t === 'object'
      && typeof t.id === 'string' && typeof t.name === 'string'
      && typeof t.color === 'string';
  }

  private isValidExceptionRecord(r: any): boolean {
    return r && typeof r === 'object'
      && typeof r.id === 'string' && typeof r.taskId === 'string'
      && typeof r.elderId === 'string' && typeof r.date === 'string'
      && typeof r.category === 'string' && typeof r.severity === 'string'
      && typeof r.description === 'string' && typeof r.handler === 'string'
      && typeof r.status === 'string' && typeof r.result === 'string'
      && typeof r.createdAt === 'string' && typeof r.updatedAt === 'string';
  }

  private isValidVisitRecord(r: any): boolean {
    return r && typeof r === 'object'
      && typeof r.id === 'string' && typeof r.elderId === 'string'
      && typeof r.visitDate === 'string' && typeof r.visitMethod === 'string'
      && typeof r.healthFeedback === 'string' && typeof r.mealFeedback === 'string'
      && typeof r.nextAttention === 'string' && typeof r.createdAt === 'string';
  }

  private isValidPhoneNotification(n: any): boolean {
    return n && typeof n === 'object'
      && typeof n.id === 'string' && typeof n.date === 'string'
      && typeof n.targetType === 'string' && typeof n.targetId === 'string'
      && typeof n.phone === 'string' && typeof n.taskId === 'string'
      && typeof n.notificationStatus === 'string' && typeof n.remark === 'string'
      && typeof n.source === 'string' && typeof n.updatedAt === 'string';
  }

  private isValidCallbackTask(c: any): boolean {
    return c && typeof c === 'object'
      && typeof c.id === 'string' && typeof c.notificationId === 'string'
      && typeof c.taskId === 'string' && typeof c.elderId === 'string'
      && typeof c.date === 'string' && typeof c.phone === 'string'
      && typeof c.nextCallbackTime === 'string' && typeof c.handler === 'string'
      && typeof c.status === 'string' && typeof c.result === 'string'
      && typeof c.callbackCount === 'number' && typeof c.remark === 'string'
      && typeof c.createdAt === 'string' && typeof c.updatedAt === 'string';
  }

  confirmImport() {
    if (!this.importedData || !this.importPreview) return;

    const backup = this.importedData;
    const integrityErrors: string[] = [];

    if (!Array.isArray(backup.elders) || backup.elders.some((e: any) => !this.isValidElder(e))) {
      integrityErrors.push('老人档案数据不完整，存在缺失字段的记录');
    }
    if (!Array.isArray(backup.volunteers) || backup.volunteers.some((v: any) => !this.isValidVolunteer(v))) {
      integrityErrors.push('志愿者数据不完整，存在缺失字段的记录');
    }
    if (!Array.isArray(backup.tasks) || backup.tasks.some((t: any) => !this.isValidTask(t))) {
      integrityErrors.push('送餐任务数据不完整，存在缺失字段的记录');
    }
    if (backup.mealTags.length > 0 && (!Array.isArray(backup.mealTags) || backup.mealTags.some((t: any) => !this.isValidMealTag(t)))) {
      integrityErrors.push('餐食标签数据不完整，存在缺失字段的记录');
    }
    if (backup.exceptionRecords.length > 0 && (!Array.isArray(backup.exceptionRecords) || backup.exceptionRecords.some((r: any) => !this.isValidExceptionRecord(r)))) {
      integrityErrors.push('异常记录数据不完整，存在缺失字段的记录');
    }
    if (backup.visitRecords.length > 0 && (!Array.isArray(backup.visitRecords) || backup.visitRecords.some((r: any) => !this.isValidVisitRecord(r)))) {
      integrityErrors.push('回访记录数据不完整，存在缺失字段的记录');
    }
    if (backup.phoneNotifications.length > 0 && (!Array.isArray(backup.phoneNotifications) || backup.phoneNotifications.some((n: any) => !this.isValidPhoneNotification(n)))) {
      integrityErrors.push('电话通知数据不完整，存在缺失字段的记录');
    }
    if (backup.callbackTasks.length > 0 && (!Array.isArray(backup.callbackTasks) || backup.callbackTasks.some((c: any) => !this.isValidCallbackTask(c)))) {
      integrityErrors.push('回拨任务数据不完整，存在缺失字段的记录');
    }

    if (integrityErrors.length > 0) {
      this.importError = {
        type: 'validation',
        message: '写入前校验失败，数据可能已被篡改',
        details: integrityErrors
      };
      this.importedData = null;
      this.importPreview = null;
      return;
    }

    const conflictGroups: SyncConflictGroup[] = [];
    const detectionPairs: Array<[SyncDataType, any, any]> = [
      ['elders', backup.elders, this.elders],
      ['volunteers', backup.volunteers, this.volunteers],
      ['tasks', backup.tasks, this.tasks],
      ['mealTags', backup.mealTags, this.mealTags],
      ['exceptionRecords', backup.exceptionRecords, this.exceptionRecords],
      ['visitRecords', backup.visitRecords, this.visitRecords],
      ['phoneNotifications', backup.phoneNotifications, this.phoneNotifications],
      ['callbackTasks', backup.callbackTasks, this.callbackTasks],
      ['kanbanSort', backup.kanbanSort || {}, this.kanbanSort],
      ['temporaryDeliveryChanges', backup.temporaryDeliveryChanges || [], this.temporaryDeliveryChanges],
    ];
    if (backup.prepData) {
      detectionPairs.push(['prepData', backup.prepData, this.mealPrepService.exportStorageData()]);
    }
    if (backup.deliveryData) {
      detectionPairs.push(['deliveryData', backup.deliveryData, this.volunteerDeliveryService.exportStorageData()]);
    }

    for (const [dt, incoming, current] of detectionPairs) {
      const baseSnapshot = this.sync.getLocalSnapshot(dt);
      const group = this.sync.detectConflicts(dt, baseSnapshot, incoming, current);
      if (group.conflicts.length > 0) {
        conflictGroups.push(group);
      }
    }

    const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map(existing.map(e => [e.id, e]));
      for (const item of incoming) {
        map.set(item.id, item);
      }
      return Array.from(map.values());
    };

    const mergeKanbanSort = (incoming: KanbanSortMap): KanbanSortMap => {
      const merged: KanbanSortMap = JSON.parse(JSON.stringify(this.kanbanSort || {}));
      if (incoming && typeof incoming === 'object') {
        for (const date of Object.keys(incoming)) {
          if (!merged[date]) {
            merged[date] = incoming[date];
          } else {
            for (const volId of Object.keys(incoming[date])) {
              merged[date][volId] = incoming[date][volId];
            }
          }
        }
      }
      return merged;
    };

    if (conflictGroups.length > 0) {
      for (const group of conflictGroups) {
        group.defaultResolution = 'keep-local';
        for (const rc of group.conflicts) rc.resolution = 'keep-local';
      }
      this.pendingImportData = backup;
      this.activeConflictGroups = conflictGroups;
      this.selectedConflictGroupIndex = 0;
      if (conflictGroups[0].conflicts.length > 0) {
        this.selectedConflictRecordId = conflictGroups[0].conflicts[0].recordId;
      }
      this.conflictPanelVisible = true;
      this.importExportPanelVisible = false;
      this.isImportConflictResolutionMode = true;
      this.showSyncToast(`导入数据检测到 ${conflictGroups.reduce((s, g) => s + g.conflicts.length, 0)} 个冲突，请处理`, 'warn');
      return;
    }

    this.applyBackupDataWithoutConflict(backup, mergeById, mergeKanbanSort);
    this.finalizeImportComplete();
  }

  private pendingImportData: BackupData | null = null;
  isImportConflictResolutionMode = false;

  get totalConflictsCount(): number {
    let s = 0;
    for (const g of this.activeConflictGroups) s += g.conflicts.length;
    return s;
  }

  stringify(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  }

  private mergeNestedDateTask<T extends Record<string, any>>(
    existing: Record<string, Record<string, T>>,
    incoming: Record<string, Record<string, T>>,
  ): Record<string, Record<string, T>> {
    const result: Record<string, Record<string, T>> = JSON.parse(JSON.stringify(existing || {}));
    if (!incoming || typeof incoming !== 'object') return result;
    for (const date of Object.keys(incoming)) {
      if (!result[date]) result[date] = {};
      for (const taskId of Object.keys(incoming[date])) {
        if (!(taskId in result[date])) {
          result[date][taskId] = JSON.parse(JSON.stringify(incoming[date][taskId]));
        }
      }
    }
    return result;
  }

  private applyBackupDataWithoutConflict(
    backup: BackupData,
    mergeById: <T extends { id: string }>(existing: T[], incoming: T[]) => T[],
    mergeKanbanSort: (incoming: KanbanSortMap) => KanbanSortMap,
  ) {
    this.elders = mergeById(this.elders, backup.elders);
    this.volunteers = mergeById(this.volunteers, backup.volunteers);
    this.tasks = mergeById(this.tasks, backup.tasks);
    this.mealTags = mergeById(this.mealTags, backup.mealTags);
    this.exceptionRecords = mergeById(this.exceptionRecords, backup.exceptionRecords);
    this.visitRecords = mergeById(this.visitRecords, backup.visitRecords);
    this.phoneNotifications = mergeById(this.phoneNotifications, backup.phoneNotifications);
    this.callbackTasks = mergeById(this.callbackTasks, backup.callbackTasks);

    if (backup.temporaryDeliveryChanges) {
      this.temporaryDeliveryChanges = mergeById(this.temporaryDeliveryChanges, backup.temporaryDeliveryChanges);
    }

    this.exceptionRecords = this.sync.deduplicateArray(
      this.exceptionRecords,
      (r) => this.sync.buildDedupKeyForException({ taskId: r.taskId, source: r.source, category: r.category })
    );
    this.phoneNotifications = this.sync.deduplicateArray(
      this.phoneNotifications,
      (n) => this.sync.buildDedupKeyForNotification({ taskId: n.taskId, source: n.source, targetId: n.targetId })
    );
    this.callbackTasks = this.sync.deduplicateArray(
      this.callbackTasks,
      (c) => this.sync.buildDedupKeyForCallback({ notificationId: c.notificationId, status: c.status })
    );

    if (backup.kanbanSort) {
      this.kanbanSort = mergeKanbanSort(backup.kanbanSort);
    }
    if (backup.prepData) {
      const current = this.mealPrepService.exportStorageData();
      const merged = this.mergeNestedDateTask(current, backup.prepData);
      this.mealPrepService.importStorageData(merged, false);
    }
    if (backup.deliveryData) {
      const current = this.volunteerDeliveryService.exportStorageData();
      const merged = this.mergeNestedDateTask(current, backup.deliveryData);
      this.volunteerDeliveryService.importStorageData(merged, false);
    }

    this.save();
    this.saveKanbanSort();
    this.saveMealTags();
    this.saveExceptions();
    this.saveVisits();
    this.savePhoneNotifications();
    this.saveCallbackTasks();
    this.saveTempChanges();
  }

  private finalizeImportComplete() {
    this.initSyncSnapshots();
    this.importSuccess = true;
    this.importPreview = null;
    this.importedData = null;
    this.pendingImportData = null;
    this.isImportConflictResolutionMode = false;
  }

  getPreviewTempChangeElderName(change: TemporaryDeliveryChange): string {
    if (this.importedData?.elders) {
      const fromImported = this.importedData.elders.find(e => e.id === change.elderId);
      if (fromImported) return fromImported.name;
    }
    const fromCurrent = this.elders.find(e => e.id === change.elderId);
    if (fromCurrent) return fromCurrent.name;
    return '未知老人(' + change.elderId.substring(0, 6) + ')';
  }

  previewStatusLabel(status: 'new' | 'duplicate' | 'overwrite'): string {
    if (status === 'new') return '新增';
    if (status === 'duplicate') return '重复';
    if (status === 'overwrite') return '覆盖';
    return '';
  }

  resetImport() {
    this.importPreview = null;
    this.importError = null;
    this.importedData = null;
    this.importSuccess = false;
  }
}
