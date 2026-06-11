import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Elder = {
  id: string;
  name: string;
  preference: string;
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

type KanbanSortMap = Record<string, Record<string, string[]>>;

type KanbanGroup = {
  volunteer: Volunteer;
  tasks: MealTask[];
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
          <span>{{ exceptionTasks().length }}条异常</span>
        </div>
      </header>

      <section class="layout">
        <aside class="stack">
          <form class="panel" (ngSubmit)="addElder()">
            <h2>维护老人档案</h2>
            <input name="elderName" [(ngModel)]="elderForm.name" placeholder="姓名" />
            <input name="elderPreference" [(ngModel)]="elderForm.preference" placeholder="餐食偏好" />
            <input name="elderAddress" [(ngModel)]="elderForm.address" placeholder="送餐地址" />
            <input name="elderContact" [(ngModel)]="elderForm.contact" placeholder="紧急联系" />
            <input name="elderNote" [(ngModel)]="elderForm.note" placeholder="备注" />
            <button>保存老人</button>
          </form>

          <section class="panel elder-list-panel">
            <h2>老人列表 <span class="muted sm-label">({{ elders.length }}位)</span></h2>
            <div class="elder-list">
              <div class="elder-card" *ngFor="let elder of elders" (click)="selectElder(elder.id)" [class.active]="selectedElderId === elder.id">
                <div class="elder-card-header">
                  <strong>{{ elder.name }}</strong>
                  <button type="button" class="ghost sm visit-btn" (click)="$event.stopPropagation(); openVisitPanel(elder.id)">回访</button>
                </div>
                <small>{{ elder.address }}</small>
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
            </div>
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
            </div>
          </div>

          <div class="taskList">
            <article *ngFor="let task of filteredTasks()" [class.warn]="task.status === '异常'">
              <div>
                <strong>{{ elderName(task.elderId) }}</strong>
                <span>{{ elderAddress(task.elderId) }}</span>
                <small>{{ elderPreference(task.elderId) }}</small>
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
            <h2>异常情况</h2>
            <article class="exception" *ngFor="let task of exceptionTasks()">
              <strong>{{ elderName(task.elderId) }}</strong>
              <span>{{ task.date }} · {{ task.exception }}</span>
            </article>
            <p class="muted" *ngIf="exceptionTasks().length === 0">暂无异常</p>
          </section>

          <section class="panel">
            <h2>志愿者负载</h2>
            <p class="load" *ngFor="let volunteer of volunteers">
              <strong>{{ volunteer.name }}</strong>
              <span>{{ assignedCount(volunteer.id) }}/{{ volunteer.capacity }}单</span>
            </p>
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
  `],
})
export class App {
  elders: Elder[] = [
    { id: crypto.randomUUID(), name: '苏阿姨', preference: '少盐软饭', address: '松桂里3栋201', contact: '女儿13800001111', note: '午餐需敲门等候' },
    { id: crypto.randomUUID(), name: '何叔叔', preference: '糖尿病餐', address: '松桂里5栋104', contact: '邻居王姐', note: '行动慢，放门口需电话确认' },
    { id: crypto.randomUUID(), name: '林奶奶', preference: '素食', address: '梧桐巷12号', contact: '儿子13900002222', note: '周三加汤' }
  ];

  volunteers: Volunteer[] = [
    { id: crypto.randomUUID(), name: '小赵', phone: '13600003333', capacity: 4, area: '松桂里' },
    { id: crypto.randomUUID(), name: '陈姐', phone: '13700004444', capacity: 3, area: '梧桐巷' }
  ];

  tasks: MealTask[] = [];
  taskDate = today;
  kanbanSort: KanbanSortMap = {};
  elderForm: Omit<Elder, 'id'> = { name: '', preference: '', address: '', contact: '', note: '' };
  volunteerForm: Omit<Volunteer, 'id'> = { name: '', phone: '', capacity: 3, area: '' };

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

  get selectedElderForVisit(): Elder | undefined {
    return this.elders.find((e) => e.id === this.selectedElderIdForVisit);
  }

  constructor() {
    this.load();
    this.loadKanbanSort();
    this.loadVisits();
    if (this.tasks.length === 0) this.generateTasks();
  }

  addElder() {
    if (!this.elderForm.name.trim()) return;
    this.elders = [{ id: crypto.randomUUID(), ...this.elderForm }, ...this.elders];
    this.elderForm = { name: '', preference: '', address: '', contact: '', note: '' };
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
    return this.tasks.filter((task) => task.status === '异常');
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

  setStatus(id: string, status: MealTask['status']) {
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, status, exception: status === '异常' ? task.exception : '' } : task);
    this.save();
  }

  recordException(id: string) {
    const exception = prompt('记录异常情况', '地址无人应答') || '未填写异常';
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, status: '异常', exception } : task);
    this.save();
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
    if (elders) this.elders = JSON.parse(elders);
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

  private truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private saveVisits() {
    localStorage.setItem('zfl-4-visits', JSON.stringify(this.visitRecords));
  }

  private loadVisits() {
    const raw = localStorage.getItem('zfl-4-visits');
    if (raw) this.visitRecords = JSON.parse(raw);
  }
}
