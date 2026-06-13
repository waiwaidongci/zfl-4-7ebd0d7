import type {
  MealTag,
  Elder,
  Volunteer,
  MealTask,
  ExceptionCategory,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionSource,
  ExceptionRecord,
  VisitRecord,
  PhoneNotification,
  CallbackTask,
  TemporaryDeliveryChange,
  PrepStatus,
  DeliveryStatus,
  PrepStorageData,
  DeliveryStorageData,
} from '../shared.types';
export type {
  MealTag,
  Elder,
  Volunteer,
  MealTask,
  ExceptionCategory,
  ExceptionSeverity,
  ExceptionStatus,
  ExceptionSource,
  ExceptionRecord,
  VisitRecord,
  PhoneNotification,
  CallbackTask,
  TemporaryDeliveryChange,
  PrepStatus,
  DeliveryStatus,
  PrepStorageData,
  DeliveryStorageData,
} from '../shared.types';

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
  taskStatus: '待分配' | '配送中' | '已送达' | '异常';
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
  lastVisit: VisitRecord | undefined;
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

export type TaskStatusUpdatePayload = {
  taskId: string;
  field: string;
  newValue: any;
  oldValue?: any;
};
