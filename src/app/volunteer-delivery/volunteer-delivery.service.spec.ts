import { TestBed } from '@angular/core/testing';
import { VolunteerDeliveryService, TemporaryDeliveryChange, Elder, Volunteer, MealTask, MealTag, VisitRecord } from './volunteer-delivery.service';

describe('VolunteerDeliveryService', () => {
  let service: VolunteerDeliveryService;

  const mockElders: Elder[] = [
    {
      id: 'elder-1',
      name: '张大爷',
      preference: '清淡',
      mealTags: ['tag-low-salt', 'tag-soft'],
      address: '北京市朝阳区xxx小区1号楼101室',
      contact: '13800138001',
      note: '需要爬三楼',
      deliveryDays: [1, 2, 3, 4, 5],
      pauseDates: [],
      specialMealNote: '不要放葱姜蒜'
    },
    {
      id: 'elder-2',
      name: '李奶奶',
      preference: '软食',
      mealTags: ['tag-soft'],
      address: '北京市朝阳区xxx小区2号楼202室',
      contact: '13800138002',
      note: '有糖尿病',
      deliveryDays: [1, 3, 5],
      pauseDates: [],
      specialMealNote: '低糖饮食'
    },
    {
      id: 'elder-3',
      name: '王爷爷',
      preference: '标准',
      mealTags: [],
      address: '北京市朝阳区xxx小区3号楼303室',
      contact: '13800138003',
      note: '',
      deliveryDays: [1, 2, 3, 4, 5],
      pauseDates: ['2024-06-15'],
      specialMealNote: ''
    }
  ];

  const mockVolunteers: Volunteer[] = [
    {
      id: 'vol-1',
      name: '陈志愿者',
      phone: '13900139001',
      capacity: 10,
      area: '朝阳区',
      availableDays: [1, 2, 3, 4, 5]
    },
    {
      id: 'vol-2',
      name: '刘志愿者',
      phone: '13900139002',
      capacity: 8,
      area: '朝阳区',
      availableDays: [1, 3, 5]
    }
  ];

  const mockMealTags: MealTag[] = [
    { id: 'tag-low-salt', name: '低盐', color: '#4a9f6d' },
    { id: 'tag-soft', name: '软食', color: '#d9a84a' },
    { id: 'tag-diabetic', name: '低糖', color: '#5a8fd9' },
    { id: 'tag-vegetarian', name: '素食', color: '#9a6bd9' }
  ];

  const mockTasks: MealTask[] = [
    {
      id: 'task-1',
      elderId: 'elder-1',
      date: '2024-06-14',
      volunteerId: 'vol-1',
      status: '待分配',
      exception: '',
      isManuallyModified: false,
      specialMealNote: ''
    },
    {
      id: 'task-2',
      elderId: 'elder-2',
      date: '2024-06-14',
      volunteerId: 'vol-1',
      status: '待分配',
      exception: '',
      isManuallyModified: false,
      specialMealNote: ''
    }
  ];

  const mockVisitRecords: VisitRecord[] = [
    {
      id: 'visit-1',
      elderId: 'elder-1',
      visitDate: '2024-06-10',
      visitMethod: '上门',
      healthFeedback: '身体状况良好',
      mealFeedback: '对餐食满意',
      nextAttention: '下周需要提醒测量血压',
      createdAt: '2024-06-10 15:30:00'
    }
  ];

  const createTempChange = (overrides: Partial<TemporaryDeliveryChange>): TemporaryDeliveryChange => ({
    id: 'temp-1',
    elderId: 'elder-1',
    date: '2024-06-14',
    reason: '临时变更测试',
    createdAt: '2024-06-14 08:00:00',
    ...overrides
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(VolunteerDeliveryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('临时送餐变更 - 地址变更', () => {
    it('应该应用临时地址变更到配送任务', () => {
      const tempChange = createTempChange({
        address: '临时配送地址：北京市海淀区xxx地点'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      expect(summary).not.toBeNull();
      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1).toBeDefined();
      expect(task1!.elder.address).toBe('临时配送地址：北京市海淀区xxx地点');
    });

    it('未提供临时地址时应使用原始地址', () => {
      const tempChange = createTempChange({ address: undefined });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.address).toBe('北京市朝阳区xxx小区1号楼101室');
    });
  });

  describe('临时送餐变更 - 联系方式变更', () => {
    it('应该应用临时联系方式变更到配送任务', () => {
      const tempChange = createTempChange({
        contact: '18800188001'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.contact).toBe('18800188001');
    });

    it('空联系方式应覆盖原始联系方式', () => {
      const tempChange = createTempChange({ contact: '' });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.contact).toBe('');
    });
  });

  describe('临时送餐变更 - 餐食标签变更', () => {
    it('应该应用临时餐食标签变更到配送任务', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic', 'tag-vegetarian']
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.mealTags.map(t => t.id)).toEqual(['tag-diabetic', 'tag-vegetarian']);
      expect(task1!.elder.mealTags.map(t => t.name)).toEqual(['低糖', '素食']);
    });

    it('空标签数组应移除所有餐食标签', () => {
      const tempChange = createTempChange({ mealTagIds: [] });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.mealTags).toEqual([]);
    });

    it('未提供临时标签时应使用原始标签', () => {
      const tempChange = createTempChange({ mealTagIds: undefined });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.mealTags.map(t => t.id)).toEqual(['tag-low-salt', 'tag-soft']);
    });
  });

  describe('临时送餐变更 - 志愿者分配变更', () => {
    it('临时指定志愿者应将任务分配给该志愿者', () => {
      const tempChange = createTempChange({
        volunteerId: 'vol-2'
      });

      const summaryVol1 = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const summaryVol2 = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-2',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const taskInVol1 = summaryVol1!.tasks.find(t => t.taskId === 'task-1');
      const taskInVol2 = summaryVol2!.tasks.find(t => t.taskId === 'task-1');

      expect(taskInVol1).toBeDefined();
      expect(taskInVol2).toBeDefined();
      expect(taskInVol1!.volunteer.id).toBe('vol-2');
      expect(taskInVol2!.volunteer.id).toBe('vol-2');
      expect(summaryVol1!.totalTasks).toBe(2);
      expect(summaryVol2!.totalTasks).toBe(1);
    });

    it('临时分配的志愿者信息应正确显示', () => {
      const tempChange = createTempChange({
        volunteerId: 'vol-2'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-2',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.volunteer.id).toBe('vol-2');
      expect(task1!.volunteer.name).toBe('刘志愿者');
      expect(task1!.volunteer.phone).toBe('13900139002');
    });

    it('未指定临时志愿者时任务保留原志愿者', () => {
      const tempChange = createTempChange({
        volunteerId: undefined
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      expect(summary!.totalTasks).toBe(2);
      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.volunteer.id).toBe('vol-1');
    });
  });

  describe('临时送餐变更 - 特殊餐食备注变更', () => {
    it('应该应用临时特殊餐食备注', () => {
      const tempChange = createTempChange({
        specialMealNote: '今日需要加热后送达'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.specialMealNote).toBe('今日需要加热后送达');
    });

    it('任务级备注优先于临时备注和老人级备注', () => {
      const tasksWithNote = [{
        ...mockTasks[0],
        specialMealNote: '任务备注：需要敲门三下'
      }, mockTasks[1]];

      const tempChange = createTempChange({
        specialMealNote: '临时备注'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        tasksWithNote,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.specialMealNote).toBe('任务备注：需要敲门三下');
    });
  });

  describe('暂停老人处理', () => {
    it('暂停日期的任务应标记为待配送状态', () => {
      const pausedTask: MealTask = {
        id: 'task-3',
        elderId: 'elder-3',
        date: '2024-06-15',
        volunteerId: 'vol-1',
        status: '待分配',
        exception: '',
        isManuallyModified: false,
        specialMealNote: ''
      };

      const summary = service.generateVolunteerSummary(
        '2024-06-15',
        'vol-1',
        [pausedTask],
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        []
      );

      const task = summary!.tasks.find(t => t.taskId === 'task-3');
      expect(task!.status).toBe('待配送');
    });

    it('暂停期间的临时变更也应生效', () => {
      const tempChange = createTempChange({
        elderId: 'elder-3',
        date: '2024-06-15',
        address: '暂停期间临时地址',
        contact: '18800188003'
      });

      const pausedTask: MealTask = {
        id: 'task-3',
        elderId: 'elder-3',
        date: '2024-06-15',
        volunteerId: 'vol-1',
        status: '待分配',
        exception: '',
        isManuallyModified: false,
        specialMealNote: ''
      };

      const summary = service.generateVolunteerSummary(
        '2024-06-15',
        'vol-1',
        [pausedTask],
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task = summary!.tasks.find(t => t.taskId === 'task-3');
      expect(task!.elder.address).toBe('暂停期间临时地址');
      expect(task!.elder.contact).toBe('18800188003');
    });
  });

  describe('综合变更场景', () => {
    it('应该同时应用所有字段的临时变更', () => {
      const tempChange = createTempChange({
        address: '综合变更地址',
        contact: '18800188099',
        mealTagIds: ['tag-vegetarian'],
        volunteerId: 'vol-2',
        specialMealNote: '综合变更备注'
      });

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-2',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChange]
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.elder.address).toBe('综合变更地址');
      expect(task1!.elder.contact).toBe('18800188099');
      expect(task1!.elder.mealTags.map(t => t.id)).toEqual(['tag-vegetarian']);
      expect(task1!.volunteer.id).toBe('vol-2');
      expect(task1!.elder.specialMealNote).toBe('综合变更备注');
    });

    it('不同日期的临时变更互不影响', () => {
      const tempChangeToday = createTempChange({
        date: '2024-06-14',
        address: '今日地址'
      });
      const tempChangeTomorrow = createTempChange({
        id: 'temp-2',
        date: '2024-06-15',
        address: '明日地址'
      });

      const tasks = [
        mockTasks[0],
        { ...mockTasks[0], id: 'task-1-tomorrow', date: '2024-06-15' }
      ];

      const summaryToday = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        tasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        [tempChangeToday, tempChangeTomorrow]
      );

      const taskToday = summaryToday!.tasks.find(t => t.taskId === 'task-1');
      expect(taskToday!.elder.address).toBe('今日地址');
    });

    it('getAllVolunteerRouteGroups 应正确统计各志愿者任务', () => {
      const tempChange = createTempChange({
        volunteerId: 'vol-2'
      });

      const groups = service.getAllVolunteerRouteGroups(
        '2024-06-14',
        mockTasks,
        mockVolunteers
      );

      expect(groups.length).toBe(1);
      expect(groups[0].volunteer.id).toBe('vol-1');
      expect(groups[0].taskCount).toBe(2);
    });
  });

  describe('配送状态更新', () => {
    it('updateDeliveryStatus 应正确更新配送状态', () => {
      const result = service.updateDeliveryStatus(
        '2024-06-14',
        'task-1',
        '配送中'
      );

      expect(result.taskUpdated).toBeDefined();
      expect(result.taskUpdated!.status).toBe('配送中');

      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.status).toBe('配送中');
    });

    it('mapDeliveryStatusToTaskStatus 应正确映射状态', () => {
      expect(service.mapDeliveryStatusToTaskStatus('待配送')).toBe('待分配');
      expect(service.mapDeliveryStatusToTaskStatus('配送中')).toBe('配送中');
      expect(service.mapDeliveryStatusToTaskStatus('已送达')).toBe('已送达');
      expect(service.mapDeliveryStatusToTaskStatus('异常')).toBe('异常');
      expect(service.mapDeliveryStatusToTaskStatus('未接通')).toBe('异常');
    });

    it('getDeliveryStatusColor 应返回正确的颜色', () => {
      expect(service.getDeliveryStatusColor('待配送')).toBe('#8a9783');
      expect(service.getDeliveryStatusColor('配送中')).toBe('#5a8fd9');
      expect(service.getDeliveryStatusColor('已送达')).toBe('#4a9f6d');
      expect(service.getDeliveryStatusColor('异常')).toBe('#c75454');
      expect(service.getDeliveryStatusColor('未接通')).toBe('#d9a84a');
    });

    it('clearDeliveryStateForTaskIds 应重置非已送达任务状态', () => {
      service.updateDeliveryStatus('2024-06-14', 'task-1', '配送中', '备注');
      service.updateDeliveryStatus('2024-06-14', 'task-2', '已送达');

      service.clearDeliveryStateForTaskIds('2024-06-14', ['task-1', 'task-2']);

      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.status).toBe('待配送');
      expect(data['2024-06-14']?.['task-1']?.exceptionNote).toBe('');
      expect(data['2024-06-14']?.['task-2']?.status).toBe('已送达');
    });
  });

  describe('回访记录处理', () => {
    it('getElderLastVisit 应返回最近的回访记录', () => {
      const visits: VisitRecord[] = [
        { ...mockVisitRecords[0], visitDate: '2024-06-01' },
        { ...mockVisitRecords[0], id: 'visit-2', visitDate: '2024-06-10' }
      ];

      const lastVisit = service.getElderLastVisit('elder-1', visits);
      expect(lastVisit!.visitDate).toBe('2024-06-10');
    });

    it('有未处理的回访提醒时应标记visitReminder', () => {
      const visits: VisitRecord[] = [
        { ...mockVisitRecords[0], visitDate: '2024-06-01', nextAttention: '需要关注' }
      ];

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        visits,
        undefined,
        []
      );

      const task1 = summary!.tasks.find(t => t.taskId === 'task-1');
      expect(task1!.visitReminder).toBe(true);
    });

    it('markVisitReminderHandled 应标记回访提醒已处理', () => {
      service.markVisitReminderHandled('2024-06-14', 'task-1', '已提醒老人测量血压');

      expect(service.isVisitReminderHandled('2024-06-14', 'task-1')).toBe(true);
    });
  });

  describe('异常记录与通知', () => {
    it('createDeliveryExceptionRecord 应为未接通创建正确的异常记录', () => {
      const record = service.createDeliveryExceptionRecord(
        mockTasks[0],
        mockElders[0],
        '未接通',
        '电话无人接听'
      );

      expect(record.category).toBe('无人应答');
      expect(record.severity).toBe('一般');
      expect(record.source).toBe('未接通');
      expect(record.description).toContain('未接通');
    });

    it('createDeliveryExceptionRecord 应为地址错误创建正确的异常记录', () => {
      const record = service.createDeliveryExceptionRecord(
        mockTasks[0],
        mockElders[0],
        '异常',
        '地址错误，找不到位置'
      );

      expect(record.category).toBe('地址错误');
      expect(record.source).toBe('配送异常');
    });

    it('createDeliveryPhoneNotification 应创建正确的电话通知', () => {
      const notification = service.createDeliveryPhoneNotification(
        mockTasks[0],
        mockElders[0],
        '未接通',
        '无人接听'
      );

      expect(notification.targetType).toBe('elder');
      expect(notification.targetId).toBe('elder-1');
      expect(notification.notificationStatus).toBe('未接通');
      expect(notification.source).toBe('未接通');
    });

    it('isDeliveryExceptionDuplicate 应检测重复异常', () => {
      const existingRecords = [
        service.createDeliveryExceptionRecord(mockTasks[0], mockElders[0], '异常', '测试')
      ];

      const result = service.isDeliveryExceptionDuplicate('task-1', '配送异常', existingRecords);
      expect(result).toBe(true);
    });

    it('markDeliveryExceptionRecorded 应标记异常已记录', () => {
      service.updateDeliveryStatus('2024-06-14', 'task-1', '异常');
      service.markDeliveryExceptionRecorded('2024-06-14', 'task-1');

      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.exceptionRecorded).toBe(true);
    });

    it('markDeliveryNotificationAdded 应标记通知已添加', () => {
      service.updateDeliveryStatus('2024-06-14', 'task-1', '未接通');
      service.markDeliveryNotificationAdded('2024-06-14', 'task-1');

      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.notificationAdded).toBe(true);
    });
  });

  describe('电话拨打结果', () => {
    it('recordPhoneCallResult 应记录电话拨打结果', () => {
      service.recordPhoneCallResult(
        '2024-06-14',
        'task-1',
        'notif-1',
        '已通知',
        '已告知家属情况'
      );

      const results = service.getPhoneCallResults('2024-06-14', 'task-1');
      expect(results.length).toBe(1);
      expect(results[0].result).toBe('已通知');
      expect(results[0].remark).toBe('已告知家属情况');
    });
  });

  describe('看板路线排序', () => {
    it('应根据kanbanSort排序任务', () => {
      const sortMap = {
        '2024-06-14': {
          'vol-1': ['task-2', 'task-1']
        }
      };

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        sortMap,
        []
      );

      expect(summary!.tasks[0].taskId).toBe('task-2');
      expect(summary!.tasks[1].taskId).toBe('task-1');
      expect(summary!.tasks[0].routeOrder).toBe(1);
      expect(summary!.tasks[1].routeOrder).toBe(2);
    });
  });

  describe('志愿者配送统计', () => {
    it('generateVolunteerSummary 应正确统计各状态任务数', () => {
      service.updateDeliveryStatus('2024-06-14', 'task-1', '配送中');
      service.updateDeliveryStatus('2024-06-14', 'task-2', '已送达');

      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'vol-1',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        []
      );

      expect(summary!.totalTasks).toBe(2);
      expect(summary!.inProgressTasks).toBe(1);
      expect(summary!.completedTasks).toBe(1);
      expect(summary!.pendingTasks).toBe(0);
    });

    it('无效志愿者ID应返回null', () => {
      const summary = service.generateVolunteerSummary(
        '2024-06-14',
        'non-existent',
        mockTasks,
        mockVolunteers,
        mockElders,
        mockMealTags,
        mockVisitRecords,
        undefined,
        []
      );

      expect(summary).toBeNull();
    });
  });
});
