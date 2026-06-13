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

export type ExceptionCategory =
  | '无人应答'
  | '地址错误'
  | '老人拒收'
  | '餐食问题'
  | '配送延误'
  | '老人身体不适'
  | '其他';
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

export type NotificationStatus = '未通知' | '已通知' | '未接通' | '稍后再拨';
export type NotificationTargetType = 'elder' | 'volunteer';

export type PhoneNotification = {
  id: string;
  date: string;
  targetType: NotificationTargetType;
  targetId: string;
  phone: string;
  taskId: string;
  notificationStatus: NotificationStatus;
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

export type PrepStorageData = Record<
  string,
  Record<
    string,
    {
      status: PrepStatus;
      missingNote: string;
      exceptionRecorded: boolean;
      notificationAdded: boolean;
    }
  >
>;

export type DeliveryStorageData = Record<
  string,
  Record<
    string,
    {
      status: DeliveryStatus;
      exceptionNote: string;
      statusUpdatedAt: string;
      exceptionRecorded: boolean;
      notificationAdded: boolean;
    }
  >
>;

export type KanbanSortMap = Record<string, Record<string, string[]>>;
