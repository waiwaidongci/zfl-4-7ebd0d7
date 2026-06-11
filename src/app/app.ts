import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MealPrepComponent } from './meal-prep/meal-prep.component';
import { MealPrepService, PrepStorageData, ExceptionRecord as PrepExceptionRecord, PhoneNotification as PrepPhoneNotification, MealTask as PrepMealTask } from './meal-prep/meal-prep.service';
import { VolunteerDeliveryComponent } from './volunteer-delivery/volunteer-delivery.component';
import {
  VolunteerDeliveryService,
  ExceptionRecord as DeliveryExceptionRecord,
  PhoneNotification as DeliveryPhoneNotification,
} from './volunteer-delivery/volunteer-delivery.service';

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

type ScheduleFailureReason = 'paused' | 'no_volunteer' | 'capacity_full' | 'not_scheduled_day';

type ScheduleFailure = {
  elderId: string;
  elderName: string;
  date: string;
  reason: ScheduleFailureReason;
  reasonText: string;
};

type WeeklyScheduleResult = {
  weekStart: string;
  weekEnd: string;
  generatedTasks: MealTask[];
  takenOverTasks: MealTask[];
  assignedTasks: AutoAssignEntry[];
  failures: ScheduleFailure[];
  skippedManualTasks: string[];
};

type WeeklyDayColumn = {
  date: string;
  dayName: string;
  dayOfWeek: number;
  tasks: MealTask[];
  failures: ScheduleFailure[];
};

type ExceptionCategory = '无人应答' | '地址错误' | '老人拒收' | '餐食问题' | '配送延误' | '老人身体不适' | '其他';
type ExceptionSeverity = '一般' | '较重' | '紧急';
type ExceptionStatus = '待处理' | '处理中' | '已解决';

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

type NotificationStatus = '未通知' | '已通知' | '未接通' | '稍后再拨';
type NotificationTargetType = 'elder' | 'volunteer';

type PhoneNotification = {
  id: string;
  date: string;
  targetType: NotificationTargetType;
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: NotificationStatus;
  remark: string;
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
  kanbanSort: KanbanSortMap;
  weeklyScheduleStart?: string;
  mealPrepData?: PrepStorageData;
};

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

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
};

type ImportError = {
  type: 'parse' | 'validation' | 'empty' | 'unknown';
  message: string;
  details?: string[];
};

type SyncDataType = 'elders' | 'volunteers' | 'tasks' | 'exceptionRecords';

type DataVersionMap = Record<SyncDataType, number>;

type DataSnapshot = {
  elders: Elder[];
  volunteers: Volunteer[];
  tasks: MealTask[];
  exceptionRecords: ExceptionRecord[];
};

type ConflictField = {
  field: string;
  localValue: any;
  remoteValue: any;
};

type ItemConflict = {
  id: string;
  label: string;
  type: SyncDataType;
  fields: ConflictField[];
  localOnly: boolean;
  remoteOnly: boolean;
  isEditing: boolean;
  editingType: string | null;
};

type EditingStateItem = {
  type: SyncDataType | 'mealTag' | 'phoneNotification';
  id: string;
  label: string;
};

type ConflictSummary = {
  elders: ItemConflict[];
  volunteers: ItemConflict[];
  tasks: ItemConflict[];
  exceptionRecords: ItemConflict[];
};

type SyncStatus = 'idle' | 'remote-changes' | 'conflict';

