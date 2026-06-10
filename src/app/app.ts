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

const today = new Date().toISOString().slice(0, 10);

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
  elderForm: Omit<Elder, 'id'> = { name: '', preference: '', address: '', contact: '', note: '' };
  volunteerForm: Omit<Volunteer, 'id'> = { name: '', phone: '', capacity: 3, area: '' };

  constructor() {
    this.load();
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
    this.tasks = this.tasks.map((task) => task.id === id ? { ...task, volunteerId, status: volunteerId ? '配送中' : '待分配' } : task);
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
}
