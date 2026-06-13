import type { DeliveryStatus } from '../shared.types';
export type { DeliveryStatus } from '../shared.types';

export type DeliveryStoredStatus = {
  status: DeliveryStatus;
  exceptionNote: string;
  statusUpdatedAt: string;
  exceptionRecorded: boolean;
  notificationAdded: boolean;
  phoneCallResults: { notificationId: string; result: string; remark: string; timestamp: string }[];
  visitReminderHandled: boolean;
  visitReminderNote: string;
};

export const DELIVERY_STATUSES: DeliveryStatus[] = ['待配送', '配送中', '已送达', '异常', '未接通'];

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
  visitReminderHandled: boolean;
  visitReminderNote: string;
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
  待配送: '#8a9783',
  配送中: '#5a8fd9',
  已送达: '#4a9f6d',
  异常: '#c75454',
  未接通: '#d9a84a',
};

export const DELIVERY_STATUS_ICONS: Record<DeliveryStatus, string> = {
  待配送: '📦',
  配送中: '🚴',
  已送达: '✓',
  异常: '⚠️',
  未接通: '📞',
};

export const LS_DELIVERY_DATA_KEY = 'zfl-4-volunteer-delivery-data';

export type DeliveryStorageData = Record<string, Record<string, DeliveryStoredStatus>>;

export type DeliveryViewMode = 'selector' | 'delivery';

export const LS_OFFLINE_DRAFT_KEY = 'zfl-4-offline-delivery-drafts';

export type OfflineDraftType =
  | 'status-update'
  | 'exception-note'
  | 'phone-call-result'
  | 'visit-reminder-handled';

export type OfflineDraftStatus = 'pending' | 'syncing' | 'synced' | 'conflict' | 'discarded';

export type OfflineDeliveryDraft = {
  id: string;
  draftType: OfflineDraftType;
  taskId: string;
  date: string;
  volunteerId: string;
  deliveryStatus?: DeliveryStatus;
  exceptionNote?: string;
  phoneNotificationId?: string;
  phoneCallResult?: '已通知' | '未接通' | '稍后再拨';
  phoneCallRemark?: string;
  visitReminderHandled?: boolean;
  visitReminderNote?: string;
  createdAt: string;
  syncedAt?: string;
  draftStatus: OfflineDraftStatus;
  conflictInfo?: {
    remoteStatus?: DeliveryStatus;
    remoteUpdatedAt?: string;
    conflictType: 'status-override' | 'concurrent-modification';
    resolution?: 'keep-local' | 'adopt-remote';
  };
};

export type OfflineDraftMergeResult = {
  taskUpdated?: { taskId: string; status: any; exception: string };
  exceptionCreated?: any;
  notificationCreated?: any;
  notificationUpdated?: { notificationId: string; status: any; remark?: string };
  visitReminderHandled?: { taskId: string; note: string };
  callbackCreated?: any;
  conflicts: OfflineDeliveryDraft[];
  mergedCount: number;
  skippedCount: number;
};
