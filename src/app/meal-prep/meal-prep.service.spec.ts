import { TestBed } from '@angular/core/testing';
import { MealPrepService, TemporaryDeliveryChange, Elder, Volunteer, MealTask, MealTag } from './meal-prep.service';

describe('MealPrepService', () => {
  let service: MealPrepService;

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
    service = TestBed.inject(MealPrepService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('临时送餐变更 - 地址变更', () => {
    it('应该应用临时地址变更到备餐项目', () => {
      const tempChange = createTempChange({
        address: '临时地址：北京市海淀区xxx临时地点'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item).toBeDefined();
      expect(elder1Item.elder.address).toBe('临时地址：北京市海淀区xxx临时地点');
    });

    it('未提供临时地址时应使用原始地址', () => {
      const tempChange = createTempChange({
        address: undefined
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.elder.address).toBe('北京市朝阳区xxx小区1号楼101室');
    });

    it('空字符串地址应覆盖原始地址', () => {
      const tempChange = createTempChange({
        address: ''
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.elder.address).toBe('');
    });
  });

  describe('临时送餐变更 - 联系方式变更', () => {
    it('应该应用临时联系方式变更到备餐项目', () => {
      const tempChange = createTempChange({
        contact: '18800188001'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.elder.contact).toBe('18800188001');
    });

    it('未提供临时联系方式时应使用原始联系方式', () => {
      const tempChange = createTempChange({
        contact: undefined
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.elder.contact).toBe('13800138001');
    });
  });

  describe('临时送餐变更 - 餐食标签变更', () => {
    it('应该应用临时餐食标签变更到备餐项目', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic', 'tag-vegetarian']
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.mealTagIds).toEqual(['tag-diabetic', 'tag-vegetarian']);
    });

    it('空标签数组应覆盖原始标签', () => {
      const tempChange = createTempChange({
        mealTagIds: []
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.mealTagIds).toEqual([]);
    });

    it('未提供临时标签时应使用原始标签', () => {
      const tempChange = createTempChange({
        mealTagIds: undefined
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.mealTagIds).toEqual(['tag-low-salt', 'tag-soft']);
    });

    it('标签变更应影响标签统计', () => {
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic']
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const diabeticStat = summary.tagBreakdown.find(t => t.tagId === 'tag-diabetic');
      expect(diabeticStat).toBeDefined();
      expect(diabeticStat!.activeCount).toBe(1);

      const lowSaltStat = summary.tagBreakdown.find(t => t.tagId === 'tag-low-salt');
      expect(lowSaltStat).toBeUndefined();
    });

    it('标签变更应影响备餐批次分组', () => {
      const elderWithoutSpecialNote: Elder = {
        ...mockElders[0],
        specialMealNote: ''
      };
      const tempChange = createTempChange({
        mealTagIds: ['tag-diabetic']
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        [elderWithoutSpecialNote, mockElders[1]],
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const diabeticBatch = summary.batches.find(b => b.tagId === 'tag-diabetic');
      expect(diabeticBatch).toBeDefined();
      expect(diabeticBatch!.items.length).toBe(1);
      expect(diabeticBatch!.items[0].elder.id).toBe('elder-1');
    });
  });

  describe('临时送餐变更 - 志愿者分配变更', () => {
    it('应该应用临时志愿者分配变更', () => {
      const tempChange = createTempChange({
        volunteerId: 'vol-2'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.volunteer).toBeDefined();
      expect(elder1Item.volunteer!.id).toBe('vol-2');
      expect(elder1Item.volunteer!.name).toBe('刘志愿者');
    });

    it('未提供临时志愿者时应使用任务原始志愿者', () => {
      const tempChange = createTempChange({
        volunteerId: undefined
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.volunteer!.id).toBe('vol-1');
    });

    it('临时志愿者ID无效时志愿者信息为undefined', () => {
      const tempChange = createTempChange({
        volunteerId: 'non-existent-vol'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.volunteer).toBeUndefined();
    });
  });

  describe('临时送餐变更 - 特殊餐食备注变更', () => {
    it('应该应用临时特殊餐食备注', () => {
      const tempChange = createTempChange({
        specialMealNote: '今日完全流食，不要固体食物'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.specialMealNote).toBe('今日完全流食，不要固体食物');
    });

    it('任务级备注优先于老人级备注和临时变更', () => {
      const tasksWithNote = [{
        ...mockTasks[0],
        specialMealNote: '任务级别：今日生日，加一份长寿面'
      }, mockTasks[1]];

      const tempChange = createTempChange({
        specialMealNote: '临时备注'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        tasksWithNote,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const elder1Item = summary.itemsById['task-1'];
      expect(elder1Item.specialMealNote).toBe('任务级别：今日生日，加一份长寿面');
    });

    it('特殊备注应将项目分到特殊餐食批次', () => {
      const tempChange = createTempChange({
        specialMealNote: '过敏体质，严禁花生制品'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const specialBatch = summary.batches.find(b => b.batchType === 'special');
      expect(specialBatch).toBeDefined();
      expect(specialBatch!.items.some(i => i.elder.id === 'elder-1')).toBe(true);
      expect(summary.specialItems.some(i => i.elder.id === 'elder-1')).toBe(true);
    });
  });

  describe('暂停老人统计', () => {
    it('应该正确统计暂停送餐的老人', () => {
      const pausedDateTasks: MealTask[] = [
        {
          ...mockTasks[0],
          date: '2024-06-15'
        }
      ];

      const summary = service.generateDailySummary(
        '2024-06-15',
        pausedDateTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        []
      );

      expect(summary.pausedMeals).toBe(1);
      expect(summary.pausedItems.length).toBe(1);
      expect(summary.pausedItems[0].elder.id).toBe('elder-3');
    });

    it('暂停老人即使有任务也应标记为暂停状态', () => {
      const pausedDateTasks: MealTask[] = [
        {
          id: 'task-3',
          elderId: 'elder-3',
          date: '2024-06-15',
          volunteerId: 'vol-1',
          status: '待分配',
          exception: '',
          isManuallyModified: false,
          specialMealNote: ''
        }
      ];

      const summary = service.generateDailySummary(
        '2024-06-15',
        pausedDateTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        []
      );

      const pausedItem = summary.pausedItems.find(i => i.elder.id === 'elder-3');
      expect(pausedItem).toBeDefined();
      expect(pausedItem!.isPaused).toBe(true);
      expect(pausedItem!.status).toBe('待备餐');
    });

    it('暂停统计应包含暂停老人的标签信息', () => {
      const eldersWithPausedTags = [
        {
          ...mockElders[2],
          mealTags: ['tag-soft', 'tag-diabetic'],
          pauseDates: ['2024-06-15']
        }
      ];

      const summary = service.generateDailySummary(
        '2024-06-15',
        [],
        eldersWithPausedTags,
        mockMealTags,
        mockVolunteers,
        []
      );

      expect(summary.pausedSummary.byTags.length).toBe(2);
      expect(summary.pausedSummary.byTags[0].count).toBe(1);
    });

    it('暂停率计算应正确', () => {
      const mixedTasks: MealTask[] = [
        { ...mockTasks[0], date: '2024-06-15' },
        { ...mockTasks[1], date: '2024-06-15' }
      ];

      const summary = service.generateDailySummary(
        '2024-06-15',
        mixedTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        []
      );

      const expectedRate = Math.round((1 / 3) * 1000) / 10;
      expect(summary.pausedSummary.pauseRate).toBeCloseTo(expectedRate, 0);
      expect(summary.pausedSummary.totalPaused).toBe(1);
      expect(summary.pausedSummary.activeTotal).toBe(2);
    });

    it('临时变更应影响暂停老人的信息', () => {
      const tempChange = createTempChange({
        elderId: 'elder-3',
        date: '2024-06-15',
        address: '暂停期间临时地址',
        contact: '18800188003'
      });

      const summary = service.generateDailySummary(
        '2024-06-15',
        [],
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const pausedItem = summary.pausedItems.find(i => i.elder.id === 'elder-3');
      expect(pausedItem).toBeDefined();
      expect(pausedItem!.elder.address).toBe('暂停期间临时地址');
      expect(pausedItem!.elder.contact).toBe('18800188003');
    });
  });

  describe('综合变更场景', () => {
    it('应该同时应用多个字段的临时变更', () => {
      const tempChange = createTempChange({
        address: '综合变更地址',
        contact: '18800188099',
        mealTagIds: ['tag-vegetarian'],
        volunteerId: 'vol-2',
        specialMealNote: '综合变更备注'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const item = summary.itemsById['task-1'];
      expect(item.elder.address).toBe('综合变更地址');
      expect(item.elder.contact).toBe('18800188099');
      expect(item.mealTagIds).toEqual(['tag-vegetarian']);
      expect(item.volunteer!.id).toBe('vol-2');
      expect(item.specialMealNote).toBe('综合变更备注');
    });

    it('不同日期的临时变更不应互相影响', () => {
      const tempChangeToday = createTempChange({
        date: '2024-06-14',
        address: '今日临时地址'
      });
      const tempChangeTomorrow = createTempChange({
        id: 'temp-2',
        date: '2024-06-15',
        address: '明日临时地址'
      });

      const summaryToday = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChangeToday, tempChangeTomorrow]
      );

      expect(summaryToday.itemsById['task-1'].elder.address).toBe('今日临时地址');
    });

    it('getTempChangePrepImpactSummary 应正确统计变更影响', () => {
      const changes: TemporaryDeliveryChange[] = [
        createTempChange({ address: 'addr1' }),
        createTempChange({ id: 'temp-2', elderId: 'elder-2', mealTagIds: ['tag-diabetic'], contact: '123' }),
        createTempChange({ id: 'temp-3', elderId: 'elder-2', date: '2024-06-15', address: 'addr2' }),
        createTempChange({ id: 'temp-4', volunteerId: 'vol-2', specialMealNote: 'note' })
      ];

      const impact = service.getTempChangePrepImpactSummary(changes, '2024-06-14');

      expect(impact.affectedCount).toBe(3);
      expect(impact.addressChangedCount).toBe(1);
      expect(impact.tagChangedCount).toBe(1);
      expect(impact.volunteerChangedCount).toBe(1);
      expect(impact.specialNoteChangedCount).toBe(1);
    });
  });

  describe('备餐状态更新', () => {
    it('updateItemStatus 应该正确更新状态', () => {
      service.updateItemStatus('2024-06-14', 'task-1', '备餐中');
      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.status).toBe('备餐中');
    });

    it('batchUpdateStatus 应该批量更新状态', () => {
      service.batchUpdateStatus('2024-06-14', ['task-1', 'task-2'], '已完成');
      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.status).toBe('已完成');
      expect(data['2024-06-14']?.['task-2']?.status).toBe('已完成');
    });

    it('getPrepStatusColor 应返回正确的颜色', () => {
      expect(service.getPrepStatusColor('待备餐')).toBe('#8a9783');
      expect(service.getPrepStatusColor('备餐中')).toBe('#5a8fd9');
      expect(service.getPrepStatusColor('已完成')).toBe('#4a9f6d');
      expect(service.getPrepStatusColor('缺餐异常')).toBe('#c75454');
    });
  });

  describe('厨房打印视图', () => {
    it('generateKitchenPrintViewData 应正确应用临时变更', () => {
      const tempChange = createTempChange({
        address: '打印测试地址',
        contact: '18800188088',
        mealTagIds: ['tag-diabetic'],
        volunteerId: 'vol-2',
        specialMealNote: '打印备注'
      });

      const summary = service.generateDailySummary(
        '2024-06-14',
        mockTasks,
        mockElders,
        mockMealTags,
        mockVolunteers,
        [tempChange]
      );

      const printData = service.generateKitchenPrintViewData(summary, mockMealTags);
      const specialGroup = printData.specialGroup;

      expect(specialGroup).toBeDefined();
      const elder1PrintItem = specialGroup!.items.find(i => i.elderName === '张大爷');
      expect(elder1PrintItem).toBeDefined();
      expect(elder1PrintItem!.address).toBe('打印测试地址');
      expect(elder1PrintItem!.contact).toBe('18800188088');
      expect(elder1PrintItem!.volunteerName).toBe('刘志愿者');
      expect(elder1PrintItem!.mealTags.some(t => t.id === 'tag-diabetic')).toBe(true);
    });
  });

  describe('临时变更取消处理', () => {
    it('onTempChangeCancelled 应返回需要清理的任务ID', () => {
      service.updateItemStatus('2024-06-14', 'task-1', '备餐中');

      const tempChange = createTempChange({});
      const taskIdMap = new Map<string, Map<string, string>>();
      const elderMap = new Map<string, string>();
      elderMap.set('2024-06-14', 'task-1');
      taskIdMap.set('elder-1', elderMap);

      const result = service.onTempChangeCancelled(tempChange, taskIdMap);
      expect(result).toContain('task-1');
    });

    it('clearPrepStateForTaskIds 应重置非已完成任务的状态', () => {
      service.updateItemStatus('2024-06-14', 'task-1', '备餐中', '缺餐备注');
      service.updateItemStatus('2024-06-14', 'task-2', '已完成');

      service.clearPrepStateForTaskIds('2024-06-14', ['task-1', 'task-2']);

      const data = service.exportStorageData();
      expect(data['2024-06-14']?.['task-1']?.status).toBe('待备餐');
      expect(data['2024-06-14']?.['task-1']?.missingNote).toBe('');
      expect(data['2024-06-14']?.['task-2']?.status).toBe('已完成');
    });
  });
});