type SyncNotification = {
  status: SyncStatus;
  remoteVersions: DataVersionMap;
  conflictSummary: ConflictSummary | null;
  pendingRemoteData: DataSnapshot | null;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MealPrepComponent, VolunteerDeliveryComponent],
  template: `
    <main>
      <header class="hero" *ngIf="appViewMode === 'schedule'">
        <div>
          <p>社区老人送餐</p>
          <h1>排班前端</h1>
        </div>
        <div class="stats">
          <span>{{ elders.length }}位老人</span>
          <span>{{ volunteers.length }}名志愿者</span>
          <span>{{ todayTasks().length }}个今日任务</span>
          <span>{{ todayUnresolvedExceptions().length }}条异常</span>
        </div>
        <div class="hero-actions">
          <button type="button" class="delivery-view-btn" (click)="openVolunteerDelivery()">📱 志愿者配送端</button>
          <button type="button" class="ghost import-export-btn" (click)="openImportExportPanel()">📦 数据导入导出</button>
        </div>
      </header>

      <ng-container *ngIf="appViewMode === 'schedule'">
      <div class="sync-alert" *ngIf="syncNotification.status !== 'idle'" [class.conflict]="syncNotification.status === 'conflict'" [class.editing-conflict]="hasEditingConflicts()" (click)="openSyncPanel()">
        <div class="sync-alert-icon">
          <ng-container *ngIf="hasEditingConflicts()">🚨</ng-container>
          <ng-container *ngIf="!hasEditingConflicts() && syncNotification.status === 'conflict'">⚠️</ng-container>
          <ng-container *ngIf="syncNotification.status === 'remote-changes'">🔄</ng-container>
        </div>
        <div class="sync-alert-content">
          <ng-container *ngIf="hasEditingConflicts()">
            <strong>编辑中的数据发生冲突</strong>
            <span>{{ getEditingSyncTip() }}。同时其他窗口更新了 {{ syncSummaryCounts.total }} 项数据，请立即处理。</span>
          </ng-container>
          <ng-container *ngIf="!hasEditingConflicts() && syncNotification.status === 'conflict'">
            <strong>检测到数据冲突</strong>
            <span>本窗口有未保存的修改，同时其他窗口更新了 {{ syncSummaryCounts.total }} 项数据。</span>
            <span class="sync-sub-tip" *ngIf="hasEditingItems()">（{{ getEditingSyncTip() }}）</span>
          </ng-container>
          <ng-container *ngIf="syncNotification.status === 'remote-changes'">
            <strong>发现新数据可同步</strong>
            <span>其他窗口更新了 {{ syncSummaryCounts.total }} 项数据，本窗口无冲突，可一键同步。</span>
            <span class="sync-sub-tip" *ngIf="hasEditingItems()">（{{ getEditingSyncTip() }}）</span>
          </ng-container>
        </div>
        <div class="sync-alert-actions">
          <button type="button" class="ghost sm" (click)="$event.stopPropagation(); closeSyncPanel()">忽略</button>
          <button type="button" class="sm" (click)="$event.stopPropagation(); openSyncPanel()">查看详情</button>
          <button type="button" class="sm" *ngIf="syncNotification.status === 'remote-changes'" style="background:#4a9f6d" (click)="$event.stopPropagation(); adoptAllRemote()">一键同步</button>
        </div>
      </div>

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
            <div class="tag-select">
              <label class="tag-select-label">固定送餐周期</label>
              <div class="tag-select-grid">
                <label class="tag-check" *ngFor="let day of WEEK_DAYS; let i = index">
                  <input type="checkbox" [checked]="elderForm.deliveryDays.includes(i)" (change)="toggleElderDeliveryDay(i)" />
                  <span>{{ day }}</span>
                </label>
              </div>
            </div>
            <textarea name="elderSpecialNote" [(ngModel)]="elderForm.specialMealNote" rows="2" placeholder="特殊餐食备注（如：少糖、不吃辣等）"></textarea>
            <input name="elderAddress" [(ngModel)]="elderForm.address" placeholder="送餐地址" />
            <input name="elderContact" [(ngModel)]="elderForm.contact" placeholder="紧急联系" />
            <input name="elderNote" [(ngModel)]="elderForm.note" placeholder="其他备注" />
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
                      <button type="button" class="ghost sm visit-btn" (click)="$event.stopPropagation(); openVisitPanel(elder.id)">回访</button>
                    </div>
                  </div>
                  <small>{{ elder.address }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(elder.id).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(elder.id)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
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
                  <div class="tag-select">
                    <label class="tag-select-label">固定送餐周期</label>
                    <div class="tag-select-grid">
                      <label class="tag-check" *ngFor="let day of WEEK_DAYS; let i = index">
                        <input type="checkbox" [checked]="elderEditForm.deliveryDays.includes(i)" (change)="toggleElderEditDeliveryDay(i)" />
                        <span>{{ day }}</span>
                      </label>
                    </div>
                  </div>
                  <textarea [(ngModel)]="elderEditForm.specialMealNote" name="editElderSpecialNote" rows="2" placeholder="特殊餐食备注（如：少糖、不吃辣等）"></textarea>
                  <div class="pause-dates-section">
                    <label class="tag-select-label">暂停送餐日期</label>
                    <div class="pause-dates-list">
                      <span class="pause-date-tag" *ngFor="let pd of elderEditForm.pauseDates">
                        {{ pd }}
                        <button type="button" class="tag-del" (click)="removeEditPauseDate(pd)">×</button>
                      </span>
                    </div>
                    <div class="pause-date-input">
                      <input type="date" #pauseDateInput />
                      <button type="button" class="sm" (click)="addEditPauseDate(pauseDateInput)">添加</button>
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
            <div class="tag-select">
              <label class="tag-select-label">每周可服务日期</label>
              <div class="tag-select-grid">
                <label class="tag-check" *ngFor="let day of WEEK_DAYS; let i = index">
                  <input type="checkbox" [checked]="volunteerForm.availableDays.includes(i)" (change)="toggleVolunteerAvailableDay(i)" />
                  <span>{{ day }}</span>
                </label>
              </div>
            </div>
            <button>保存志愿者</button>
          </form>
        </aside>

        <section class="panel">
          <div class="toolbar">
            <h2>每日送餐任务</h2>
            <div>
              <button type="button" class="ghost" (click)="openWeeklySchedulePanel()">📅 多日排班计划</button>
              <input type="date" [(ngModel)]="taskDate" />
              <button type="button" (click)="generateTasks()">生成当日任务</button>
              <button type="button" class="auto-assign-btn" (click)="autoAssignTasks()">自动分配</button>
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
            <article *ngFor="let task of filteredTasks()" [class.warn]="task.status === '异常'" [class.manual-modified]="task.isManuallyModified">
              <div>
                <div class="task-header">
                  <strong>{{ elderName(task.elderId) }}</strong>
                  <span class="manual-badge" *ngIf="task.isManuallyModified" title="已手动修改，自动排班不会覆盖">✋ 手动</span>
                </div>
                <span>{{ elderAddress(task.elderId) }}</span>
                <small>{{ elderPreference(task.elderId) }}</small>
                <div class="tag-row" *ngIf="elderMealTags(task.elderId).length > 0">
                  <span class="tag-chip" *ngFor="let tag of elderMealTags(task.elderId)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                </div>
                <p class="special-note" *ngIf="task.specialMealNote">🍽️ {{ task.specialMealNote }}</p>
              </div>
              <select [ngModel]="task.volunteerId" (ngModelChange)="assignTask(task.id, $event)">
                <option value="">未分配</option>
                <option *ngFor="let volunteer of volunteers" [value]="volunteer.id">{{ volunteer.name }} · {{ volunteer.area }}</option>
              </select>
              <div class="actions">
                <button type="button" (click)="setStatus(task.id, '配送中')">配送中</button>
                <button type="button" (click)="setStatus(task.id, '已送达')">已送达</button>
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
              <div class="kanban-card" *ngFor="let task of group.tasks; let i = index">
                <div class="kanban-card-info">
                  <strong>{{ elderName(task.elderId) }}</strong>
                  <span>{{ elderAddress(task.elderId) }}</span>
                  <small>{{ elderPreference(task.elderId) }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(task.elderId).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(task.elderId)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
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
              <div class="kanban-card" *ngFor="let task of unassignedKanbanTasks()">
                <div class="kanban-card-info">
                  <strong>{{ elderName(task.elderId) }}</strong>
                  <span>{{ elderAddress(task.elderId) }}</span>
                  <small>{{ elderPreference(task.elderId) }}</small>
                  <div class="tag-row" *ngIf="elderMealTags(task.elderId).length > 0">
                    <span class="tag-chip sm" *ngFor="let tag of elderMealTags(task.elderId)">{{ tag.name }}</span>
                  </div>
                  <p class="kanban-status">{{ task.status }}</p>
                </div>
              </div>
              <p class="muted" *ngIf="unassignedKanbanTasks().length === 0">全部已分配</p>
            </div>
          </div>
        </div>
      </section>

      <section class="panel phone-notification-section">
        <div class="toolbar">
          <h2>📞 电话通知清单</h2>
          <div>
            <input type="date" [(ngModel)]="taskDate" (ngModelChange)="generatePhoneNotificationsForDate(taskDate)" />
            <button type="button" (click)="generatePhoneNotificationsForDate(taskDate)">刷新清单</button>
          </div>
        </div>

        <div class="pn-status-row">
          <div class="pn-status-item"><strong>{{ notificationCountByStatus('未通知') }}</strong><span>未通知</span></div>
          <div class="pn-status-item"><strong style="color:#4a9f6d">{{ notificationCountByStatus('已通知') }}</strong><span>已通知</span></div>
          <div class="pn-status-item"><strong style="color:#c75454">{{ notificationCountByStatus('未接通') }}</strong><span>未接通</span></div>
          <div class="pn-status-item"><strong style="color:#d9a84a">{{ notificationCountByStatus('稍后再拨') }}</strong><span>稍后再拨</span></div>
        </div>

        <div class="pn-tabs">
          <button type="button" [class.active-tab]="phoneNotificationTab === 'all'" (click)="phoneNotificationTab = 'all'">全部 ({{ phoneNotificationsForCurrentDateCount }})</button>
          <button type="button" [class.active-tab]="phoneNotificationTab === 'elder'" (click)="phoneNotificationTab = 'elder'">👴 老人</button>
          <button type="button" [class.active-tab]="phoneNotificationTab === 'volunteer'" (click)="phoneNotificationTab = 'volunteer'">👥 志愿者</button>
        </div>

        <div class="pn-list">
          <ng-container *ngFor="let n of phoneNotificationsForDate()">
            <div class="pn-item" [class.pn-pending]="n.notificationStatus === '未通知'" [class.pn-warning]="n.notificationStatus === '未接通' || n.notificationStatus === '稍后再拨'">
              <div class="pn-item-header">
                <div class="pn-item-title">
                  <span class="pn-type-tag" [class.elder-tag]="n.targetType === 'elder'" [class.volunteer-tag]="n.targetType === 'volunteer'">{{ phoneNotificationTargetLabel(n) }}</span>
                  <strong>{{ phoneNotificationTargetName(n) }}</strong>
                </div>
                <span class="pn-status-tag" [style.color]="notificationStatusColor(n.notificationStatus)" [style.borderColor]="notificationStatusColor(n.notificationStatus)">
                  {{ n.notificationStatus }}
                </span>
              </div>
              <div class="pn-item-meta">
                <span class="pn-phone">📱 {{ n.phone || '暂无电话' }}</span>
                <span class="pn-task-status">任务状态：{{ phoneNotificationTaskStatus(n) }}</span>
              </div>
              <div class="pn-item-remark" *ngIf="n.remark && editingNotificationId !== n.id">
                <label>备注：</label>
                <span>{{ n.remark }}</span>
              </div>
              <div class="pn-item-remark-edit" *ngIf="editingNotificationId === n.id">
                <textarea [(ngModel)]="editingNotificationRemark" rows="2" placeholder="输入简短备注..."></textarea>
                <div class="pn-remark-actions">
                  <button type="button" class="ghost sm" (click)="cancelEditNotificationRemark()">取消</button>
                  <button type="button" class="sm" (click)="saveNotificationRemark(n.id)">保存</button>
                </div>
              </div>
              <div class="pn-item-actions">
                <button type="button" class="sm" (click)="setNotificationStatus(n.id, '已通知')" [disabled]="n.notificationStatus === '已通知'">✓ 已通知</button>
                <button type="button" class="sm" style="background:#c75454" (click)="setNotificationStatus(n.id, '未接通')" [disabled]="n.notificationStatus === '未接通'">✗ 未接通</button>
                <button type="button" class="sm" style="background:#d9a84a" (click)="setNotificationStatus(n.id, '稍后再拨')" [disabled]="n.notificationStatus === '稍后再拨'">⏱ 稍后再拨</button>
                <button type="button" class="ghost sm" (click)="startEditNotificationRemark(n.id)" *ngIf="editingNotificationId !== n.id">📝 备注</button>
                <button type="button" class="ghost sm" (click)="setNotificationStatus(n.id, '未通知')" *ngIf="n.notificationStatus !== '未通知'">重置</button>
              </div>
              <small class="pn-updated-at">更新于 {{ n.updatedAt }}</small>
            </div>
          </ng-container>
          <p class="muted center" *ngIf="phoneNotificationsForDate().length === 0">暂无电话通知记录，请先生成当日任务</p>
        </div>
      </section>

      <app-meal-prep
        [date]="taskDate"
        [tasks]="tasks"
        [elders]="elders"
        [mealTags]="mealTags"
        (exceptionCreated)="onPrepExceptionCreated($event)"
        (notificationCreated)="onPrepNotificationCreated($event)"
        (taskUpdated)="onPrepTaskUpdated($event)"
      ></app-meal-prep>

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
                  <li><strong>{{ phoneNotifications.length }}</strong> 条电话通知记录</li>
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

      <div class="modal-overlay" *ngIf="showWeeklySchedulePanel" (click)="closeWeeklySchedulePanel()">
        <div class="modal-panel weekly-schedule-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>📅 多日排班计划</h2>
              <p class="muted">选择一周，自动生成排班并分配志愿者</p>
            </div>
            <button type="button" class="ghost sm" (click)="closeWeeklySchedulePanel()">关闭</button>
          </div>

          <div class="modal-body">
            <div class="weekly-toolbar">
              <div class="week-nav">
                <button type="button" class="ghost sm" (click)="prevWeek()">← 上周</button>
                <input type="date" [(ngModel)]="weeklyScheduleStart" (change)="onWeekStartChange()" />
                <button type="button" class="ghost sm" (click)="nextWeek()">下周 →</button>
                <button type="button" class="ghost sm" (click)="goToCurrentWeek()">本周</button>
              </div>
              <button type="button" class="auto-assign-btn" (click)="generateWeeklySchedule()">🔄 生成一周排班</button>
            </div>

            <div class="weekly-summary" *ngIf="weeklyScheduleResult">
              <div class="summary-item ok">
                <strong>{{ weeklyScheduleResult.generatedTasks.length }}</strong>
                <span>已生成任务</span>
              </div>
              <div class="summary-item ok">
                <strong>{{ weeklyScheduleResult.takenOverTasks.length }}</strong>
                <span>已接管任务</span>
              </div>
              <div class="summary-item ok">
                <strong>{{ weeklyScheduleResult.assignedTasks.length }}</strong>
                <span>已自动分配</span>
              </div>
              <div class="summary-item fail" *ngIf="weeklyScheduleResult.failures.length > 0">
                <strong>{{ weeklyScheduleResult.failures.length }}</strong>
                <span>未排上</span>
              </div>
              <div class="summary-item warn" *ngIf="weeklyScheduleResult.skippedManualTasks.length > 0">
                <strong>{{ weeklyScheduleResult.skippedManualTasks.length }}</strong>
                <span>已跳过（手动修改）</span>
              </div>
            </div>

            <div class="skipped-list" *ngIf="weeklyScheduleResult && weeklyScheduleResult.skippedManualTasks.length > 0">
              <p class="muted"><strong>✋ 以下任务因已手动修改而跳过：</strong></p>
              <div class="skipped-tags">
                <span class="tag-chip sm" *ngFor="let s of weeklyScheduleResult.skippedManualTasks">{{ s }}</span>
              </div>
            </div>

            <div class="weekly-grid">
              <div class="weekly-column" *ngFor="let col of getWeeklyDayColumns()" [class.today]="col.date === today">
                <div class="weekly-column-header">
                  <strong>{{ col.dayName }}</strong>
                  <span>{{ col.date }}</span>
                  <span class="col-count">{{ col.tasks.length }}单</span>
                </div>
                <div class="weekly-column-body">
                  <div class="weekly-task" *ngFor="let task of col.tasks" [class.warn]="task.status === '异常'" [class.manual-modified]="task.isManuallyModified">
                    <div class="weekly-task-header">
                      <strong>{{ elderName(task.elderId) }}</strong>
                      <span class="manual-badge sm" *ngIf="task.isManuallyModified">✋</span>
                    </div>
                    <small>{{ elderAddress(task.elderId) }}</small>
                    <div class="tag-row" *ngIf="elderMealTags(task.elderId).length > 0">
                      <span class="tag-chip sm" *ngFor="let tag of elderMealTags(task.elderId)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                    </div>
                    <p class="special-note sm" *ngIf="task.specialMealNote">🍽️ {{ task.specialMealNote }}</p>
                    <p class="weekly-volunteer">
                      <ng-container *ngIf="task.volunteerId">
                        👤 {{ getVolunteerName(task.volunteerId) }}
                      </ng-container>
                      <ng-container *ngIf="!task.volunteerId">
                        ⏳ 未分配
                      </ng-container>
                      <span class="task-status" [class.status-pending]="task.status === '待分配'" [class.status-delivering]="task.status === '配送中'" [class.status-done]="task.status === '已送达'" [class.status-exception]="task.status === '异常'">{{ task.status }}</span>
                    </p>
                  </div>

                  <div class="weekly-failure" *ngFor="let fail of col.failures">
                    <span class="fail-icon">
                      <ng-container [ngSwitch]="fail.reason">
                        <ng-container *ngSwitchCase="'paused'">⏸️</ng-container>
                        <ng-container *ngSwitchCase="'no_volunteer'">👤❌</ng-container>
                        <ng-container *ngSwitchCase="'capacity_full'">📦</ng-container>
                        <ng-container *ngSwitchDefault>⚠️</ng-container>
                      </ng-container>
                    </span>
                    <div class="fail-content">
                      <strong>{{ fail.elderName }}</strong>
                      <small>{{ fail.reasonText }}</small>
                    </div>
                  </div>

                  <p class="muted center" *ngIf="col.tasks.length === 0 && col.failures.length === 0">暂无任务</p>
                </div>
              </div>
            </div>

            <div class="failure-legend" *ngIf="weeklyScheduleResult && weeklyScheduleResult.failures.length > 0">
              <h4>未排上原因说明</h4>
              <div class="legend-grid">
                <div class="legend-item"><span class="fail-icon">⏸️</span><span>老人暂停送餐</span></div>
                <div class="legend-item"><span class="fail-icon">👤❌</span><span>无可用志愿者</span></div>
                <div class="legend-item"><span class="fail-icon">📦</span><span>志愿者容量已满</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" *ngIf="syncPanelVisible" (click)="closeSyncPanel()">
        <div class="modal-panel sync-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h2>多窗口数据同步</h2>
              <p class="muted">
                <ng-container *ngIf="hasEditingConflicts()">
                  🚨 编辑中的数据同时被其他窗口修改，请立即处理！
                </ng-container>
                <ng-container *ngIf="!hasEditingConflicts() && syncNotification.status === 'conflict'">
                  ⚠️ 检测到数据冲突，请选择处理方式
                </ng-container>
                <ng-container *ngIf="syncNotification.status === 'remote-changes'">
                  🔄 其他窗口有更新数据，可直接同步
                </ng-container>
              </p>
            </div>
            <button type="button" class="ghost sm" (click)="closeSyncPanel()">关闭</button>
          </div>

          <div class="editing-alert" *ngIf="hasEditingConflicts()">
            <div class="editing-alert-icon">🚨</div>
            <div class="editing-alert-content">
              <strong>重要提醒</strong>
              <span>您正在编辑的以下记录同时被其他窗口修改：</span>
              <div class="editing-alert-items">
                <span class="editing-alert-item" *ngFor="let e of getEditingConflictItems()">
                  ✏️ {{ e.label }}
                </span>
              </div>
              <div class="editing-alert-tip">
                建议先 <button type="button" class="inline-btn" (click)="closeSyncPanel()">关闭此面板保存编辑</button> 或选择合适的合并策略。
              </div>
            </div>
          </div>

          <div class="sync-modal-actions">
            <div class="sync-bulk-actions">
              <button type="button" class="ghost sm" (click)="keepAllLocal()">📝 保留本窗口全部</button>
              <button type="button" class="sm" style="background:#4a9f6d" (click)="adoptAllRemote()">🔄 采用最新数据</button>
              <button type="button" *ngIf="syncNotification.conflictSummary" class="sm" style="background:#5a8fd9" (click)="applyFullMerge()">🔀 按选择合并</button>
            </div>
          </div>

          <div class="modal-tabs">
            <button type="button" [class.active-tab]="syncPanelTab === 'summary'" (click)="syncPanelTab = 'summary'">
              📊 总览
              <span class="badge" *ngIf="getBadgeCount('summary') > 0">{{ getBadgeCount('summary') }}</span>
            </button>
            <button type="button" [class.active-tab]="syncPanelTab === 'elders'" (click)="syncPanelTab = 'elders'">
              👴 老人
              <span class="badge" *ngIf="getBadgeCount('elders') > 0">{{ getBadgeCount('elders') }}</span>
            </button>
            <button type="button" [class.active-tab]="syncPanelTab === 'volunteers'" (click)="syncPanelTab = 'volunteers'">
              👥 志愿者
              <span class="badge" *ngIf="getBadgeCount('volunteers') > 0">{{ getBadgeCount('volunteers') }}</span>
            </button>
            <button type="button" [class.active-tab]="syncPanelTab === 'tasks'" (click)="syncPanelTab = 'tasks'">
              📋 任务
              <span class="badge" *ngIf="getBadgeCount('tasks') > 0">{{ getBadgeCount('tasks') }}</span>
            </button>
            <button type="button" [class.active-tab]="syncPanelTab === 'exceptionRecords'" (click)="syncPanelTab = 'exceptionRecords'">
              ⚠️ 异常
              <span class="badge" *ngIf="getBadgeCount('exceptionRecords') > 0">{{ getBadgeCount('exceptionRecords') }}</span>
            </button>
          </div>

          <div class="modal-body sync-modal-body">
            <div *ngIf="syncPanelTab === 'summary'" class="sync-summary">
              <div class="sync-editing-summary" *ngIf="hasEditingConflicts()">
                <div class="sync-editing-summary-icon">✏️</div>
                <div class="sync-editing-summary-content">
                  <h4>正在编辑中的冲突</h4>
                  <p class="muted">以下记录您正在编辑，同时被其他窗口修改，需特别注意：</p>
                  <div class="sync-editing-items">
                    <span class="sync-editing-item" *ngFor="let e of getEditingConflictItems()">
                      <span class="sync-editing-item-icon">🚨</span>
                      <span class="sync-editing-item-type">{{ getEditingTypeLabel(e.type) }}</span>
                      <span class="sync-editing-item-label">{{ e.label }}</span>
                    </span>
                  </div>
                  <button type="button" class="sm" style="background:#e55353; margin-top:12px" (click)="closeSyncPanel()">先关闭去保存编辑</button>
                </div>
              </div>

              <div class="sync-summary-card" *ngFor="let t of SYNC_DATA_TYPES">
                <div class="sync-summary-icon">
                  <ng-container [ngSwitch]="t">
                    <ng-container *ngSwitchCase="'elders'">👴</ng-container>
                    <ng-container *ngSwitchCase="'volunteers'">👥</ng-container>
                    <ng-container *ngSwitchCase="'tasks'">📋</ng-container>
                    <ng-container *ngSwitchCase="'exceptionRecords'">⚠️</ng-container>
                  </ng-container>
                </div>
                <div class="sync-summary-info">
                  <h4>
                    {{ getDataTypeLabel(t) }}
                    <span class="conflict-tag editing-tag" *ngIf="hasEditingConflictInType(t)">✏️ 含编辑中</span>
                  </h4>
                  <div class="sync-summary-counts">
                    <span *ngIf="syncNotification.conflictSummary">
                      冲突 {{ getTabConflictCount(t) }} 项
                    </span>
                    <span *ngIf="!syncNotification.conflictSummary && syncNotification.pendingRemoteData">
                      变更 {{ getSyncTypeCount(t) }} 项
                    </span>
                  </div>
                </div>
              </div>

              <div class="sync-tips" *ngIf="syncNotification.status === 'conflict'">
                <h4>💡 冲突解决建议</h4>
                <ul>
                  <li><strong>保留本窗口</strong>：以当前页面的修改为准，其他窗口的更新会被覆盖。</li>
                  <li><strong>采用最新数据</strong>：使用其他窗口的最新数据，本窗口的未保存修改将丢失。</li>
                  <li><strong>按选择合并</strong>：在各分类标签中逐条选择保留本窗口或采用新数据，灵活处理。</li>
                </ul>
              </div>
            </div>

            <ng-container *ngIf="syncNotification.conflictSummary">
              <ng-container *ngIf="syncPanelTab !== 'summary'">
                <div class="conflict-list">
                  <div class="conflict-item" *ngFor="let c of getTabConflicts(syncPanelTab)" [class.editing-item]="c.isEditing">
                    <div class="conflict-item-header">
                      <div class="conflict-item-title">
                        <span class="conflict-tag" [class.local-only]="c.localOnly" [class.remote-only]="c.remoteOnly">
                          <ng-container *ngIf="c.localOnly">仅本窗口新增</ng-container>
                          <ng-container *ngIf="c.remoteOnly">仅其他窗口新增</ng-container>
                          <ng-container *ngIf="!c.localOnly && !c.remoteOnly">字段冲突</ng-container>
                        </span>
                        <span class="conflict-tag editing-tag" *ngIf="c.isEditing">✏️ 正在编辑</span>
                        <strong>{{ c.label }}</strong>
                      </div>
                      <div class="conflict-choose" *ngIf="c.localOnly || c.remoteOnly">
                        <label>
                          <input type="radio" [name]="'conf-' + c.id" value="keep" [checked]="getMergeSelection(syncPanelTab, c.id) === 'keep'" (change)="setMergeSelection(syncPanelTab, c.id, 'keep')" />
                          <span>保留{{ c.localOnly ? '（不删除）' : '（不添加）' }}</span>
                        </label>
                        <label>
                          <input type="radio" [name]="'conf-' + c.id" value="adopt" [checked]="getMergeSelection(syncPanelTab, c.id) === 'adopt'" (change)="setMergeSelection(syncPanelTab, c.id, 'adopt')" />
                          <span>采用{{ c.remoteOnly ? '（添加）' : '（删除）' }}</span>
                        </label>
                      </div>
                    </div>

                    <div class="editing-warning" *ngIf="c.isEditing">
                      <span>⚠️ 您正在编辑此记录，请确认合并策略。建议先保存当前编辑再处理同步。</span>
                    </div>

                    <div class="conflict-fields" *ngIf="!c.localOnly && !c.remoteOnly">
                      <div class="conflict-field-item" *ngFor="let f of c.fields">
                        <div class="field-name">{{ fieldLabel(c.type, f.field) }}</div>
                        <div class="field-compare">
                          <div class="field-col local">
                            <div class="field-col-label">📝 本窗口
                              <label class="choose-radio">
                                <input type="radio" [name]="'field-' + c.id + '-' + f.field" value="keep"
                                  [checked]="getMergeSelection(syncPanelTab, c.id) === 'keep'"
                                  (change)="setMergeSelection(syncPanelTab, c.id, 'keep')" />
                                选这个
                              </label>
                            </div>
                            <div class="field-value">{{ formatValue(f.localValue) }}</div>
                          </div>
                          <div class="field-arrow">↔</div>
                          <div class="field-col remote">
                            <div class="field-col-label">🔄 最新
                              <label class="choose-radio">
                                <input type="radio" [name]="'field-' + c.id + '-' + f.field" value="adopt"
                                  [checked]="getMergeSelection(syncPanelTab, c.id) === 'adopt'"
                                  (change)="setMergeSelection(syncPanelTab, c.id, 'adopt')" />
                                选这个
                              </label>
                            </div>
                            <div class="field-value">{{ formatValue(f.remoteValue) }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p class="muted center" *ngIf="getTabConflictCount(syncPanelTab) === 0">
                    该类型无冲突
                  </p>
                </div>
              </ng-container>
            </ng-container>

            <ng-container *ngIf="!syncNotification.conflictSummary && syncPanelTab !== 'summary' && syncNotification.pendingRemoteData">
              <div class="no-conflict-info">
                <div class="no-conflict-icon">✅</div>
                <h4>该类型无冲突</h4>
                <p class="muted">本窗口对 {{ getDataTypeLabel(syncPanelTab) }} 无未保存修改，点击「采用最新数据」即可一键同步。</p>
              </div>
            </ng-container>
          </div>

          <div class="sync-modal-footer">
            <button type="button" class="ghost" (click)="closeSyncPanel()">暂不处理</button>
            <button type="button" class="ghost sm" (click)="keepAllLocal()">📝 保留本窗口</button>
            <button type="button" class="sm" style="background:#4a9f6d" (click)="adoptAllRemote()">🔄 采用最新数据</button>
            <button type="button" *ngIf="syncNotification.conflictSummary" class="sm" style="background:#5a8fd9" (click)="applyFullMerge()">🔀 确认合并</button>
          </div>
        </div>
      </div>

      </ng-container>

      <app-volunteer-delivery
        *ngIf="appViewMode === 'delivery'"
        [date]="taskDate"
        [volunteerId]="selectedDeliveryVolunteerId"
        [volunteers]="volunteers"
        [tasks]="tasks"
        [elders]="elders"
        [mealTags]="mealTags"
        [visitRecords]="visitRecords"
        [kanbanSort]="kanbanSort"
        (statusUpdated)="onDeliveryStatusUpdated($event)"
        (backToSchedule)="closeVolunteerDelivery()"
      ></app-volunteer-delivery>

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
    .hero-actions { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .delivery-view-btn { background: linear-gradient(135deg, #5a8fd9, #4a7fc9); color: white; padding: 10px 16px; font-size: 13px; font-weight: 500; border: 1px solid rgba(255,255,255,.25); border-radius: 8px; cursor: pointer; transition: all .15s; white-space: nowrap; }
    .delivery-view-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(90,143,217,.35); }
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

    .import-export-btn { align-self: flex-end; white-space: nowrap; }
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

    .phone-notification-section { margin-top: 16px; }
    .pn-status-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .pn-status-item { text-align: center; border: 1px solid #e2e7da; border-radius: 8px; padding: 10px 6px; background: #fbfcf9; }
    .pn-status-item strong { display: block; font-size: 22px; margin-bottom: 2px; color: #315448; }
    .pn-status-item span { font-size: 12px; color: #65715f; }

    .pn-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #e8ede1; }
    .pn-tabs button { background: transparent; color: #65715f; border: 0; padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: 14px; }
    .pn-tabs button.active-tab { color: #315448; border-bottom-color: #315448; font-weight: 600; }

    .pn-list { display: flex; flex-direction: column; gap: 10px; max-height: 600px; overflow-y: auto; }
    .pn-item { border: 1px solid #e0e6d8; border-radius: 10px; padding: 14px 16px; background: #fbfcf9; position: relative; }
    .pn-item.pn-pending { border-left: 4px solid #8a9783; }
    .pn-item.pn-warning { border-left: 4px solid #d9a84a; background: #fffbf3; }
    .pn-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .pn-item-title { display: flex; align-items: center; gap: 8px; }
    .pn-item-title strong { font-size: 15px; }

    .pn-type-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .pn-type-tag.elder-tag { background: #eef3ea; color: #315448; border: 1px solid #c4d6ba; }
    .pn-type-tag.volunteer-tag { background: #f0f5fc; color: #5a8fd9; border: 1px solid #c4d9f0; }

    .pn-status-tag { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; border: 1px solid; background: transparent; }

    .pn-item-meta { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; font-size: 13px; color: #5a6b53; }
    .pn-phone { font-weight: 600; color: #315448; }

    .pn-item-remark { display: flex; gap: 6px; padding: 8px 10px; background: #fff; border-radius: 6px; border: 1px solid #edf0e8; margin-bottom: 10px; font-size: 13px; }
    .pn-item-remark label { font-weight: 600; color: #5a6b53; white-space: nowrap; }
    .pn-item-remark span { color: #3d4a38; line-height: 1.5; flex: 1; }

    .pn-item-remark-edit { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
    .pn-item-remark-edit textarea { width: 100%; border: 1px solid #cfd8ca; border-radius: 8px; padding: 10px; background: #fff; color: #242923; resize: vertical; font-family: inherit; font-size: 13px; }
    .pn-remark-actions { display: flex; justify-content: flex-end; gap: 8px; }

    .pn-item-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .pn-item-actions button:disabled { opacity: 0.4; cursor: not-allowed; }

    .pn-updated-at { display: block; margin-top: 10px; color: #99a593; font-size: 11px; text-align: right; }

    @media (max-width: 600px) {
      .pn-status-row { grid-template-columns: repeat(2, 1fr); }
      .pn-tabs { overflow-x: auto; }
      .pn-tabs button { white-space: nowrap; }
    }

    .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .manual-badge { display: inline-block; padding: 2px 8px; background: #fff7ef; color: #b36a2e; border: 1px solid #f0d9c4; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .manual-badge.sm { padding: 1px 6px; font-size: 10px; }
    .manual-modified { border-color: #d9a84a !important; background: #fffbf3 !important; }
    .special-note { margin: 6px 0 0; padding: 6px 10px; background: #f0f5fc; border-radius: 6px; font-size: 12px; color: #5a8fd9; }
    .special-note.sm { padding: 4px 8px; font-size: 11px; }

    .pause-dates-section { display: flex; flex-direction: column; gap: 8px; }
    .pause-dates-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .pause-date-tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #fff7ef; color: #b36a2e; border: 1px solid #f0d9c4; border-radius: 10px; font-size: 12px; }
    .pause-date-input { display: flex; gap: 6px; }
    .pause-date-input input { flex: 1; }

    .weekly-schedule-modal { max-width: 1400px; width: 95vw; }
    .weekly-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; padding: 14px; background: #f7f8f4; border-radius: 8px; }
    .week-nav { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .week-nav input { width: 140px; }

    .weekly-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .summary-item { text-align: center; padding: 14px; border-radius: 8px; border: 1px solid #e2e7da; background: #fbfcf9; }
    .summary-item strong { display: block; font-size: 28px; margin-bottom: 4px; }
    .summary-item span { font-size: 13px; color: #65715f; }
    .summary-item.ok strong { color: #4a9f6d; }
    .summary-item.fail strong { color: #c75454; }
    .summary-item.warn strong { color: #d9a84a; }

    .skipped-list { margin-bottom: 16px; padding: 12px 14px; background: #fffbf3; border: 1px solid #f0e6c4; border-radius: 8px; }
    .skipped-list p { margin: 0 0 8px; }
    .skipped-tags { display: flex; flex-wrap: wrap; gap: 6px; }

    .weekly-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; margin-bottom: 16px; }
    .weekly-column { background: #f7f8f4; border: 1px solid #e2e7da; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
    .weekly-column.today { border-color: #315448; }
    .weekly-column.today .weekly-column-header { background: #eef3ea; }
    .weekly-column-header { display: flex; flex-direction: column; gap: 2px; padding: 12px; background: #eef1e8; border-bottom: 1px solid #e2e7da; }
    .weekly-column-header strong { font-size: 15px; color: #315448; }
    .weekly-column-header span { font-size: 12px; color: #65715f; }
    .col-count { display: inline-block; background: #315448; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; width: fit-content; margin-top: 4px; }
    .weekly-column.today .col-count { background: #315448; }
    .weekly-column-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; max-height: 500px; }

    .weekly-task { background: #fff; border: 1px solid #e0e6d8; border-radius: 8px; padding: 10px; font-size: 13px; }
    .weekly-task.warn { border-color: #d78b63; background: #fff7ef; }
    .weekly-task.manual-modified { border-color: #d9a84a; background: #fffbf3; }
    .weekly-task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .weekly-task-header strong { font-size: 14px; }
    .weekly-task small { display: block; color: #65715f; margin-bottom: 4px; }
    .weekly-volunteer { margin: 6px 0 0; padding-top: 6px; border-top: 1px dashed #e0e6d8; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #3d4a38; }
    .task-status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .task-status.status-pending { background: #eef1ec; color: #8a9783; }
    .task-status.status-delivering { background: #e8f3ec; color: #4a9f6d; }
    .task-status.status-done { background: #f0f5fc; color: #5a8fd9; }
    .task-status.status-exception { background: #fff7ef; color: #c75454; }

    .weekly-failure { display: flex; gap: 8px; padding: 10px; background: #fff7ef; border: 1px solid #f0d9c4; border-radius: 8px; }
    .fail-icon { font-size: 18px; flex-shrink: 0; }
    .fail-content { flex: 1; }
    .fail-content strong { display: block; font-size: 13px; color: #3d4a38; margin-bottom: 2px; }
    .fail-content small { font-size: 11px; color: #b36a2e; line-height: 1.4; }

    .failure-legend { padding: 14px; background: #fbfcf9; border: 1px solid #e2e7da; border-radius: 8px; }
    .failure-legend h4 { margin: 0 0 12px; font-size: 14px; color: #315448; }
    .legend-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .failure-legend .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5a6b53; }
    .failure-legend .legend-item .fail-icon { font-size: 16px; }

    @media (max-width: 1200px) {
      .weekly-grid { grid-template-columns: repeat(2, 1fr); }
      .weekly-summary { grid-template-columns: repeat(2, 1fr); }
      .legend-grid { grid-template-columns: repeat(2, 1fr); }
      .weekly-toolbar { flex-direction: column; align-items: stretch; }
      .weekly-toolbar .week-nav { justify-content: center; }
      .weekly-toolbar button { width: 100%; }
    }

    .sync-alert { display: flex; align-items: center; gap: 16px; padding: 14px 20px; margin-top: 16px; border-radius: 10px; background: #e8f3ec; border: 1px solid #c4d6ba; cursor: pointer; transition: all .15s; }
    .sync-alert:hover { box-shadow: 0 4px 14px rgba(74,159,109,.15); }
    .sync-alert.conflict { background: #fff3e6; border-color: #f0d2b4; }
    .sync-alert.editing-conflict { background: #fdecec; border-color: #f0c4c4; animation: pulse-warning 2s ease-in-out infinite; }
    @keyframes pulse-warning { 0%, 100% { box-shadow: 0 0 0 0 rgba(229,83,83,.4); } 50% { box-shadow: 0 0 0 8px rgba(229,83,83,0); } }
    .sync-alert.editing-conflict .sync-alert-content strong { color: #c64040; }
    .sync-alert.editing-conflict .sync-alert-content span { color: #a05050; }
    .sync-alert-icon { font-size: 28px; flex-shrink: 0; }
    .sync-alert-content { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .sync-alert-content strong { font-size: 15px; color: #315448; }
    .sync-alert-content span { font-size: 13px; color: #5a6b53; }
    .sync-alert-content .sync-sub-tip { font-size: 12px; color: #8a9b83; opacity: .8; }
    .sync-alert.conflict .sync-alert-content strong { color: #b36a2e; }
    .sync-alert-actions { display: flex; gap: 8px; }

    .sync-modal { max-width: 960px !important; width: 92vw; }
    .sync-modal-actions { padding: 14px 22px; border-bottom: 1px solid #e8ede1; background: #fafbf7; }
    .sync-bulk-actions { display: flex; gap: 10px; }
    .sync-modal-body { padding-top: 0 !important; padding-bottom: 0 !important; }
    .sync-modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px; border-top: 1px solid #e8ede1; background: #fafbf7; }

    .editing-alert { display: flex; gap: 14px; padding: 16px 20px; background: #fdecec; border-bottom: 1px solid #f0c4c4; }
    .editing-alert-icon { font-size: 28px; flex-shrink: 0; }
    .editing-alert-content { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .editing-alert-content strong { font-size: 15px; color: #c64040; }
    .editing-alert-content > span { font-size: 13px; color: #a05050; }
    .editing-alert-items { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .editing-alert-item { padding: 4px 10px; background: #fff; border: 1px solid #f0c4c4; border-radius: 12px; font-size: 12px; color: #c64040; }
    .editing-alert-tip { font-size: 12px; color: #8a5050; margin-top: 4px; }
    .inline-btn { display: inline; padding: 2px 8px; margin: 0 4px; background: #c64040; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; }

    .sync-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 20px 0; }
    .sync-editing-summary { grid-column: 1 / -1; display: flex; gap: 14px; padding: 16px; background: #fdecec; border: 2px solid #e55353; border-radius: 10px; }
    .sync-editing-summary-icon { font-size: 32px; flex-shrink: 0; }
    .sync-editing-summary-content { flex: 1; }
    .sync-editing-summary-content h4 { margin: 0 0 6px; font-size: 15px; color: #c64040; }
    .sync-editing-items { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .sync-editing-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff; border-radius: 6px; font-size: 13px; }
    .sync-editing-item-icon { font-size: 14px; }
    .sync-editing-item-type { font-weight: 600; color: #c64040; }
    .sync-editing-item-label { color: #5a5050; }
    .sync-summary-card { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid #e2e7da; border-radius: 10px; background: #fbfcf9; }
    .sync-summary-icon { font-size: 36px; flex-shrink: 0; }
    .sync-summary-info h4 { margin: 0 0 6px; font-size: 15px; color: #315448; display: flex; align-items: center; gap: 8px; }
    .sync-summary-counts { font-size: 13px; color: #5a8fd9; font-weight: 500; }

    .sync-tips { grid-column: 1 / -1; padding: 16px; background: #fff7ef; border: 1px solid #f0d9c4; border-radius: 10px; margin-top: 8px; }
    .sync-tips h4 { margin: 0 0 10px; font-size: 14px; color: #b36a2e; }
    .sync-tips ul { margin: 0; padding-left: 20px; color: #8a6a2a; font-size: 13px; line-height: 1.8; }
    .sync-tips li strong { color: #5a4a2a; }

    .conflict-list { padding: 20px 0; display: flex; flex-direction: column; gap: 14px; }
    .conflict-item { border: 1px solid #e0e6d8; border-radius: 10px; padding: 14px 16px; background: #fbfcf9; }
    .conflict-item.editing-item { border: 2px solid #e55353; background: #fff8f8; }
    .conflict-item-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #e0e6d8; }
    .conflict-item.editing-item .conflict-item-header { border-bottom-color: #f0c4c4; }
    .conflict-item-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .conflict-item-title strong { font-size: 15px; color: #315448; }
    .conflict-tag { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; background: #fff3e6; color: #b36a2e; border: 1px solid #f0d2b4; }
    .conflict-tag.local-only { background: #eef3ea; color: #315448; border-color: #c4d6ba; }
    .conflict-tag.remote-only { background: #f0f5fc; color: #5a8fd9; border-color: #c4d9f0; }
    .conflict-tag.editing-tag { background: #fdecec; color: #c64040; border-color: #f0c4c4; }
    .editing-warning { padding: 10px 12px; margin-bottom: 12px; background: #fef0f0; border: 1px dashed #f0c4c4; border-radius: 6px; font-size: 12px; color: #a05050; }
    .conflict-choose { display: flex; gap: 14px; flex-shrink: 0; }
    .conflict-choose label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #5a6b53; cursor: pointer; }
    .conflict-choose input { accent-color: #315448; margin: 0; }

    .conflict-fields { display: flex; flex-direction: column; gap: 10px; }
    .conflict-field-item { border: 1px solid #edf0e8; border-radius: 8px; padding: 10px 12px; background: #fff; }
    .field-name { font-size: 12px; font-weight: 600; color: #5a6b53; margin-bottom: 8px; }
    .field-compare { display: flex; gap: 10px; align-items: stretch; }
    .field-col { flex: 1; border-radius: 6px; padding: 10px; background: #f7f8f4; border: 1px solid #e2e7da; }
    .field-col.local { background: #eef3ea; border-color: #c4d6ba; }
    .field-col.remote { background: #f0f5fc; border-color: #c4d9f0; }
    .field-col-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 500; margin-bottom: 6px; color: #3d4a38; }
    .field-col.local .field-col-label { color: #315448; }
    .field-col.remote .field-col-label { color: #5a8fd9; }
    .choose-radio { font-size: 11px; font-weight: normal; display: inline-flex; align-items: center; gap: 4px; color: #5a6b53; cursor: pointer; }
    .choose-radio input { accent-color: #315448; margin: 0; width: auto; }
    .field-value { font-size: 13px; color: #3d4a38; line-height: 1.5; word-break: break-all; }
    .field-arrow { display: flex; align-items: center; justify-content: center; font-size: 18px; color: #99a593; flex-shrink: 0; width: 30px; }

    .no-conflict-info { text-align: center; padding: 60px 20px; }
    .no-conflict-icon { font-size: 56px; margin-bottom: 16px; }
    .no-conflict-info h4 { margin: 0 0 8px; font-size: 18px; color: #4a9f6d; }

    @media (max-width: 800px) {
      .sync-summary { grid-template-columns: 1fr; }
      .field-compare { flex-direction: column; }
      .field-arrow { transform: rotate(90deg); margin: 4px 0; }
      .conflict-item-header { flex-direction: column; align-items: flex-start; }
      .sync-alert { flex-direction: column; align-items: stretch; gap: 10px; }
      .sync-alert-actions { justify-content: flex-end; }
      .editing-alert { flex-direction: column; gap: 10px; }
    }
  `],
})
export class App {
  private mealPrepService: MealPrepService;
  elders: Elder[] = [
    { id: crypto.randomUUID(), name: '苏阿姨', preference: '少盐软饭', mealTags: ['low-salt', 'soft-food'], address: '松桂里3栋201', contact: '女儿13800001111', note: '午餐需敲门等候', deliveryDays: [1, 2, 3, 4, 5], pauseDates: [], specialMealNote: '' },
    { id: crypto.randomUUID(), name: '何叔叔', preference: '糖尿病餐', mealTags: ['diabetic'], address: '松桂里5栋104', contact: '邻居王姐', note: '行动慢，放门口需电话确认', deliveryDays: [1, 2, 3, 4, 5], pauseDates: [], specialMealNote: '少糖' },
    { id: crypto.randomUUID(), name: '林奶奶', preference: '素食', mealTags: ['vegetarian'], address: '梧桐巷12号', contact: '儿子13900002222', note: '周三加汤', deliveryDays: [1, 3, 5], pauseDates: [], specialMealNote: '' }
  ];

