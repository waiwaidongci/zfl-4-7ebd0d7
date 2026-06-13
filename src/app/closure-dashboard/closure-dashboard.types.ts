export type MealTag = {
  id: string;
  name: string;
  color: string;
};

export type Elder = {
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

export type Volunteer = {
  id: string;
  name: string;
  phone: string;
  capacity: number;
  area: string;
  availableDays: number[];
};

export type MealTask = {
  id: string;
  elderId: string;
  date: string;
  volunteerId: string;
  status: '待分配' | '配送中' | '已送达' | '异常';
  exception: string;
  isManuallyModified: boolean;
  specialMealNote: string;
};

export type ExceptionCategory = '无人应答' | '地址错误' | '老人拒收' | '餐食问题' | '配送延误' | '老人身体不适' | '其他';
export type ExceptionSeverity = '一般' | '较重' | '紧急';
export type ExceptionStatus = '待处理' | '处理中' | '已解决';
export type ExceptionSource = '备餐缺餐' | '配送异常' | '未接通' | '手动登记';

export type ExceptionRecord = {
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

export type VisitRecord = {
  id: string;
  elderId: string;
  visitDate: string;
  visitMethod: '电话' | '上门' | '视频' | '其他';
  healthFeedback: string;
  mealFeedback: string;
  nextAttention: string;
  createdAt: string;
};

export type PhoneNotification = {
  id: string;
  date: string;
  targetType: 'elder' | 'volunteer';
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: '未通知' | '已通知' | '未接通' | '稍后再拨';
  remark: string;
  source: ExceptionSource;
  updatedAt: string;
};

export type CallbackTask = {
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

export type TemporaryDeliveryChange = {
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

export type PrepStatus = '待备餐' | '备餐中' | '已完成' | '缺餐异常';
export type DeliveryStatus = '待配送' | '配送中' | '已送达' | '异常' | '未接通';

export type TaskStage = '任务生成' | '自动分配' | '备餐阶段' | '配送阶段' | '异常处置' | '回访关注';

export type ClosureTaskRow = {
  taskId: string;
  date: string;
  elderId: string;
  elderName: string;
  elderAddress: string;
  elderContact: string;
  elderPreference: string;
  elderMealTags: MealTag[];
  elderSpecialNote: string;
  volunteerId: string;
  volunteerName: string;
  volunteerPhone: string;
  volunteerArea: string;
  taskStatus: MealTask['status'];
  taskException: string;
  isManuallyModified: boolean;
  hasTempChange: boolean;
  tempChangeSummary: string;
  prepStatus: PrepStatus | '';
  prepMissingNote: string;
  deliveryStatus: DeliveryStatus | '';
  deliveryExceptionNote: string;
  currentStage: TaskStage;
  exceptionRecords: ExceptionRecord[];
  hasUnresolvedException: boolean;
  phoneNotifications: PhoneNotification[];
  callbackTasks: CallbackTask[];
  hasPendingCallback: boolean;
  lastVisit?: VisitRecord;
  visitReminder: boolean;
  createdAt: string;
  assignedAt: string;
};

export type DashboardFilters = {
  dateRange: { start: string; end: string };
  volunteerIds: string[];
  elderIds: string[];
  mealTagIds: string[];
  exceptionSources: ExceptionSource[];
  exceptionStatuses: ExceptionStatus[];
  taskStages: TaskStage[];
  prepStatuses: PrepStatus[];
  deliveryStatuses: DeliveryStatus[];
};

export type DashboardSummaryStats = {
  totalTasks: number;
  assignedTasks: number;
  unassignedTasks: number;
  pausedTasks: number;
  specialMealTasks: number;
  prepCompleted: number;
  prepInProgress: number;
  prepPending: number;
  prepMissing: number;
  deliveryCompleted: number;
  deliveryInProgress: number;
  deliveryPending: number;
  deliveryException: number;
  deliveryUnreachable: number;
  totalExceptions: number;
  pendingExceptions: number;
  inProgressExceptions: number;
  resolvedExceptions: number;
  pendingNotifications: number;
  pendingCallbacks: number;
  activeCallbacks: number;
  completedCallbacks: number;
  visitReminderCount: number;
};

export type StageTimelineItem = {
  stage: TaskStage;
  label: string;
  icon: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
};

export type PrepStorageData = Record<string, Record<string, {
  status: PrepStatus;
  missingNote: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
}>>;

export type DeliveryStorageData = Record<string, Record<string, {
  status: DeliveryStatus;
  exceptionNote: string;
  statusUpdatedAt: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
}>>;

export type TaskStatusUpdatePayload = {
  taskId: string;
  type: 'volunteer' | 'prep' | 'delivery' | 'exception' | 'notification' | 'callback';
  status: string;
  note?: string;
};
