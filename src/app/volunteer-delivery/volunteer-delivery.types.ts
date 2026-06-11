export type DeliveryStatus = '待配送' | '配送中' | '已送达' | '异常' | '未接通';

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  '待配送',
  '配送中',
  '已送达',
  '异常',
  '未接通',
];

export type VolunteerRef = {
  id: string;
  name: string;
  phone: string;
  area: string;
};

export type ElderDeliveryRef = {
  id: string;
  name: string;
  address: string;
  contact: string;
  mealTags: Array<{ id: string; name: string; color: string }>;
  specialMealNote: string;
  lastVisit?: {
    date: string;
    method: string;
    nextAttention?: string;
  };
};

export type DeliveryTask = {
  id: string;
  taskId: string;
  routeOrder: number;
  volunteer: VolunteerRef;
  elder: ElderDeliveryRef;
  status: DeliveryStatus;
  exceptionNote: string;
  statusUpdatedAt: string;
  date: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
  visitReminder: boolean;
};

export type VolunteerDailySummary = {
  volunteer: VolunteerRef;
  date: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  exceptionTasks: number;
  unreachableTasks: number;
  tasks: DeliveryTask[];
};

export type DeliveryStatusUpdate = {
  taskId: string;
  status: DeliveryStatus;
  exceptionNote?: string;
  updatedAt: string;
};

export type DeliveryRouteGroup = {
  volunteer: VolunteerRef;
  taskCount: number;
  completedCount: number;
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  '待配送': '#8a9783',
  '配送中': '#5a8fd9',
  '已送达': '#4a9f6d',
  '异常': '#c75454',
  '未接通': '#d9a84a',
};

export const DELIVERY_STATUS_ICONS: Record<DeliveryStatus, string> = {
  '待配送': '📦',
  '配送中': '🚴',
  '已送达': '✓',
  '异常': '⚠️',
  '未接通': '📞',
};

export const LS_DELIVERY_DATA_KEY = 'zfl-4-volunteer-delivery-data';

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

export type DeliveryViewMode = 'selector' | 'delivery';