  volunteers: Volunteer[] = [
    { id: crypto.randomUUID(), name: '小赵', phone: '13600003333', capacity: 4, area: '松桂里', availableDays: [1, 2, 3, 4, 5] },
    { id: crypto.randomUUID(), name: '陈姐', phone: '13700004444', capacity: 3, area: '梧桐巷', availableDays: [1, 3, 5] }
  ];

  tasks: MealTask[] = [];
  taskDate = today;
  kanbanSort: KanbanSortMap = {};
  appViewMode: 'schedule' | 'delivery' = 'schedule';
  selectedDeliveryVolunteerId: string = '';
  private deliveryService: VolunteerDeliveryService | null = null;
  elderForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5], pauseDates: [], specialMealNote: '' };
  volunteerForm: Omit<Volunteer, 'id'> = { name: '', phone: '', capacity: 3, area: '', availableDays: [1, 2, 3, 4, 5] };
  editingElderId: string | null = null;
  elderEditForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5], pauseDates: [], specialMealNote: '' };
  weeklyScheduleStart: string = this.getWeekStart(today);
  weeklyScheduleResult: WeeklyScheduleResult | null = null;
  showWeeklySchedulePanel = false;
  WEEK_DAYS = WEEK_DAYS;
  today = today;

  mealTags: MealTag[] = [...PRESET_TAGS];
  newTagName = '';
  editingTagId: string | null = null;
  editingTagName = '';

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
    result: ''
  };
  exceptionListFilter: ExceptionStatus | '全部' = '全部';
  exceptionListDate = '';
  exceptionListElderId = '';
  exceptionHistoryVisible = false;
  exceptionHistoryElderId = '';
  exceptionHistoryDate = '';

  phoneNotifications: PhoneNotification[] = [];
  phoneNotificationTab: 'all' | 'elder' | 'volunteer' = 'all';
  editingNotificationId: string | null = null;
  editingNotificationRemark: string = '';

  importExportPanelVisible = false;
  importTab: 'export' | 'import' = 'export';
  importPreview: ImportPreview | null = null;
  importError: ImportError | null = null;
  importedData: BackupData | null = null;
  importSuccess = false;

  private readonly BACKUP_VERSION = '1.0.0';

  EXCEPTION_CATEGORIES: ExceptionCategory[] = ['无人应答', '地址错误', '老人拒收', '餐食问题', '配送延误', '老人身体不适', '其他'];
  EXCEPTION_SEVERITIES: ExceptionSeverity[] = ['一般', '较重', '紧急'];
  EXCEPTION_STATUSES: ExceptionStatus[] = ['待处理', '处理中', '已解决'];

  NOTIFICATION_STATUSES: NotificationStatus[] = ['未通知', '已通知', '未接通', '稍后再拨'];

  // ===== 多窗口数据一致性 =====
  readonly SYNC_DATA_TYPES: SyncDataType[] = ['elders', 'volunteers', 'tasks', 'exceptionRecords'];
  private readonly LS_VERSIONS_KEY = 'zfl-4-sync-versions';
  private readonly WINDOW_ID = crypto.randomUUID().slice(0, 8);
  private readonly LS_WRITER_KEY = 'zfl-4-last-writer';

  localVersions: DataVersionMap = { elders: 0, volunteers: 0, tasks: 0, exceptionRecords: 0 };
  lastSyncSnapshot: DataSnapshot = { elders: [], volunteers: [], tasks: [], exceptionRecords: [] };

  syncNotification: SyncNotification = {
    status: 'idle',
    remoteVersions: { elders: 0, volunteers: 0, tasks: 0, exceptionRecords: 0 },
    conflictSummary: null,
    pendingRemoteData: null
  };

  syncPanelVisible = false;
  syncPanelTab: 'summary' | 'elders' | 'volunteers' | 'tasks' | 'exceptionRecords' = 'summary';
  mergeSelections: Record<SyncDataType, Record<string, 'keep' | 'adopt'>> = {
    elders: {}, volunteers: {}, tasks: {}, exceptionRecords: {}
  };
  // ==============================

  get selectedElderForVisit(): Elder | undefined {
    return this.elders.find((e) => e.id === this.selectedElderIdForVisit);
  }

  getWeekStart(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const monday = new Date(date);
    monday.setDate(diff + (day === 0 ? -6 : 1));
    return monday.toISOString().slice(0, 10);
  }

  getWeekDates(weekStart: string): string[] {
    const dates: string[] = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  getDayOfWeek(dateStr: string): number {
    return new Date(dateStr).getDay();
  }

  isElderPaused(elderId: string, date: string): boolean {
    const elder = this.elders.find((e) => e.id === elderId);
    return elder?.pauseDates.includes(date) || false;
  }

  isElderScheduled(elderId: string, date: string): boolean {
    const elder = this.elders.find((e) => e.id === elderId);
    if (!elder) return false;
    const dayOfWeek = this.getDayOfWeek(date);
    return elder.deliveryDays.includes(dayOfWeek);
  }

  isVolunteerAvailable(volunteerId: string, date: string): boolean {
    const volunteer = this.volunteers.find((v) => v.id === volunteerId);
    if (!volunteer) return false;
    const dayOfWeek = this.getDayOfWeek(date);
    return volunteer.availableDays.includes(dayOfWeek);
  }

  toggleElderDeliveryDay(day: number) {
    const idx = this.elderForm.deliveryDays.indexOf(day);
    if (idx > -1) {
      this.elderForm.deliveryDays = this.elderForm.deliveryDays.filter((d) => d !== day);
    } else {
      this.elderForm.deliveryDays = [...this.elderForm.deliveryDays, day].sort();
    }
  }

  toggleElderEditDeliveryDay(day: number) {
    const idx = this.elderEditForm.deliveryDays.indexOf(day);
    if (idx > -1) {
      this.elderEditForm.deliveryDays = this.elderEditForm.deliveryDays.filter((d) => d !== day);
    } else {
      this.elderEditForm.deliveryDays = [...this.elderEditForm.deliveryDays, day].sort();
    }
  }

  toggleVolunteerAvailableDay(day: number) {
    const idx = this.volunteerForm.availableDays.indexOf(day);
    if (idx > -1) {
      this.volunteerForm.availableDays = this.volunteerForm.availableDays.filter((d) => d !== day);
    } else {
      this.volunteerForm.availableDays = [...this.volunteerForm.availableDays, day].sort();
    }
  }

  addPauseDate(elderId: string, date: string) {
    const elder = this.elders.find((e) => e.id === elderId);
    if (elder && !elder.pauseDates.includes(date)) {
      elder.pauseDates = [...elder.pauseDates, date].sort();
      this.save();
    }
  }

  removePauseDate(elderId: string, date: string) {
    const elder = this.elders.find((e) => e.id === elderId);
    if (elder) {
      elder.pauseDates = elder.pauseDates.filter((d) => d !== date);
      this.save();
    }
  }

  constructor(@Inject(MealPrepService) mealPrepService: MealPrepService) {
    this.mealPrepService = mealPrepService;
    this.load();
    this.loadKanbanSort();
    this.loadVisits();
    this.loadMealTags();
    this.loadExceptions();
    this.loadPhoneNotifications();
    this.initSyncState();
    this.setupStorageListener();
    if (this.tasks.length === 0) this.generateTasks();
  }

  // ===== 多窗口数据一致性：初始化 =====
  private initSyncState() {
    const rawVersions = localStorage.getItem(this.LS_VERSIONS_KEY);
    if (rawVersions) {
      try {
        this.localVersions = JSON.parse(rawVersions);
      } catch {
        this.localVersions = { elders: Date.now(), volunteers: Date.now(), tasks: Date.now(), exceptionRecords: Date.now() };
      }
    } else {
      this.localVersions = { elders: Date.now(), volunteers: Date.now(), tasks: Date.now(), exceptionRecords: Date.now() };
    }
    this.updateSyncSnapshot();
  }

  private updateSyncSnapshot() {
    this.lastSyncSnapshot = {
      elders: JSON.parse(JSON.stringify(this.elders)),
      volunteers: JSON.parse(JSON.stringify(this.volunteers)),
      tasks: JSON.parse(JSON.stringify(this.tasks)),
      exceptionRecords: JSON.parse(JSON.stringify(this.exceptionRecords))
    };
  }

  private setupStorageListener() {
    window.addEventListener('storage', (e) => this.handleStorageEvent(e));
  }

  private handleStorageEvent(e: StorageEvent) {
    if (e.key === this.LS_VERSIONS_KEY && e.newValue) {
      const writer = localStorage.getItem(this.LS_WRITER_KEY);
      if (writer === this.WINDOW_ID) return;
      try {
        const remoteVersions: DataVersionMap = JSON.parse(e.newValue);
        this.checkRemoteChanges(remoteVersions);
      } catch {}
    }
  }

  private checkRemoteChanges(remoteVersions: DataVersionMap) {
    const changedTypes = this.SYNC_DATA_TYPES.filter(t => remoteVersions[t] > this.localVersions[t]);
    if (changedTypes.length === 0) return;

    const remoteData: DataSnapshot = {
      elders: changedTypes.includes('elders') ? this.loadRemoteData('elders') : [...this.lastSyncSnapshot.elders],
      volunteers: changedTypes.includes('volunteers') ? this.loadRemoteData('volunteers') : [...this.lastSyncSnapshot.volunteers],
      tasks: changedTypes.includes('tasks') ? this.loadRemoteData('tasks') : [...this.lastSyncSnapshot.tasks],
      exceptionRecords: changedTypes.includes('exceptionRecords') ? this.loadRemoteData('exceptionRecords') : [...this.lastSyncSnapshot.exceptionRecords]
    };

    const hasLocalChanges = this.hasUnsavedLocalChanges();

    if (!hasLocalChanges) {
      this.applyRemoteData(remoteData, remoteVersions, changedTypes);
    } else {
      const conflictSummary = this.buildConflictSummary(remoteData);
      const hasConflicts = this.SYNC_DATA_TYPES.some(t => conflictSummary[t].length > 0);

      this.syncNotification = {
        status: hasConflicts ? 'conflict' : 'remote-changes',
        remoteVersions,
        conflictSummary: hasConflicts ? conflictSummary : null,
        pendingRemoteData: remoteData
      };
    }
  }

  private loadRemoteData<T>(type: SyncDataType): T[] {
    const keyMap: Record<SyncDataType, string> = {
      elders: 'zfl-4-elders',
      volunteers: 'zfl-4-volunteers',
      tasks: 'zfl-4-tasks',
      exceptionRecords: 'zfl-4-exceptions'
    };
    const raw = localStorage.getItem(keyMap[type]);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private hasUnsavedLocalChanges(): boolean {
    return this.hasSyncEditingItems() || this.SYNC_DATA_TYPES.some(t => !this.deepEqual(
      this[t as keyof DataSnapshot] as any[],
      this.lastSyncSnapshot[t] as any[]
    ));
  }

  private hasSyncEditingItems(): boolean {
    return !!this.editingElderId;
  }

  private deepEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    const mapB = new Map(b.map(x => [x.id, x]));
    for (const item of a) {
      const match = mapB.get(item.id);
      if (!match) return false;
      if (JSON.stringify(item) !== JSON.stringify(match)) return false;
    }
    return true;
  }

  private applyRemoteData(remoteData: DataSnapshot, remoteVersions: DataVersionMap, types: SyncDataType[]) {
    for (const t of types) {
      (this as any)[t] = (remoteData[t] as any[]).map((x: any) => ({ ...x }));
      this.localVersions[t] = remoteVersions[t];
    }
    this.updateSyncSnapshot();
    this.persistVersions();
  }

  private buildConflictSummary(remote: DataSnapshot): ConflictSummary {
    const local = this.getLocalConflictSnapshot();
    return {
      elders: this.compareArrays(local.elders, remote.elders, this.lastSyncSnapshot.elders, 'elders', (e) => e.name),
      volunteers: this.compareArrays(local.volunteers, remote.volunteers, this.lastSyncSnapshot.volunteers, 'volunteers', (v) => v.name),
      tasks: this.compareArrays(local.tasks, remote.tasks, this.lastSyncSnapshot.tasks, 'tasks', (t) => `${this.elderName(t.elderId)}(${t.date})`),
      exceptionRecords: this.compareArrays(local.exceptionRecords, remote.exceptionRecords, this.lastSyncSnapshot.exceptionRecords, 'exceptionRecords', (e) => `${this.elderName(e.elderId)}·${e.category}`)
    };
  }

  private getLocalConflictSnapshot(): DataSnapshot {
    return {
      elders: this.getEldersWithEditDraft(),
      volunteers: this.volunteers,
      tasks: this.tasks,
      exceptionRecords: this.exceptionRecords
    };
  }

  private getEldersWithEditDraft(): Elder[] {
    if (!this.editingElderId) return this.elders;
    return this.elders.map(e => e.id === this.editingElderId ? { id: e.id, ...this.elderEditForm } : e);
  }

  private compareArrays<T extends { id: string }>(
    local: T[], remote: T[], base: T[],
    type: SyncDataType,
    labelFn: (item: T) => string
  ): ItemConflict[] {
    const conflicts: ItemConflict[] = [];
    const localMap = new Map(local.map(x => [x.id, x]));
    const remoteMap = new Map(remote.map(x => [x.id, x]));
    const baseMap = new Map(base.map(x => [x.id, x]));
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    for (const id of allIds) {
      const l = localMap.get(id);
      const r = remoteMap.get(id);
      const b = baseMap.get(id);
      const editing = this.isItemEditing(type, id);
      const editingType = editing ? this.getEditingTypeLabel(type) : null;

      if (l && !r) {
        conflicts.push({ id, label: labelFn(l), type, fields: [], localOnly: true, remoteOnly: false, isEditing: editing, editingType });
        continue;
      }
      if (!l && r) {
        conflicts.push({ id, label: labelFn(r), type, fields: [], localOnly: false, remoteOnly: true, isEditing: editing, editingType });
        continue;
      }
      if (l && r) {
        const localChanged = !b || JSON.stringify(l) !== JSON.stringify(b);
        const remoteChanged = !b || JSON.stringify(r) !== JSON.stringify(b);
        const editingConflict = editing && remoteChanged;
        if ((localChanged && remoteChanged && JSON.stringify(l) !== JSON.stringify(r)) || editingConflict) {
          const fields = this.findDiffFields(l, r);
          if (fields.length > 0) {
            conflicts.push({ id, label: labelFn(l), type, fields, localOnly: false, remoteOnly: false, isEditing: editing, editingType });
          }
        }
      }
    }
    return conflicts;
  }

  private findDiffFields<T extends Record<string, any>>(a: T, b: T): ConflictField[] {
    const fields: ConflictField[] = [];
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const va = a[key];
      const vb = b[key];
      if (JSON.stringify(va) !== JSON.stringify(vb)) {
        fields.push({ field: key, localValue: va, remoteValue: vb });
      }
    }
    return fields;
  }

  private persistVersions() {
    localStorage.setItem(this.LS_VERSIONS_KEY, JSON.stringify(this.localVersions));
  }

  private bumpVersion(type: SyncDataType) {
    this.localVersions[type] = Date.now() + Math.floor(Math.random() * 1000);
    this.persistVersions();
    localStorage.setItem(this.LS_WRITER_KEY, this.WINDOW_ID);
  }

  openSyncPanel() {
    if (this.syncNotification.status === 'idle') return;
    this.syncPanelVisible = true;
    this.syncPanelTab = 'summary';
    this.initMergeSelections();
  }

  closeSyncPanel() {
    this.syncPanelVisible = false;
  }

  private initMergeSelections() {
    if (!this.syncNotification.conflictSummary) return;
    for (const type of this.SYNC_DATA_TYPES) {
      this.mergeSelections[type] = {};
      for (const c of this.syncNotification.conflictSummary[type]) {
        this.mergeSelections[type][c.id] = 'keep';
      }
    }
  }

  get syncSummaryCounts() {
    const s = this.syncNotification;
    const counts = { elders: 0, volunteers: 0, tasks: 0, exceptionRecords: 0, total: 0 };
    if (s.conflictSummary) {
      for (const t of this.SYNC_DATA_TYPES) {
        counts[t] = s.conflictSummary[t].length;
        counts.total += counts[t];
      }
    } else if (s.pendingRemoteData) {
      for (const t of this.SYNC_DATA_TYPES) {
        const remoteLen = (s.pendingRemoteData[t] as any[]).length;
        const baseLen = (this.lastSyncSnapshot[t] as any[]).length;
        counts[t] = Math.abs(remoteLen - baseLen);
        counts.total += counts[t];
      }
    }
    return counts;
  }

  adoptAllRemote() {
    if (!this.syncNotification.pendingRemoteData) return;
    const rd = this.syncNotification.pendingRemoteData;
    const rv = this.syncNotification.remoteVersions;
    this.applyRemoteData(rd, rv, this.SYNC_DATA_TYPES);
    this.resetSyncNotification();
    this.syncPanelVisible = false;
  }

  keepAllLocal() {
    this.SYNC_DATA_TYPES.forEach(t => this.bumpVersion(t));
    this.updateSyncSnapshot();
    this.resetSyncNotification();
    this.syncPanelVisible = false;
  }

  applyMergeByType(type: SyncDataType) {
    if (!this.syncNotification.pendingRemoteData || !this.syncNotification.conflictSummary) return;
    const conflicts = this.syncNotification.conflictSummary[type];
    const remoteArr = (this.syncNotification.pendingRemoteData[type] as any[]).slice();
    const result: any[] = [];
    const processedIds = new Set<string>();

    for (const c of conflicts) {
      processedIds.add(c.id);
      const choice = this.mergeSelections[type][c.id];
      if (c.localOnly) {
        if (choice === 'keep') result.push(...(this as any)[type].filter((x: any) => x.id === c.id));
      } else if (c.remoteOnly) {
        if (choice === 'adopt') result.push(...remoteArr.filter((x: any) => x.id === c.id));
      } else {
        if (choice === 'keep') {
          result.push(...(this as any)[type].filter((x: any) => x.id === c.id));
        } else {
          result.push(...remoteArr.filter((x: any) => x.id === c.id));
        }
      }
    }

    const remoteMap = new Map(remoteArr.map(x => [x.id, x]));
    const localMap = new Map((this as any)[type].map((x: any) => [x.id, x]));
    const allNonConflict = new Set([...remoteMap.keys(), ...localMap.keys()]);
    for (const id of allNonConflict) {
      if (processedIds.has(id)) continue;
      if (remoteMap.has(id)) result.push(remoteMap.get(id));
      else if (localMap.has(id)) result.push(localMap.get(id));
    }

    (this as any)[type] = result;
    this.localVersions[type] = this.syncNotification.remoteVersions[type];
    this.updateSyncSnapshot();
  }

  applyFullMerge() {
    for (const t of this.SYNC_DATA_TYPES) {
      this.applyMergeByType(t);
    }
    this.persistVersions();
    this.resetSyncNotification();
    this.syncPanelVisible = false;
  }

  private resetSyncNotification() {
    this.syncNotification = {
      status: 'idle',
      remoteVersions: { elders: 0, volunteers: 0, tasks: 0, exceptionRecords: 0 },
      conflictSummary: null,
      pendingRemoteData: null
    };
  }

  formatValue(v: any): string {
    if (v === null || v === undefined) return '（空）';
    if (Array.isArray(v)) return v.length > 0 ? `[${v.join(', ')}]` : '（空数组）';
    if (typeof v === 'boolean') return v ? '是' : '否';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  fieldLabel(type: SyncDataType, field: string): string {
    const labels: Record<string, Record<string, string>> = {
      elders: { name: '姓名', preference: '餐食偏好', address: '地址', contact: '联系方式', note: '备注', mealTags: '餐食标签', deliveryDays: '送餐日期', pauseDates: '暂停日期', specialMealNote: '特殊备注' },
      volunteers: { name: '姓名', phone: '电话', capacity: '每日容量', area: '片区', availableDays: '可服务日期' },
      tasks: { volunteerId: '志愿者', status: '状态', exception: '异常描述', isManuallyModified: '手动标记', specialMealNote: '特殊餐食备注', elderId: '老人', date: '日期' },
      exceptionRecords: { category: '分类', severity: '严重程度', description: '描述', handler: '负责人', status: '状态', result: '处理结果', updatedAt: '更新时间' }
    };
    return labels[type]?.[field] || field;
  }

  getTabConflicts(tab: string): ItemConflict[] {
    if (!this.syncNotification.conflictSummary) return [];
    const type = tab as SyncDataType;
    return (this.syncNotification.conflictSummary[type] as ItemConflict[]) || [];
  }

  getTabConflictCount(tab: string): number {
    return this.getTabConflicts(tab).length;
  }

  getMergeSelection(tab: string, itemId: string): 'keep' | 'adopt' {
    const type = tab as SyncDataType;
    return this.mergeSelections[type]?.[itemId] || 'keep';
  }

  setMergeSelection(tab: string, itemId: string, value: 'keep' | 'adopt') {
    const type = tab as SyncDataType;
    if (!this.mergeSelections[type]) this.mergeSelections[type] = {};
    this.mergeSelections[type][itemId] = value;
  }

  getDataTypeLabel(tab: string): string {
    const map: Record<string, string> = {
      elders: '老人档案', volunteers: '志愿者', tasks: '送餐任务', exceptionRecords: '异常记录'
    };
    return map[tab] || tab;
  }

  getSyncTypeCount(tab: string): number {
    const t = tab as SyncDataType;
    const s = this.syncNotification;
    if (s.conflictSummary) {
      return s.conflictSummary[t]?.length || 0;
    } else if (s.pendingRemoteData) {
      const remoteLen = (s.pendingRemoteData[t] as any[]).length;
      const baseLen = (this.lastSyncSnapshot[t] as any[]).length;
      return Math.abs(remoteLen - baseLen);
    }
    return 0;
  }

  getBadgeCount(tab: string): number {
    if (tab === 'summary') {
      return this.syncSummaryCounts.total;
    }
    return this.getSyncTypeCount(tab);
  }

  getEditingItems(): EditingStateItem[] {
    const items: EditingStateItem[] = [];
    if (this.editingElderId) {
      const elder = this.elders.find(e => e.id === this.editingElderId);
      if (elder) {
        items.push({ type: 'elders', id: this.editingElderId, label: `老人档案 · ${elder.name}` });
      }
    }
    if (this.editingTagId) {
      const tag = this.mealTags.find(t => t.id === this.editingTagId);
      if (tag) {
        items.push({ type: 'mealTag', id: this.editingTagId, label: `餐食标签 · ${tag.name}` });
      }
    }
    if (this.editingNotificationId) {
      const notif = this.phoneNotifications.find(n => n.id === this.editingNotificationId);
      if (notif) {
        const targetName = notif.targetType === 'elder'
          ? this.elders.find(e => e.id === notif.targetId)?.name
          : this.volunteers.find(v => v.id === notif.targetId)?.name;
        items.push({ type: 'phoneNotification', id: this.editingNotificationId, label: `通知备注 · ${targetName || '未知'}` });
      }
    }
    return items;
  }

  hasEditingItems(): boolean {
    return this.getEditingItems().length > 0;
  }

  getEditingConflictItems(): EditingStateItem[] {
    const editing = this.getEditingItems();
    const s = this.syncNotification;
    if (!s.conflictSummary) return [];
    return editing.filter(ei => {
      if (ei.type === 'mealTag' || ei.type === 'phoneNotification') return false;
      return s.conflictSummary![ei.type].some(c => c.id === ei.id);
    });
  }

  hasEditingConflicts(): boolean {
    return this.getEditingConflictItems().length > 0;
  }

  isItemEditing(type: SyncDataType, id: string): boolean {
    if (type === 'elders' && this.editingElderId === id) return true;
    return false;
  }

  getEditingTypeLabel(type: SyncDataType | 'mealTag' | 'phoneNotification'): string {
    const labels: Record<string, string> = {
      elders: '老人档案',
      volunteers: '志愿者',
      tasks: '送餐任务',
      exceptionRecords: '异常记录',
      mealTag: '餐食标签',
      phoneNotification: '电话通知'
    };
    return labels[type] || type;
  }

  getEditingSyncTip(): string {
    const editing = this.getEditingItems();
    const conflicts = this.getEditingConflictItems();
    if (conflicts.length > 0) {
      const names = conflicts.map(c => c.label).join('、');
      return `注意：正在编辑的「${names}」同时被其他窗口修改`;
    }
    if (editing.length > 0) {
      const names = editing.map(e => e.label).join('、');
      return `正在编辑：${names}`;
    }
    return '';
  }

  hasEditingConflictInType(type: SyncDataType): boolean {
    return this.getEditingConflictItems().some(x => x.type === type);
  }
  // ===== 多窗口一致性结束 =====

  addElder() {
    if (!this.elderForm.name.trim()) return;
    this.elders = [{ id: crypto.randomUUID(), ...this.elderForm }, ...this.elders];
    this.elderForm = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '', deliveryDays: [1, 2, 3, 4, 5], pauseDates: [], specialMealNote: '' };
    this.save();
  }

  addVolunteer() {
    if (!this.volunteerForm.name.trim()) return;
    this.volunteers = [{ id: crypto.randomUUID(), ...this.volunteerForm, capacity: Number(this.volunteerForm.capacity || 1) }, ...this.volunteers];
    this.volunteerForm = { name: '', phone: '', capacity: 3, area: '', availableDays: [1, 2, 3, 4, 5] };
    this.save();
  }

  startEditElder(elder: Elder) {
    this.editingElderId = elder.id;
    this.elderEditForm = { ...elder };
  }

  cancelEditElder() {
    this.editingElderId = null;
  }

  saveEditElder() {
    if (!this.elderEditForm.name.trim() || !this.editingElderId) return;
    this.elders = this.elders.map((e) => e.id === this.editingElderId ? { ...e, ...this.elderEditForm } : e);
    this.editingElderId = null;
    this.save();
  }

  generateTasks() {
    const existing = new Set(this.tasks.filter((task) => task.date === this.taskDate).map((task) => task.elderId));
    const created = this.elders
      .filter((elder) => !existing.has(elder.id) && this.isElderScheduled(elder.id, this.taskDate) && !this.isElderPaused(elder.id, this.taskDate))
      .map((elder) => ({ id: crypto.randomUUID(), elderId: elder.id, date: this.taskDate, volunteerId: '', status: '待分配' as const, exception: '', isManuallyModified: false, specialMealNote: elder.specialMealNote }));
    this.tasks = [...created, ...this.tasks];
    this.save();
    this.generatePhoneNotificationsForDate(this.taskDate);
  }

  generateWeeklySchedule() {
    const weekDates = this.getWeekDates(this.weeklyScheduleStart);
    const generatedTasks: MealTask[] = [];
    const assignedTasks: AutoAssignEntry[] = [];
    const failures: ScheduleFailure[] = [];
    const skippedManualTasks: string[] = [];
    const takenOverTasks: MealTask[] = [];

    const dailyLoad = new Map<string, Map<string, number>>();
    for (const date of weekDates) {
      dailyLoad.set(date, new Map());
      for (const v of this.volunteers) {
        dailyLoad.get(date)!.set(v.id, this.tasks.filter((t) => t.date === date && t.volunteerId === v.id).length);
      }
    }

    for (const date of weekDates) {
      const dayOfWeek = this.getDayOfWeek(date);
      const existingTasksForDate = this.tasks.filter((t) => t.date === date);
      const existingTaskMap = new Map(existingTasksForDate.map((t) => [t.elderId, t]));
      const manuallyModifiedElderIds = new Set(existingTasksForDate.filter((t) => t.isManuallyModified).map((t) => t.elderId));

      for (const elder of this.elders) {
        if (manuallyModifiedElderIds.has(elder.id)) {
          skippedManualTasks.push(`${elder.name} (${date})`);
          continue;
        }

        if (elder.pauseDates.includes(date)) {
          failures.push({
            elderId: elder.id,
            elderName: elder.name,
            date,
            reason: 'paused',
            reasonText: '老人设置了暂停送餐'
          });
          continue;
        }

        if (!elder.deliveryDays.includes(dayOfWeek)) {
          continue;
        }

        const existingTask = existingTaskMap.get(elder.id);

        const availableVolunteers = this.volunteers
          .filter((v) => v.availableDays.includes(dayOfWeek))
          .filter((v) => {
            const load = dailyLoad.get(date)!.get(v.id) || 0;
            return load < v.capacity;
          })
          .filter((v) => !v.area.trim() || !elder.address.trim() || elder.address.includes(v.area))
          .sort((a, b) => {
            const loadA = dailyLoad.get(date)!.get(a.id) || 0;
            const loadB = dailyLoad.get(date)!.get(b.id) || 0;
            const remainA = a.capacity - loadA;
            const remainB = b.capacity - loadB;
            if (remainA !== remainB) return remainB - remainA;
            return loadA - loadB;
          });

        if (existingTask) {
          if (existingTask.volunteerId) {
            takenOverTasks.push(existingTask);
            const existingVolunteer = this.volunteers.find((v) => v.id === existingTask.volunteerId);
            if (existingVolunteer) {
              assignedTasks.push({
                taskId: existingTask.id,
                elderId: elder.id,
                elderName: elder.name,
                elderAddress: elder.address,
                volunteerId: existingVolunteer.id,
                volunteerName: existingVolunteer.name
              });
            }
            continue;
          }

          if (availableVolunteers.length === 0) {
            const matchingAreaVolunteers = this.volunteers.filter((v) =>
              v.availableDays.includes(dayOfWeek) && v.area.trim() && elder.address.trim() && elder.address.includes(v.area)
            );

            let reason = '';
            if (matchingAreaVolunteers.length > 0) {
              const allFull = matchingAreaVolunteers.every((v) => {
                const load = dailyLoad.get(date)!.get(v.id) || 0;
                return load >= v.capacity;
              });
              reason = allFull
                ? `片区匹配的志愿者（${matchingAreaVolunteers.map(v => v.name).join('、')}）当日均已满载`
                : `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
              failures.push({
                elderId: elder.id,
                elderName: elder.name,
                date,
                reason: allFull ? 'capacity_full' : 'no_volunteer',
                reasonText: reason
              });
            } else if (!this.volunteers.some((v) => v.availableDays.includes(dayOfWeek))) {
              reason = `${WEEK_DAYS[dayOfWeek]}无可用志愿者`;
              failures.push({
                elderId: elder.id,
                elderName: elder.name,
                date,
                reason: 'no_volunteer',
                reasonText: reason
              });
            } else {
              reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
              failures.push({
                elderId: elder.id,
                elderName: elder.name,
                date,
                reason: 'no_volunteer',
                reasonText: reason
              });
            }
            continue;
          }

          const chosen = availableVolunteers[0];
          existingTask.volunteerId = chosen.id;
          existingTask.status = '配送中';
          existingTask.specialMealNote = elder.specialMealNote;
          takenOverTasks.push(existingTask);
          assignedTasks.push({
            taskId: existingTask.id,
            elderId: elder.id,
            elderName: elder.name,
            elderAddress: elder.address,
            volunteerId: chosen.id,
            volunteerName: chosen.name
          });

          const currentLoad = dailyLoad.get(date)!.get(chosen.id) || 0;
          dailyLoad.get(date)!.set(chosen.id, currentLoad + 1);
          continue;
        }

        if (availableVolunteers.length === 0) {
          const matchingAreaVolunteers = this.volunteers.filter((v) =>
            v.availableDays.includes(dayOfWeek) && v.area.trim() && elder.address.trim() && elder.address.includes(v.area)
          );

          let reason = '';
          if (matchingAreaVolunteers.length > 0) {
            const allFull = matchingAreaVolunteers.every((v) => {
              const load = dailyLoad.get(date)!.get(v.id) || 0;
              return load >= v.capacity;
            });
            reason = allFull
              ? `片区匹配的志愿者（${matchingAreaVolunteers.map(v => v.name).join('、')}）当日均已满载`
              : `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
            failures.push({
              elderId: elder.id,
              elderName: elder.name,
              date,
              reason: allFull ? 'capacity_full' : 'no_volunteer',
              reasonText: reason
            });
          } else if (!this.volunteers.some((v) => v.availableDays.includes(dayOfWeek))) {
            reason = `${WEEK_DAYS[dayOfWeek]}无可用志愿者`;
            failures.push({
              elderId: elder.id,
              elderName: elder.name,
              date,
              reason: 'no_volunteer',
              reasonText: reason
            });
          } else {
            reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
            failures.push({
              elderId: elder.id,
              elderName: elder.name,
              date,
              reason: 'no_volunteer',
              reasonText: reason
            });
          }
          continue;
        }

        const chosen = availableVolunteers[0];
        const newTask: MealTask = {
          id: crypto.randomUUID(),
          elderId: elder.id,
          date,
          volunteerId: chosen.id,
          status: '配送中' as const,
          exception: '',
          isManuallyModified: false,
          specialMealNote: elder.specialMealNote
        };
        generatedTasks.push(newTask);
        assignedTasks.push({
          taskId: newTask.id,
          elderId: elder.id,
          elderName: elder.name,
          elderAddress: elder.address,
          volunteerId: chosen.id,
          volunteerName: chosen.name
        });

        const currentLoad = dailyLoad.get(date)!.get(chosen.id) || 0;
        dailyLoad.get(date)!.set(chosen.id, currentLoad + 1);
      }
    }

    this.tasks = [...generatedTasks, ...this.tasks];
    this.save();

    for (const date of weekDates) {
      this.generatePhoneNotificationsForDate(date);
      const dateSort = this.kanbanSort[date];
      if (!dateSort) {
        this.kanbanSort[date] = {};
      }
      const allAssignedForDate = assignedTasks.filter((a) => {
        const t = generatedTasks.find((gt) => gt.id === a.taskId) || takenOverTasks.find((tt) => tt.id === a.taskId);
        return t?.date === date;
      });
      for (const entry of allAssignedForDate) {
        if (!this.kanbanSort[date][entry.volunteerId]) {
          this.kanbanSort[date][entry.volunteerId] = this.tasks
            .filter((t) => t.date === date && t.volunteerId === entry.volunteerId)
            .map((t) => t.id);
        } else if (!this.kanbanSort[date][entry.volunteerId].includes(entry.taskId)) {
          this.kanbanSort[date][entry.volunteerId].push(entry.taskId);
        }
      }
    }
    this.saveKanbanSort();

    this.weeklyScheduleResult = {
      weekStart: weekDates[0],
      weekEnd: weekDates[6],
      generatedTasks,
      takenOverTasks,
      assignedTasks,
      failures,
      skippedManualTasks
    };
  }

  getWeeklyDayColumns(): WeeklyDayColumn[] {
    const weekDates = this.getWeekDates(this.weeklyScheduleStart);
    return weekDates.map((date) => {
      const dayOfWeek = this.getDayOfWeek(date);
      return {
        date,
        dayName: WEEK_DAYS[dayOfWeek],
        dayOfWeek,
        tasks: this.tasks.filter((t) => t.date === date),
        failures: this.weeklyScheduleResult?.failures.filter((f) => f.date === date) || []
      };
    });
  }

  openWeeklySchedulePanel() {
    this.showWeeklySchedulePanel = true;
    this.weeklyScheduleResult = null;
  }

  closeWeeklySchedulePanel() {
    this.showWeeklySchedulePanel = false;
  }

  prevWeek() {
    const current = new Date(this.weeklyScheduleStart);
    current.setDate(current.getDate() - 7);
    this.weeklyScheduleStart = this.getWeekStart(current.toISOString().slice(0, 10));
    this.weeklyScheduleResult = null;
  }

  nextWeek() {
    const current = new Date(this.weeklyScheduleStart);
    current.setDate(current.getDate() + 7);
    this.weeklyScheduleStart = this.getWeekStart(current.toISOString().slice(0, 10));
    this.weeklyScheduleResult = null;
  }

  goToCurrentWeek() {
    this.weeklyScheduleStart = this.getWeekStart(today);
    this.weeklyScheduleResult = null;
  }

  onWeekStartChange() {
    this.weeklyScheduleStart = this.getWeekStart(this.weeklyScheduleStart);
    this.weeklyScheduleResult = null;
  }

  getVolunteerName(volunteerId: string): string {
    return this.volunteers.find((v) => v.id === volunteerId)?.name || '未知';
  }

  filteredTasks() {
    return this.tasks.filter((task) => task.date === this.taskDate);
  }

  todayTasks() {
    return this.tasks.filter((task) => task.date === today);
  }

  exceptionTasks() {
    const resolvedTaskIds = new Set(this.exceptionRecords.filter((r) => r.status === '已解决').map((r) => r.taskId));
    return this.tasks.filter((task) => task.status === '异常' && !resolvedTaskIds.has(task.id));
  }

  assignTask(id: string, volunteerId: string) {
    const task = this.tasks.find((t) => t.id === id);
    const oldVolunteerId = task?.volunteerId;
    this.tasks = this.tasks.map((t) => t.id === id ? { ...t, volunteerId, status: volunteerId ? '配送中' : '待分配', isManuallyModified: true } : t);
    const dateSort = this.kanbanSort[this.taskDate];
    if (dateSort) {
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
        this.saveKanbanSort();
      }
    }
    this.save();
    this.generatePhoneNotificationsForDate(this.taskDate);
  }

  autoAssignTasks() {
    const dateTasks = this.filteredTasks();
    const unassigned = dateTasks.filter((t) => !t.volunteerId && t.status === '待分配' && !t.isManuallyModified);
    if (unassigned.length === 0) {
      this.autoAssignResult = { assigned: [], failed: [] };
      return;
    }

    const dayOfWeek = this.getDayOfWeek(this.taskDate);
    const currentLoad = new Map<string, number>();
    for (const v of this.volunteers) {
      currentLoad.set(v.id, this.assignedCount(v.id));
    }

    const assigned: AutoAssignEntry[] = [];
    const failed: AutoAssignFailure[] = [];

    for (const task of unassigned) {
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (!elder) {
        failed.push({ taskId: task.id, elderId: task.elderId, elderName: '未知老人', elderAddress: '', reason: '老人档案不存在' });
        continue;
      }

      const candidates = this.volunteers
        .filter((v) => v.availableDays.includes(dayOfWeek))
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
        const dayName = WEEK_DAYS[dayOfWeek];
        const matchingVolunteers = this.volunteers.filter((v) => v.area.trim() && elder.address.trim() && elder.address.includes(v.area));
        let reason = '';
        const availableVolunteers = this.volunteers.filter((v) => v.availableDays.includes(dayOfWeek));
        if (availableVolunteers.length === 0) {
          reason = `${dayName}无可用志愿者`;
        } else if (matchingVolunteers.length > 0) {
          const availableMatching = matchingVolunteers.filter((v) => v.availableDays.includes(dayOfWeek));
          if (availableMatching.length === 0) {
            reason = `片区匹配的志愿者${dayName}不值班`;
          } else {
            const fullNames = availableMatching
              .filter((v) => (currentLoad.get(v.id) || 0) >= v.capacity)
              .map((v) => v.name);
            if (fullNames.length === availableMatching.length) {
              reason = `片区匹配的志愿者（${fullNames.join('、')}）${dayName}均已满载`;
            } else {
              reason = `地址"${elder.address}"无法匹配任何志愿者的熟悉片区`;
            }
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
        t.id === task.id ? { ...t, volunteerId: chosen.id, status: '配送中' as const, isManuallyModified: false } : t
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
    this.generatePhoneNotificationsForDate(this.taskDate);
  }

  setStatus(id: string, status: MealTask['status']) {
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, status, exception: status === '异常' ? task.exception : '', isManuallyModified: true } : task);
    this.save();
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
      result: ''
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

  elderAddress(id: string) {
    return this.elders.find((elder) => elder.id === id)?.address || '';
  }

  elderPreference(id: string) {
    return this.elders.find((elder) => elder.id === id)?.preference || '';
  }

  kanbanGroups(): KanbanGroup[] {
    const dateTasks = this.filteredTasks();
    const dateSort = this.kanbanSort[this.taskDate] || {};
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
    if (!this.kanbanSort[this.taskDate]) this.kanbanSort[this.taskDate] = {};
    const dateSort = this.kanbanSort[this.taskDate];
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
    this.saveKanbanSort();
  }

  private saveKanbanSort() {
    localStorage.setItem('zfl-4-kanban-sort', JSON.stringify(this.kanbanSort));
  }

  private loadKanbanSort() {
    const raw = localStorage.getItem('zfl-4-kanban-sort');
    if (raw) this.kanbanSort = JSON.parse(raw);
  }

  private load() {
    const elders = localStorage.getItem('zfl-4-elders');
    const volunteers = localStorage.getItem('zfl-4-volunteers');
    const tasks = localStorage.getItem('zfl-4-tasks');
    if (elders) this.elders = JSON.parse(elders).map((e: Elder) => ({
      ...e,
      mealTags: e.mealTags || [],
      deliveryDays: e.deliveryDays || [1, 2, 3, 4, 5],
      pauseDates: e.pauseDates || [],
      specialMealNote: e.specialMealNote || ''
    }));
    if (volunteers) this.volunteers = JSON.parse(volunteers).map((v: Volunteer) => ({
      ...v,
      availableDays: v.availableDays || [1, 2, 3, 4, 5]
    }));
    if (tasks) this.tasks = JSON.parse(tasks).map((t: MealTask) => ({
      ...t,
      isManuallyModified: t.isManuallyModified || false,
      specialMealNote: t.specialMealNote || ''
    }));
  }

  private save() {
    localStorage.setItem('zfl-4-elders', JSON.stringify(this.elders));
    localStorage.setItem('zfl-4-volunteers', JSON.stringify(this.volunteers));
    localStorage.setItem('zfl-4-tasks', JSON.stringify(this.tasks));
    this.bumpVersion('elders');
    this.bumpVersion('volunteers');
    this.bumpVersion('tasks');
    this.updateSyncSnapshot();
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

  toggleElderEditTag(tagId: string) {
    const tags = this.elderEditForm.mealTags;
    if (tags.includes(tagId)) {
      this.elderEditForm = { ...this.elderEditForm, mealTags: tags.filter((t) => t !== tagId) };
    } else {
      this.elderEditForm = { ...this.elderEditForm, mealTags: [...tags, tagId] };
    }
  }

  removeEditPauseDate(date: string) {
    this.elderEditForm.pauseDates = this.elderEditForm.pauseDates.filter((d) => d !== date);
  }

  addEditPauseDate(input: HTMLInputElement) {
    const date = input.value;
    if (date && !this.elderEditForm.pauseDates.includes(date)) {
      this.elderEditForm.pauseDates = [...this.elderEditForm.pauseDates, date].sort();
      input.value = '';
    }
  }

  elderMealTags(elderId: string): MealTag[] {
    const elder = this.elders.find((e) => e.id === elderId);
    if (!elder) return [];
    return this.mealTags.filter((t) => (elder.mealTags || []).includes(t.id));
  }

  todayTagStats(): { tag: MealTag; count: number }[] {
    const todayTasks = this.filteredTasks();
    const tagCount = new Map<string, number>();
    for (const task of todayTasks) {
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (!elder) continue;
      for (const tagId of (elder.mealTags || [])) {
        tagCount.set(tagId, (tagCount.get(tagId) || 0) + 1);
      }
    }
    return this.mealTags
      .map((tag) => ({ tag, count: tagCount.get(tag.id) || 0 }))
      .filter((s) => s.count > 0);
  }

  private saveMealTags() {
    localStorage.setItem('zfl-4-meal-tags', JSON.stringify(this.mealTags));
  }

  private loadMealTags() {
    const raw = localStorage.getItem('zfl-4-meal-tags');
    if (raw) {
      const loaded = JSON.parse(raw);
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
    localStorage.setItem('zfl-4-exceptions', JSON.stringify(this.exceptionRecords));
    this.bumpVersion('exceptionRecords');
    this.updateSyncSnapshot();
  }

  private loadExceptions() {
    const raw = localStorage.getItem('zfl-4-exceptions');
    if (raw) this.exceptionRecords = JSON.parse(raw);
  }

  private saveVisits() {
    localStorage.setItem('zfl-4-visits', JSON.stringify(this.visitRecords));
  }

  private loadVisits() {
    const raw = localStorage.getItem('zfl-4-visits');
    if (raw) this.visitRecords = JSON.parse(raw);
  }

  private savePhoneNotifications() {
    localStorage.setItem('zfl-4-phone-notifications', JSON.stringify(this.phoneNotifications));
  }

  private loadPhoneNotifications() {
    const raw = localStorage.getItem('zfl-4-phone-notifications');
    if (raw) this.phoneNotifications = JSON.parse(raw);
  }

  private extractPhoneNumber(contact: string): string {
    const match = contact.match(/1[3-9]\d{9}/);
    return match ? match[0] : contact;
  }

  generatePhoneNotificationsForDate(date: string) {
    const dateTasks = this.tasks.filter((t) => t.date === date);
    const dateNotifications = this.phoneNotifications.filter((n) => n.date === date);
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newNotifications: PhoneNotification[] = [];
    const notificationsToKeep: string[] = [];

    for (const task of dateTasks) {
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (elder) {
        const elderNotif = dateNotifications.find((n) => n.taskId === task.id && n.targetType === 'elder');
        if (elderNotif) {
          notificationsToKeep.push(elderNotif.id);
        } else {
          newNotifications.push({
            id: crypto.randomUUID(),
            date,
            targetType: 'elder',
            targetId: elder.id,
            phone: this.extractPhoneNumber(elder.contact),
            taskId: task.id,
            notificationStatus: '未通知',
            remark: '',
            updatedAt: timeStr
          });
        }
      }

      const volNotif = dateNotifications.find((n) => n.taskId === task.id && n.targetType === 'volunteer');
      if (task.volunteerId) {
        const volunteer = this.volunteers.find((v) => v.id === task.volunteerId);
        if (volunteer) {
          if (volNotif && volNotif.targetId === task.volunteerId) {
            notificationsToKeep.push(volNotif.id);
          } else {
            newNotifications.push({
              id: crypto.randomUUID(),
              date,
              targetType: 'volunteer',
              targetId: volunteer.id,
              phone: volunteer.phone,
              taskId: task.id,
              notificationStatus: '未通知',
              remark: '',
              updatedAt: timeStr
            });
          }
        }
      }
    }

    const otherDateNotifications = this.phoneNotifications.filter((n) => n.date !== date);
    const keptDateNotifications = dateNotifications.filter((n) => notificationsToKeep.includes(n.id));
    this.phoneNotifications = [...newNotifications, ...keptDateNotifications, ...otherDateNotifications];
    if (newNotifications.length > 0 || keptDateNotifications.length !== dateNotifications.length) {
      this.savePhoneNotifications();
    }
  }

  phoneNotificationsForDate(): PhoneNotification[] {
    return this.phoneNotifications
      .filter((n) => n.date === this.taskDate)
      .filter((n) => {
        if (this.phoneNotificationTab === 'all') return true;
        return n.targetType === this.phoneNotificationTab;
      })
      .sort((a, b) => {
        const statusOrder = { '未通知': 0, '稍后再拨': 1, '未接通': 2, '已通知': 3 };
        if (statusOrder[a.notificationStatus] !== statusOrder[b.notificationStatus]) {
          return statusOrder[a.notificationStatus] - statusOrder[b.notificationStatus];
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  phoneNotificationTargetName(n: PhoneNotification): string {
    if (n.targetType === 'elder') {
      return this.elders.find((e) => e.id === n.targetId)?.name || '未知老人';
    }
    return this.volunteers.find((v) => v.id === n.targetId)?.name || '未知志愿者';
  }

  phoneNotificationTaskStatus(n: PhoneNotification): string {
    return this.tasks.find((t) => t.id === n.taskId)?.status || '';
  }

  phoneNotificationTargetLabel(n: PhoneNotification): string {
    return n.targetType === 'elder' ? '老人' : '志愿者';
  }

  setNotificationStatus(id: string, status: NotificationStatus) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.phoneNotifications = this.phoneNotifications.map((n) =>
      n.id === id ? { ...n, notificationStatus: status, updatedAt: timeStr } : n
    );
    this.savePhoneNotifications();
  }

  startEditNotificationRemark(id: string) {
    const n = this.phoneNotifications.find((x) => x.id === id);
    this.editingNotificationId = id;
    this.editingNotificationRemark = n?.remark || '';
  }

  saveNotificationRemark(id: string) {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.phoneNotifications = this.phoneNotifications.map((n) =>
      n.id === id ? { ...n, remark: this.editingNotificationRemark, updatedAt: timeStr } : n
    );
    this.editingNotificationId = null;
    this.editingNotificationRemark = '';
    this.savePhoneNotifications();
  }

  cancelEditNotificationRemark() {
    this.editingNotificationId = null;
    this.editingNotificationRemark = '';
  }

  notificationCountByStatus(status: NotificationStatus): number {
    return this.phoneNotifications.filter((n) => n.date === this.taskDate && n.notificationStatus === status).length;
  }

  notificationStatusColor(status: NotificationStatus): string {
    if (status === '已通知') return '#4a9f6d';
    if (status === '未接通') return '#c75454';
    if (status === '稍后再拨') return '#d9a84a';
    return '#8a9783';
  }

  get phoneNotificationsForCurrentDateCount(): number {
    return this.phoneNotifications.filter((n) => n.date === this.taskDate).length;
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
      kanbanSort: { ...this.kanbanSort },
      weeklyScheduleStart: this.weeklyScheduleStart,
      mealPrepData: this.mealPrepService.exportStorageData()
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
        ['mealTags', 'array'], ['address', 'string'], ['contact', 'string'], ['note', 'string'],
        ['deliveryDays', 'array'], ['pauseDates', 'array'], ['specialMealNote', 'string']
      ];
      for (let i = 0; i < data.elders.length; i++) {
        const elder = data.elders[i];
        if (!elder || typeof elder !== 'object') {
          errors.push(`老人[${i}]: 不是有效的对象`);
          continue;
        }
        if (!elder.deliveryDays) elder.deliveryDays = [1, 2, 3, 4, 5];
        if (!elder.pauseDates) elder.pauseDates = [];
        if (!elder.specialMealNote) elder.specialMealNote = '';
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
        ['capacity', 'number'], ['area', 'string'], ['availableDays', 'array']
      ];
      for (let i = 0; i < data.volunteers.length; i++) {
        const vol = data.volunteers[i];
        if (!vol || typeof vol !== 'object') {
          errors.push(`志愿者[${i}]: 不是有效的对象`);
          continue;
        }
        if (!vol.availableDays) vol.availableDays = [1, 2, 3, 4, 5];
        for (const [field, type] of VOLUNTEER_FIELDS) {
          if (!(field in vol)) {
            errors.push(`志愿者[${i}]: 缺少 ${field} 字段`);
          } else if (type === 'string' && typeof vol[field] !== 'string') {
            errors.push(`志愿者[${i}]: ${field} 应为字符串`);
          } else if (type === 'number' && typeof vol[field] !== 'number') {
            errors.push(`志愿者[${i}]: ${field} 应为数字`);
          } else if (type === 'array' && !Array.isArray(vol[field])) {
            errors.push(`志愿者[${i}]: ${field} 应为数组`);
          }
        }
      }
    }

    if (!Array.isArray(data.tasks)) {
      errors.push('缺少 tasks 字段或格式不正确（必须为数组）');
    } else {
      const TASK_FIELDS: [string, string][] = [
        ['id', 'string'], ['elderId', 'string'], ['date', 'string'],
        ['volunteerId', 'string'], ['status', 'string'], ['exception', 'string'],
        ['isManuallyModified', 'boolean'], ['specialMealNote', 'string']
      ];
      const VALID_STATUSES = ['待分配', '配送中', '已送达', '异常'];
      for (let i = 0; i < data.tasks.length; i++) {
        const task = data.tasks[i];
        if (!task || typeof task !== 'object') {
          errors.push(`任务[${i}]: 不是有效的对象`);
          continue;
        }
        if (task.isManuallyModified === undefined) task.isManuallyModified = false;
        if (!task.specialMealNote) task.specialMealNote = '';
        for (const [field, type] of TASK_FIELDS) {
          if (!(field in task)) {
            errors.push(`任务[${i}]: 缺少 ${field} 字段`);
          } else if (type === 'string' && typeof task[field] !== 'string') {
            errors.push(`任务[${i}]: ${field} 应为字符串`);
          } else if (type === 'boolean' && typeof task[field] !== 'boolean') {
            errors.push(`任务[${i}]: ${field} 应为布尔值`);
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

    if (data.phoneNotifications !== undefined) {
      if (!Array.isArray(data.phoneNotifications)) {
        errors.push('phoneNotifications 字段格式不正确（必须为数组）');
      } else {
        const PN_FIELDS: [string, string][] = [
          ['id', 'string'], ['date', 'string'], ['targetType', 'string'],
          ['targetId', 'string'], ['phone', 'string'], ['taskId', 'string'],
          ['notificationStatus', 'string'], ['remark', 'string'], ['updatedAt', 'string']
        ];
        const VALID_TARGET_TYPES = ['elder', 'volunteer'];
        const VALID_STATUSES = ['未通知', '已通知', '未接通', '稍后再拨'];
        for (let i = 0; i < data.phoneNotifications.length; i++) {
          const pn = data.phoneNotifications[i];
          if (!pn || typeof pn !== 'object') {
            errors.push(`电话通知[${i}]: 不是有效的对象`);
            continue;
          }
          for (const [field, type] of PN_FIELDS) {
            if (!(field in pn)) {
              errors.push(`电话通知[${i}]: 缺少 ${field} 字段`);
            } else if (type === 'string' && typeof pn[field] !== 'string') {
              errors.push(`电话通知[${i}]: ${field} 应为字符串`);
            }
          }
          if ('targetType' in pn && typeof pn.targetType === 'string' && !VALID_TARGET_TYPES.includes(pn.targetType)) {
            errors.push(`电话通知[${i}]: targetType 值"${pn.targetType}"无效`);
          }
          if ('notificationStatus' in pn && typeof pn.notificationStatus === 'string' && !VALID_STATUSES.includes(pn.notificationStatus)) {
            errors.push(`电话通知[${i}]: notificationStatus 值"${pn.notificationStatus}"无效`);
          }
        }
      }
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
      kanbanSort: data.kanbanSort || {},
      mealPrepData: data.mealPrepData || undefined
    };

    const totalCount = backup.elders.length + backup.volunteers.length + backup.tasks.length
      + backup.mealTags.length + backup.exceptionRecords.length + backup.visitRecords.length
      + backup.phoneNotifications.length;

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
    const phoneNotificationIdMap = new Map(this.phoneNotifications.map(r => [r.id, r]));

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
      phoneNotifications: classify(backup.phoneNotifications, phoneNotificationIdMap)
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

  private isValidPhoneNotification(r: any): boolean {
    return r && typeof r === 'object'
      && typeof r.id === 'string' && typeof r.date === 'string'
      && typeof r.targetType === 'string' && typeof r.targetId === 'string'
      && typeof r.phone === 'string' && typeof r.taskId === 'string'
      && typeof r.notificationStatus === 'string' && typeof r.remark === 'string'
      && typeof r.updatedAt === 'string';
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
    if (backup.phoneNotifications.length > 0 && (!Array.isArray(backup.phoneNotifications) || backup.phoneNotifications.some((r: any) => !this.isValidPhoneNotification(r)))) {
      integrityErrors.push('电话通知记录数据不完整，存在缺失字段的记录');
    }

    if (backup.mealPrepData !== undefined && backup.mealPrepData !== null) {
      if (typeof backup.mealPrepData !== 'object') {
        integrityErrors.push('备餐数据格式不正确');
      } else {
        for (const dateKey of Object.keys(backup.mealPrepData)) {
          const dayData = (backup.mealPrepData as any)[dateKey];
          if (typeof dayData !== 'object') {
            integrityErrors.push(`备餐数据[${dateKey}]格式不正确`);
            break;
          }
          for (const taskId of Object.keys(dayData)) {
            const item = dayData[taskId];
            if (!item || typeof item !== 'object'
                || typeof item.status !== 'string'
                || typeof item.missingNote !== 'string'
                || typeof item.exceptionRecorded !== 'boolean'
                || typeof item.notificationAdded !== 'boolean') {
              integrityErrors.push(`备餐数据[${dateKey}][${taskId}]字段不完整`);
              break;
            }
          }
        }
      }
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

    const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map(existing.map(e => [e.id, e]));
      for (const item of incoming) {
        map.set(item.id, item);
      }
      return Array.from(map.values());
    };

    this.elders = mergeById(this.elders, backup.elders);
    this.volunteers = mergeById(this.volunteers, backup.volunteers);
    this.tasks = mergeById(this.tasks, backup.tasks);
    this.mealTags = mergeById(this.mealTags, backup.mealTags);
    this.exceptionRecords = mergeById(this.exceptionRecords, backup.exceptionRecords);
    this.visitRecords = mergeById(this.visitRecords, backup.visitRecords);
    this.phoneNotifications = mergeById(this.phoneNotifications, backup.phoneNotifications);

    if (backup.kanbanSort && typeof backup.kanbanSort === 'object') {
      for (const date of Object.keys(backup.kanbanSort)) {
        if (!this.kanbanSort[date]) {
          this.kanbanSort[date] = backup.kanbanSort[date];
        } else {
          const existing = this.kanbanSort[date];
          const incoming = backup.kanbanSort[date];
          for (const volId of Object.keys(incoming)) {
            existing[volId] = incoming[volId];
          }
        }
      }
    }

    if (backup.weeklyScheduleStart && typeof backup.weeklyScheduleStart === 'string') {
      this.weeklyScheduleStart = backup.weeklyScheduleStart;
    }

    if (backup.mealPrepData && typeof backup.mealPrepData === 'object') {
      this.mealPrepService.importStorageData(backup.mealPrepData as PrepStorageData, true);
    }

    this.save();
    this.saveKanbanSort();
    this.saveMealTags();
    this.saveExceptions();
    this.saveVisits();
    this.savePhoneNotifications();

    this.importSuccess = true;
    this.importPreview = null;
    this.importedData = null;
  }

  resetImport() {
    this.importPreview = null;
    this.importError = null;
    this.importedData = null;
    this.importSuccess = false;
  }

  // ===== 备餐模块事件处理 =====
  onPrepExceptionCreated(prepExc: PrepExceptionRecord) {
    const record: ExceptionRecord = { ...prepExc };
    this.exceptionRecords = [record, ...this.exceptionRecords];
    this.saveExceptions();
  }

  onPrepNotificationCreated(prepNotif: PrepPhoneNotification) {
    const notif: PhoneNotification = { ...prepNotif };
    this.phoneNotifications = [notif, ...this.phoneNotifications];
    this.savePhoneNotifications();
  }

  onPrepTaskUpdated(update: { taskId: string; status: MealTask['status']; exception: string }) {
    this.tasks = this.tasks.map((t) =>
      t.id === update.taskId
        ? { ...t, status: update.status, exception: update.exception, isManuallyModified: true }
        : t
    );
    this.save();
  }

  openVolunteerDelivery() {
    this.selectedDeliveryVolunteerId = '';
    this.appViewMode = 'delivery';
  }

  closeVolunteerDelivery() {
    this.appViewMode = 'schedule';
    this.selectedDeliveryVolunteerId = '';
  }

  onDeliveryStatusUpdated(update: {
    taskUpdated?: { taskId: string; status: MealTask['status']; exception: string };
    exceptionCreated?: ExceptionRecord;
    notificationCreated?: PhoneNotification;
  }) {
    if (update.taskUpdated) {
      this.tasks = this.tasks.map((t) =>
        t.id === update.taskUpdated!.taskId
          ? { ...t, status: update.taskUpdated!.status, exception: update.taskUpdated!.exception, isManuallyModified: true }
          : t
      );
      this.save();
    }
    if (update.exceptionCreated) {
      const existingIdx = this.exceptionRecords.findIndex((e) => e.taskId === update.exceptionCreated!.taskId && e.date === update.exceptionCreated!.date);
      if (existingIdx === -1) {
        this.exceptionRecords = [update.exceptionCreated, ...this.exceptionRecords];
        this.saveExceptions();
      }
    }
    if (update.notificationCreated) {
      const existingIdx = this.phoneNotifications.findIndex((n) => n.taskId === update.notificationCreated!.taskId && n.date === update.notificationCreated!.date);
      if (existingIdx === -1) {
        this.phoneNotifications = [update.notificationCreated, ...this.phoneNotifications];
        this.savePhoneNotifications();
      }
    }
  }
}
