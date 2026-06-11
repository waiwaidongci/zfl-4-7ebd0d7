import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
};

type Volunteer = {
  id: string;
  name: string;
  phone: string;
  capacity: number;
  area: string;
};

type MealTask = {
  id: string;
  elderId: string;
  date: string;
  volunteerId: string;
  status: '待分配' | '配送中' | '已送达' | '异常';
  exception: string;
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

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  template: `
    <main>
      <header class="hero">
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
      </header>

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

        <section class="panel">
          <div class="toolbar">
            <h2>每日送餐任务</h2>
            <div>
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
            <article *ngFor="let task of filteredTasks()" [class.warn]="task.status === '异常'">
              <div>
                <strong>{{ elderName(task.elderId) }}</strong>
                <span>{{ elderAddress(task.elderId) }}</span>
                <small>{{ elderPreference(task.elderId) }}</small>
                <div class="tag-row" *ngIf="elderMealTags(task.elderId).length > 0">
                  <span class="tag-chip" *ngFor="let tag of elderMealTags(task.elderId)" [style.background]="tag.color + '20'" [style.color]="tag.color" [style.borderColor]="tag.color + '50'">{{ tag.name }}</span>
                </div>
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
  `],
})
export class App {
  elders: Elder[] = [
    { id: crypto.randomUUID(), name: '苏阿姨', preference: '少盐软饭', mealTags: ['low-salt', 'soft-food'], address: '松桂里3栋201', contact: '女儿13800001111', note: '午餐需敲门等候' },
    { id: crypto.randomUUID(), name: '何叔叔', preference: '糖尿病餐', mealTags: ['diabetic'], address: '松桂里5栋104', contact: '邻居王姐', note: '行动慢，放门口需电话确认' },
    { id: crypto.randomUUID(), name: '林奶奶', preference: '素食', mealTags: ['vegetarian'], address: '梧桐巷12号', contact: '儿子13900002222', note: '周三加汤' }
  ];

  volunteers: Volunteer[] = [
    { id: crypto.randomUUID(), name: '小赵', phone: '13600003333', capacity: 4, area: '松桂里' },
    { id: crypto.randomUUID(), name: '陈姐', phone: '13700004444', capacity: 3, area: '梧桐巷' }
  ];

  tasks: MealTask[] = [];
  taskDate = today;
  kanbanSort: KanbanSortMap = {};
  elderForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '' };
  volunteerForm: Omit<Volunteer, 'id'> = { name: '', phone: '', capacity: 3, area: '' };

  mealTags: MealTag[] = [...PRESET_TAGS];
  newTagName = '';
  editingTagId: string | null = null;
  editingTagName = '';

  editingElderId: string | null = null;
  elderEditForm: Omit<Elder, 'id'> = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '' };

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

  EXCEPTION_CATEGORIES: ExceptionCategory[] = ['无人应答', '地址错误', '老人拒收', '餐食问题', '配送延误', '老人身体不适', '其他'];
  EXCEPTION_SEVERITIES: ExceptionSeverity[] = ['一般', '较重', '紧急'];
  EXCEPTION_STATUSES: ExceptionStatus[] = ['待处理', '处理中', '已解决'];

  get selectedElderForVisit(): Elder | undefined {
    return this.elders.find((e) => e.id === this.selectedElderIdForVisit);
  }

  constructor() {
    this.load();
    this.loadKanbanSort();
    this.loadVisits();
    this.loadMealTags();
    this.loadExceptions();
    if (this.tasks.length === 0) this.generateTasks();
  }

  addElder() {
    if (!this.elderForm.name.trim()) return;
    this.elders = [{ id: crypto.randomUUID(), ...this.elderForm }, ...this.elders];
    this.elderForm = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '' };
    this.save();
  }

  addVolunteer() {
    if (!this.volunteerForm.name.trim()) return;
    this.volunteers = [{ id: crypto.randomUUID(), ...this.volunteerForm, capacity: Number(this.volunteerForm.capacity || 1) }, ...this.volunteers];
    this.volunteerForm = { name: '', phone: '', capacity: 3, area: '' };
    this.save();
  }

  generateTasks() {
    const existing = new Set(this.tasks.filter((task) => task.date === this.taskDate).map((task) => task.elderId));
    const created = this.elders
      .filter((elder) => !existing.has(elder.id))
      .map((elder) => ({ id: crypto.randomUUID(), elderId: elder.id, date: this.taskDate, volunteerId: '', status: '待分配' as const, exception: '' }));
    this.tasks = [...created, ...this.tasks];
    this.save();
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
    this.tasks = this.tasks.map((t) => t.id === id ? { ...t, volunteerId, status: volunteerId ? '配送中' : '待分配' } : t);
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
  }

  autoAssignTasks() {
    const dateTasks = this.filteredTasks();
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
      const elder = this.elders.find((e) => e.id === task.elderId);
      if (!elder) {
        failed.push({ taskId: task.id, elderId: task.elderId, elderName: '未知老人', elderAddress: '', reason: '老人档案不存在' });
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

  setStatus(id: string, status: MealTask['status']) {
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, status, exception: status === '异常' ? task.exception : '' } : task);
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
    if (elders) this.elders = JSON.parse(elders).map((e: Elder) => ({ ...e, mealTags: e.mealTags || [] }));
    if (volunteers) this.volunteers = JSON.parse(volunteers);
    if (tasks) this.tasks = JSON.parse(tasks);
  }

  private save() {
    localStorage.setItem('zfl-4-elders', JSON.stringify(this.elders));
    localStorage.setItem('zfl-4-volunteers', JSON.stringify(this.volunteers));
    localStorage.setItem('zfl-4-tasks', JSON.stringify(this.tasks));
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
    this.elderEditForm = { name: '', preference: '', mealTags: [], address: '', contact: '', note: '' };
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
}
