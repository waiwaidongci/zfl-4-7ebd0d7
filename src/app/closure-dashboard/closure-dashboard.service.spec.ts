import { TestBed } from '@angular/core/testing';
import { ClosureDashboardService } from './closure-dashboard.service';
import {
  TemporaryDeliveryChange,
  Elder,
  Volunteer,
  MealTask,
  MealTag,
  ExceptionRecord,
  VisitRecord,
  PhoneNotification,
  CallbackTask,
  PrepStorageData,
  DeliveryStorageData,
} from './closure-dashboard.types';

describe('ClosureDashboardService', () => {
  let service: ClosureDashboardService;

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
      specialMealNote: '不要放葱姜蒜',
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
      specialMealNote: '低糖饮食',
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
      specialMealNote: '',
    },
  ];

  const mockVolunteers: Volunteer[] = [
    {
      id: 'vol-1',
      name: '陈志愿者',
      phone: '13900139001',
      capacity: 10,
      area: '朝阳区',
      availableDays: [1, 2, 3, 4, 5],
    },
    {
      id: 'vol-2',
      name: '刘志愿者',
      phone: '13900139002',
      capacity: 8,
      area: '朝阳区',
      availableDays: [1, 3, 5],
    },
  ];

  const mockMealTags: MealTag[] = [
    { id: 'tag-low-salt', name: '低盐', color: '#4a9f6d' },
    { id: 'tag-soft', name: '软食', color: '#d9a84a' },
    { id: 'tag-diabetic', name: '低糖', color: '#5a8fd9' },
    { id: 'tag-vegetarian', name: '素食', color: '#9a6bd9' },
  ];

  const mockTasks: MealTask[] = [
    {
      id: 'task-1',
      elderId: 'elder-1',
      date: '2024-06-14',
      volunteerId: 'vol-1',
      status: '配送中',
      exception: '',
      isManuallyModified: false,
      specialMealNote: '',
    },
    {
      id: 'task-2',
      elderId: 'elder-2',
      date: '2024-06-14',
      volunteerId: 'vol-1',
      status: '已送达',
      exception: '',
      isManuallyModified: false,
      specialMealNote: '',
    },
  ];

  const mockExceptionRecords: ExceptionRecord[] = [
    {
      id: 'exc-1',
      taskId: 'task-1',
      elderId: 'elder-1',
      date: '2024-06-14',
      category: '无人应答',
      severity: '一般',
      description: '电话无人接听',
      handler: '',
      status: '待处理',
      result: '',
      source: '未接通',
      createdAt: '2024-06-14 12:00:00',
      updatedAt: '2024-06-14 12:00:00',
    },
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
      createdAt: '2024-06-10 15:30:00',
    },
    {
      id: 'visit-2',
      elderId: 'elder-2',
      visitDate: '2024-06-13',
      visitMethod: '电话',
      healthFeedback: '血糖稳定',
      mealFeedback: '餐食合适',
      nextAttention: '',
      createdAt: '2024-06-13 10:00:00',
    },
  ];

  const mockPhoneNotifications: PhoneNotification[] = [
    {
      id: 'notif-1',
      date: '2024-06-14',
      targetType: 'elder',
      targetId: 'elder-1',
      phone: '13800138001',
      taskId: 'task-1',
      notificationStatus: '未通知',
      remark: '配送未接通通知',
      source: '未接通',
      updatedAt: '2024-06-14 12:05:00',
    },
  ];

  const mockCallbackTasks: CallbackTask[] = [
    {
      id: 'cb-1',
      notificationId: 'notif-1',
      taskId: 'task-1',
      elderId: 'elder-1',
      date: '2024-06-14',
      phone: '13800138001',
      nextCallbackTime: '2024-06-14 14:00:00',
      handler: '管理员',
      status: '待回拨',
      result: '',
      callbackCount: 1,
      remark: '需要再次联系',
      createdAt: '2024-06-14 12:10:00',
      updatedAt: '2024-06-14 12:10:00',
    },
  ];

  const mockPrepData: PrepStorageData = {
    '2024-06-14': {
      'task-1': {
        status: '备餐中',
        missingNote: '',
        exceptionRecorded: false,
        notificationAdded: false,
      },
      'task-2': {
        status: '已完成',
        missingNote: '',
        exceptionRecorded: false,
        notificationAdded: false,
      },
    },
  };

  const mockDeliveryData: DeliveryStorageData = {
    '2024-06-14': {
      'task-1': {
        status: '配送中',
        exceptionNote: '',
        statusUpdatedAt: '2024-06-14 11:00:00',
        exceptionRecorded: false,
        notificationAdded: false,
      },
      'task-2': {
        status: '已送达',
        exceptionNote: '',
        statusUpdatedAt: '2024-06-14 11:30:00',
        exceptionRecorded: false,
        notificationAdded: false,
      },
    },
  };

  const createTempChange = (
    overrides: Partial<TemporaryDeliveryChange>,
  ): TemporaryDeliveryChange => ({
    id: 'temp-1',
    elderId: 'elder-1',
    date: '2024-06-14',
    reason: '临时变更测试',
    createdAt: '2024-06-14 08:00:00',
    ...overrides,
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClosureDashboardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('aggregateClosureRows - 地址变更', () => {
    it('应该应用临时地址变更到关站看板行', () => {
      const tempChange = createTempChange({
        address: '临时地址：海淀区xxx地点',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row).toBeDefined();
      expect(elder1Row!.elderAddress).toBe('临时地址：海淀区xxx地点');
      expect(elder1Row!.hasTempChange).toBe(true);
      expect(elder1Row!.tempChangeSummary).toContain('地址变更');
    });

    it('未提供临时地址时应使用原始地址', () => {
      const tempChange = createTempChange({
        address: undefined,
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderAddress).toBe('北京市朝阳区xxx小区1号楼101室');
    });
  });

  describe('aggregateClosureRows - 联系方式变更', () => {
    it('应该应用临时联系方式变更', () => {
      const tempChange = createTempChange({
        contact: '18800188001',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderContact).toBe('18800188001');
      expect(elder1Row!.tempChangeSummary).toContain('联系方式变更');
    });

    it('空联系方式应覆盖原始联系方式', () => {
      const tempChange = createTempChange({
        contact: '',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderContact).toBe('');
    });
  });

  describe('aggregateClosureRows - 餐食标签变更', () => {
    it('应该应用临时餐食标签变更', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic', 'tag-vegetarian'],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderMealTags.map((t) => t.id)).toEqual(['tag-diabetic', 'tag-vegetarian']);
      expect(elder1Row!.elderMealTags.map((t) => t.name)).toEqual(['低糖', '素食']);
      expect(elder1Row!.tempChangeSummary).toContain('餐食标签变更');
    });

    it('空标签数组应移除所有标签', () => {
      const tempChange = createTempChange({
        mealTagIds: [],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderMealTags).toEqual([]);
    });

    it('未提供临时标签时使用原始标签', () => {
      const tempChange = createTempChange({
        mealTagIds: undefined,
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderMealTags.map((t) => t.id)).toEqual(['tag-low-salt', 'tag-soft']);
    });
  });

  describe('aggregateClosureRows - 志愿者分配变更', () => {
    it('临时指定志愿者应更新志愿者信息', () => {
      const tempChange = createTempChange({
        volunteerId: 'vol-2',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.volunteerId).toBe('vol-1');
      expect(elder1Row!.hasTempChange).toBe(true);
      expect(elder1Row!.tempChangeSummary).toContain('指定志愿者');
    });
  });

  describe('aggregateClosureRows - 特殊餐食备注变更', () => {
    it('应该应用临时特殊餐食备注', () => {
      const tempChange = createTempChange({
        specialMealNote: '今日需要加热，温度40度',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderSpecialNote).toBe('今日需要加热，温度40度');
      expect(elder1Row!.tempChangeSummary).toContain('特殊餐食备注');
    });
  });

  describe('aggregateClosureRows - 暂停老人处理', () => {
    it('暂停老人应显示在关站看板中', () => {
      const pausedDateTasks: MealTask[] = [
        {
          ...mockTasks[0],
          date: '2024-06-15',
        },
      ];

      const rows = service.aggregateClosureRows(
        '2024-06-15',
        pausedDateTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        {},
        {},
      );

      const pausedRow = rows.find((r) => r.elderId === 'elder-3');
      expect(pausedRow).toBeDefined();
      expect(pausedRow!.taskId).toContain('paused-');
      expect(pausedRow!.taskStatus).toBe('待分配');
      expect(pausedRow!.prepStatus).toBe('');
      expect(pausedRow!.deliveryStatus).toBe('');
    });

    it('暂停老人的临时变更也应生效', () => {
      const tempChange = createTempChange({
        elderId: 'elder-3',
        date: '2024-06-15',
        address: '暂停期间临时地址',
        contact: '18800188003',
        mealTagIds: ['tag-soft'],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-15',
        [],
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [tempChange],
        {},
        {},
      );

      const pausedRow = rows.find((r) => r.elderId === 'elder-3');
      expect(pausedRow!.elderAddress).toBe('暂停期间临时地址');
      expect(pausedRow!.elderContact).toBe('18800188003');
      expect(pausedRow!.elderMealTags.map((t) => t.id)).toEqual(['tag-soft']);
      expect(pausedRow!.hasTempChange).toBe(true);
    });

    it('暂停老人阶段应为任务生成', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-15',
        [],
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        {},
        {},
      );

      const pausedRow = rows.find((r) => r.elderId === 'elder-3');
      expect(pausedRow!.currentStage).toBe('任务生成');
    });
  });

  describe('aggregateClosureRows - 综合变更场景', () => {
    it('应该同时应用所有字段的临时变更', () => {
      const tempChange = createTempChange({
        address: '综合变更地址',
        contact: '18800188099',
        mealTagIds: ['tag-vegetarian'],
        volunteerId: 'vol-2',
        specialMealNote: '综合变更备注',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderAddress).toBe('综合变更地址');
      expect(elder1Row!.elderContact).toBe('18800188099');
      expect(elder1Row!.elderMealTags.map((t) => t.id)).toEqual(['tag-vegetarian']);
      expect(elder1Row!.elderSpecialNote).toBe('综合变更备注');
      expect(elder1Row!.hasTempChange).toBe(true);
      expect(elder1Row!.tempChangeSummary).toContain('地址变更');
      expect(elder1Row!.tempChangeSummary).toContain('联系方式变更');
      expect(elder1Row!.tempChangeSummary).toContain('餐食标签变更');
      expect(elder1Row!.tempChangeSummary).toContain('特殊餐食备注');
      expect(elder1Row!.tempChangeSummary).toContain('指定志愿者');
    });

    it('不同日期的临时变更互不影响', () => {
      const tempChangeToday = createTempChange({
        date: '2024-06-14',
        address: '今日地址',
      });
      const tempChangeTomorrow = createTempChange({
        id: 'temp-2',
        elderId: 'elder-1',
        date: '2024-06-15',
        address: '明日地址',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChangeToday, tempChangeTomorrow],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.elderAddress).toBe('今日地址');
    });

    it('无任务且非暂停的老人不应显示', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        [],
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        {},
        {},
      );

      expect(rows.length).toBe(0);
    });
  });

  describe('computeSummaryStats', () => {
    it('应该正确计算关站统计数据', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const stats = service.computeSummaryStats(rows);

      expect(stats.totalTasks).toBe(2);
      expect(stats.assignedTasks).toBe(2);
      expect(stats.prepCompleted).toBe(1);
      expect(stats.prepInProgress).toBe(1);
      expect(stats.deliveryCompleted).toBe(1);
      expect(stats.deliveryInProgress).toBe(1);
      expect(stats.totalExceptions).toBe(1);
      expect(stats.pendingExceptions).toBe(1);
      expect(stats.pendingNotifications).toBe(1);
      expect(stats.pendingCallbacks).toBe(1);
      expect(stats.visitReminderCount).toBe(0);
    });

    it('临时变更应影响specialMealTasks统计', () => {
      const tempChange = createTempChange({
        specialMealNote: '特殊备注',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const stats = service.computeSummaryStats(rows);
      expect(stats.specialMealTasks).toBe(2);
    });

    it('暂停老人应计入pausedTasks统计', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-15',
        [],
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        {},
        {},
      );

      const stats = service.computeSummaryStats(rows);
      expect(stats.pausedTasks).toBe(1);
      expect(stats.totalTasks).toBe(1);
    });
  });

  describe('buildStageTimeline', () => {
    it('应该正确构建阶段时间线', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const timeline = service.buildStageTimeline(rows);

      expect(timeline.length).toBe(6);
      expect(timeline[0].stage).toBe('任务生成');
      expect(timeline[2].stage).toBe('备餐阶段');
      expect(timeline[2].count).toBe(0);
      expect(timeline[3].stage).toBe('配送阶段');
      expect(timeline[3].count).toBe(1);
      expect(timeline[4].stage).toBe('异常处置');
      expect(timeline[4].count).toBe(1);
    });

    it('临时变更导致的异常应影响阶段时间线', () => {
      const tempChange = createTempChange({
        address: '临时地址',
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const timeline = service.buildStageTimeline(rows);
      const exceptionStage = timeline.find((t) => t.stage === '异常处置');
      expect(exceptionStage!.count).toBe(1);
    });
  });

  describe('determineCurrentStage', () => {
    it('未解决异常应处于异常处置阶段', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.currentStage).toBe('异常处置');
    });

    it('已送达且需要回访应处于回访关注阶段', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        mockVisitRecords,
        [],
        [],
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.currentStage).toBe('配送阶段');
    });

    it('已送达且近期回访过应处于配送阶段', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        mockVisitRecords,
        [],
        [],
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const elder2Row = rows.find((r) => r.elderId === 'elder-2');
      expect(elder2Row!.currentStage).toBe('配送阶段');
    });

    it('备餐中应处于备餐阶段', () => {
      const customTasks: MealTask[] = [
        {
          ...mockTasks[0],
          status: '待分配',
        },
      ];
      const emptyDeliveryData: DeliveryStorageData = {};

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        customTasks,
        [mockElders[0]],
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        mockPrepData,
        emptyDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.currentStage).toBe('备餐阶段');
    });
  });

  describe('collectAvailableFilters', () => {
    it('应该正确收集可用筛选条件', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const filters = service.collectAvailableFilters(rows);

      expect(filters.volunteers.length).toBe(1);
      expect(filters.volunteers[0].id).toBe('vol-1');
      expect(filters.elders.length).toBe(2);
      expect(filters.mealTags.length).toBeGreaterThan(0);
      expect(filters.exceptionSources).toContain('未接通');
      expect(filters.exceptionStatuses).toContain('待处理');
    });

    it('临时变更的标签应出现在筛选条件中', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic'],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const filters = service.collectAvailableFilters(rows);
      const hasDiabeticTag = filters.mealTags.some((t) => t.id === 'tag-diabetic');
      expect(hasDiabeticTag).toBe(true);
    });
  });

  describe('filterRows', () => {
    it('应该按志愿者ID筛选', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const filtered = service.filterRows(rows, {
        dateRange: { start: '2024-06-14', end: '2024-06-14' },
        volunteerIds: ['vol-1'],
        elderIds: [],
        mealTagIds: [],
        exceptionSources: [],
        exceptionStatuses: [],
        taskStages: [],
        prepStatuses: [],
        deliveryStatuses: [],
      });

      expect(filtered.length).toBe(2);
    });

    it('应该按餐食标签筛选', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic'],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const filtered = service.filterRows(rows, {
        dateRange: { start: '2024-06-14', end: '2024-06-14' },
        volunteerIds: [],
        elderIds: [],
        mealTagIds: ['tag-diabetic'],
        exceptionSources: [],
        exceptionStatuses: [],
        taskStages: [],
        prepStatuses: [],
        deliveryStatuses: [],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].elderId).toBe('elder-1');
    });

    it('应该按任务阶段筛选', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        mockExceptionRecords,
        mockVisitRecords,
        mockPhoneNotifications,
        mockCallbackTasks,
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const filtered = service.filterRows(rows, {
        dateRange: { start: '2024-06-14', end: '2024-06-14' },
        volunteerIds: [],
        elderIds: [],
        mealTagIds: [],
        exceptionSources: [],
        exceptionStatuses: [],
        taskStages: ['异常处置'],
        prepStatuses: [],
        deliveryStatuses: [],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].elderId).toBe('elder-1');
    });

    it('应该按配送状态筛选', () => {
      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [],
        mockPrepData,
        mockDeliveryData,
      );

      const filtered = service.filterRows(rows, {
        dateRange: { start: '2024-06-14', end: '2024-06-14' },
        volunteerIds: [],
        elderIds: [],
        mealTagIds: [],
        exceptionSources: [],
        exceptionStatuses: [],
        taskStages: [],
        prepStatuses: [],
        deliveryStatuses: ['已送达'],
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].elderId).toBe('elder-2');
    });
  });

  describe('summarizeTempChange', () => {
    it('没有变更字段时应返回默认值', () => {
      const tempChange = createTempChange({});

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.tempChangeSummary).toBe('临时变更');
    });

    it('多个变更字段应用顿号分隔', () => {
      const tempChange = createTempChange({
        address: 'addr',
        contact: 'phone',
        mealTagIds: ['tag-1'],
      });

      const rows = service.aggregateClosureRows(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockVolunteers,
        mockMealTags,
        [],
        [],
        [],
        [],
        [tempChange],
        mockPrepData,
        mockDeliveryData,
      );

      const elder1Row = rows.find((r) => r.elderId === 'elder-1');
      expect(elder1Row!.tempChangeSummary).toContain('、');
      expect(elder1Row!.tempChangeSummary).toContain('地址变更');
      expect(elder1Row!.tempChangeSummary).toContain('联系方式变更');
      expect(elder1Row!.tempChangeSummary).toContain('餐食标签变更');
    });
  });
});
