import { Injectable, OnDestroy } from '@angular/core';
import { LS_PREP_DATA_KEY } from './meal-prep/meal-prep.types';
import { LS_DELIVERY_DATA_KEY } from './volunteer-delivery/volunteer-delivery.types';

export type SyncDataType =
  | 'elders'
  | 'volunteers'
  | 'tasks'
  | 'mealTags'
  | 'exceptionRecords'
  | 'visitRecords'
  | 'phoneNotifications'
  | 'callbackTasks'
  | 'kanbanSort'
  | 'prepData'
  | 'deliveryData';

export const LS_KEY_MAP: Record<SyncDataType, string> = {
  elders: 'zfl-4-elders',
  volunteers: 'zfl-4-volunteers',
  tasks: 'zfl-4-tasks',
  mealTags: 'zfl-4-meal-tags',
  exceptionRecords: 'zfl-4-exceptions',
  visitRecords: 'zfl-4-visits',
  phoneNotifications: 'zfl-4-phone-notifications',
  callbackTasks: 'zfl-4-callback-tasks',
  kanbanSort: 'zfl-4-kanban-sort',
  prepData: LS_PREP_DATA_KEY,
  deliveryData: LS_DELIVERY_DATA_KEY,
};

export type ConflictResolution = 'keep-local' | 'adopt-remote' | 'field-level';

export type FieldConflict = {
  field: string;
  localValue: any;
  remoteValue: any;
  resolved?: 'local' | 'remote';
};

export type RecordConflict = {
  recordId: string;
  recordType: SyncDataType;
  recordLabel: string;
  localRecord: any;
  remoteRecord: any;
  fieldConflicts: FieldConflict[];
  resolution: ConflictResolution;
  fieldResolutions?: Record<string, 'local' | 'remote'>;
};

export type SyncConflictGroup = {
  dataType: SyncDataType;
  typeLabel: string;
  conflicts: RecordConflict[];
  defaultResolution?: ConflictResolution;
};

export type SyncEnvelope = {
  windowId: string;
  syncId: string;
  timestamp: string;
  dataType: SyncDataType;
  payload: any;
  operation: 'update' | 'delete' | 'replace' | 'merge';
};

export type SyncNotification = {
  type: 'conflicts' | 'synced' | 'error';
  conflicts?: SyncConflictGroup[];
  dataType?: SyncDataType;
  message?: string;
};

const DATA_TYPE_LABELS: Record<SyncDataType, string> = {
  elders: '老人档案',
  volunteers: '志愿者信息',
  tasks: '送餐任务',
  mealTags: '餐食标签',
  exceptionRecords: '异常记录',
  visitRecords: '回访记录',
  phoneNotifications: '电话通知',
  callbackTasks: '回拨任务',
  kanbanSort: '看板路线排序',
  prepData: '备餐本地状态',
  deliveryData: '配送本地状态',
};

@Injectable({ providedIn: 'root' })
export class MultiWindowSyncService implements OnDestroy {
  private static instance: MultiWindowSyncService | null = null;
  readonly windowId: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private pendingSyncs: Map<string, SyncEnvelope> = new Map();
  private localSnapshots: Map<SyncDataType, any> = new Map();
  private notificationHandlers: Set<(n: SyncNotification) => void> = new Set();
  private readonly CHANGE_VERSION_KEY = 'zfl-4-change-version';
  private readonly LOCK_KEY_PREFIX = 'zfl-4-lock-';

  constructor() {
    this.windowId = `win-${crypto.randomUUID().slice(0, 8)}`;
    this.initSyncChannels();
  }

  static getInstance(): MultiWindowSyncService {
    if (!MultiWindowSyncService.instance) {
      MultiWindowSyncService.instance = new MultiWindowSyncService();
    }
    return MultiWindowSyncService.instance;
  }

  private initSyncChannels() {
    try {
      this.broadcastChannel = new BroadcastChannel('zfl-4-global-sync');
      this.broadcastChannel.onmessage = (ev) => this.handleIncomingSync(ev.data);
    } catch {
      this.broadcastChannel = null;
    }
    this.storageListener = (e: StorageEvent) => {
      if (e.key && e.newValue !== e.oldValue) {
        const dataType = this.matchDataTypeByStorageKey(e.key);
        if (dataType) {
          this.handleRemoteStorageChange(dataType, e.newValue, e.oldValue);
        }
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  private matchDataTypeByStorageKey(key: string): SyncDataType | null {
    for (const [dt, lsKey] of Object.entries(LS_KEY_MAP)) {
      if (lsKey === key) return dt as SyncDataType;
    }
    return null;
  }

  ngOnDestroy() {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    MultiWindowSyncService.instance = null;
  }

  subscribe(handler: (n: SyncNotification) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  private notify(n: SyncNotification) {
    for (const h of this.notificationHandlers) {
      try { h(n); } catch {}
    }
  }

  captureLocalSnapshot(dataType: SyncDataType, data: any) {
    this.localSnapshots.set(dataType, JSON.parse(JSON.stringify(data)));
  }

  getLocalSnapshot(dataType: SyncDataType): any {
    const snap = this.localSnapshots.get(dataType);
    return snap ? JSON.parse(JSON.stringify(snap)) : undefined;
  }

  private incrementChangeVersion() {
    const raw = localStorage.getItem(this.CHANGE_VERSION_KEY);
    const current = raw ? parseInt(raw, 10) || 0 : 0;
    const next = current + 1;
    localStorage.setItem(this.CHANGE_VERSION_KEY, String(next));
    return next;
  }

  private acquireLock(dataType: SyncDataType): boolean {
    const lockKey = this.LOCK_KEY_PREFIX + dataType;
    const now = Date.now();
    const existing = localStorage.getItem(lockKey);
    if (existing) {
      const { ts, wid } = JSON.parse(existing);
      if (wid !== this.windowId && now - ts < 2000) return false;
    }
    localStorage.setItem(lockKey, JSON.stringify({ ts: now, wid: this.windowId }));
    return true;
  }

  private releaseLock(dataType: SyncDataType) {
    const lockKey = this.LOCK_KEY_PREFIX + dataType;
    const existing = localStorage.getItem(lockKey);
    if (existing) {
      const { wid } = JSON.parse(existing);
      if (wid === this.windowId) localStorage.removeItem(lockKey);
    }
  }

  writeLocalData(dataType: SyncDataType, data: any) {
    const lsKey = LS_KEY_MAP[dataType];
    const json = JSON.stringify(data);
    if (!this.acquireLock(dataType)) return false;
    try {
      localStorage.setItem(lsKey, json);
      this.incrementChangeVersion();
      this.captureLocalSnapshot(dataType, data);
      const envelope: SyncEnvelope = {
        windowId: this.windowId,
        syncId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        dataType,
        payload: data,
        operation: 'replace',
      };
      this.broadcastChannel?.postMessage(envelope);
      this.pendingSyncs.set(envelope.syncId, envelope);
      return true;
    } finally {
      this.releaseLock(dataType);
    }
  }

  readLocalData<T = any>(dataType: SyncDataType): T | null {
    const lsKey = LS_KEY_MAP[dataType];
    const raw = localStorage.getItem(lsKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private handleIncomingSync(envelope: SyncEnvelope) {
    if (envelope.windowId === this.windowId) return;
    if (this.pendingSyncs.has(envelope.syncId)) return;
    this.notify({
      type: 'synced',
      dataType: envelope.dataType,
      message: `${DATA_TYPE_LABELS[envelope.dataType]} 已同步`,
    });
  }

  private handleRemoteStorageChange(dataType: SyncDataType, newValue: string | null, oldValue: string | null) {
    if (!newValue) return;
    let remoteData: any;
    try {
      remoteData = JSON.parse(newValue);
    } catch {
      return;
    }
    const snapshot = this.localSnapshots.get(dataType);
    if (snapshot === undefined) {
      this.captureLocalSnapshot(dataType, remoteData);
      return;
    }
    const conflicts = this.detectConflicts(dataType, snapshot, remoteData);
    if (conflicts.conflicts.length > 0) {
      this.notify({ type: 'conflicts', conflicts: [conflicts] });
    } else {
      this.captureLocalSnapshot(dataType, remoteData);
      this.notify({
        type: 'synced',
        dataType,
        message: `${DATA_TYPE_LABELS[dataType]} 已更新`,
      });
    }
  }

  detectConflicts(
    dataType: SyncDataType,
    baseSnapshot: any,
    remoteData: any,
    currentLocal?: any,
  ): SyncConflictGroup {
    const result: SyncConflictGroup = {
      dataType,
      typeLabel: DATA_TYPE_LABELS[dataType],
      conflicts: [],
    };

    if (dataType === 'kanbanSort') {
      return this.detectKanbanSortConflicts(baseSnapshot, remoteData, currentLocal);
    }
    if (dataType === 'prepData' || dataType === 'deliveryData') {
      return this.detectNestedDateKeyedConflicts(dataType, baseSnapshot, remoteData, currentLocal);
    }

    const baseArr = Array.isArray(baseSnapshot) ? baseSnapshot : [];
    const remoteArr = Array.isArray(remoteData) ? remoteData : [];
    const localArr = currentLocal !== undefined
      ? (Array.isArray(currentLocal) ? currentLocal : [])
      : baseArr;

    const remoteById = new Map(remoteArr.map((r: any) => [r.id, r]));
    const localById = new Map(localArr.map((r: any) => [r.id, r]));
    const baseById = new Map(baseArr.map((r: any) => [r.id, r]));
    const allIds = new Set([...remoteById.keys(), ...localById.keys()]);

    for (const id of allIds) {
      const base = baseById.get(id);
      const local = localById.get(id);
      const remote = remoteById.get(id);

      if (!base && !local && remote) continue;
      if (!remote && local) continue;

      if (base && local && remote) {
        const fieldConflicts = this.compareRecordFields(base, local, remote, dataType);
        if (fieldConflicts.length > 0) {
          result.conflicts.push({
            recordId: id,
            recordType: dataType,
            recordLabel: this.buildRecordLabel(dataType, local),
            localRecord: local,
            remoteRecord: remote,
            fieldConflicts,
            resolution: 'field-level',
            fieldResolutions: {},
          });
        }
      } else if (!base && local && remote && JSON.stringify(local) !== JSON.stringify(remote)) {
        const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
        const fieldConflicts: FieldConflict[] = [];
        for (const key of allKeys) {
          const lv = local[key];
          const rv = remote[key];
          if (JSON.stringify(lv) !== JSON.stringify(rv)) {
            fieldConflicts.push({ field: key, localValue: lv, remoteValue: rv });
          }
        }
        if (fieldConflicts.length > 0) {
          result.conflicts.push({
            recordId: id,
            recordType: dataType,
            recordLabel: this.buildRecordLabel(dataType, local),
            localRecord: local,
            remoteRecord: remote,
            fieldConflicts,
            resolution: 'keep-local',
          });
        }
      }
    }

    return result;
  }

  private detectKanbanSortConflicts(
    baseSnapshot: any,
    remoteData: any,
    currentLocal?: any,
  ): SyncConflictGroup {
    const result: SyncConflictGroup = {
      dataType: 'kanbanSort',
      typeLabel: DATA_TYPE_LABELS.kanbanSort,
      conflicts: [],
    };
    const local = currentLocal !== undefined ? currentLocal : baseSnapshot;
    const base = baseSnapshot || {};
    const remote = remoteData || {};
    const allDates = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote)]);
    for (const date of allDates) {
      const localDate = local?.[date] || {};
      const remoteDate = remote?.[date] || {};
      const baseDate = base?.[date] || {};
      const allVolIds = new Set([...Object.keys(localDate), ...Object.keys(remoteDate)]);
      for (const volId of allVolIds) {
        const lList = localDate[volId] || [];
        const rList = remoteDate[volId] || [];
        const bList = baseDate[volId] || [];
        const lChanged = JSON.stringify(lList) !== JSON.stringify(bList);
        const rChanged = JSON.stringify(rList) !== JSON.stringify(bList);
        if (lChanged && rChanged && JSON.stringify(lList) !== JSON.stringify(rList)) {
          result.conflicts.push({
            recordId: `${date}/${volId}`,
            recordType: 'kanbanSort',
            recordLabel: `${date} 志愿者#${volId.slice(-4)} 路线顺序`,
            localRecord: { date, volunteerId: volId, order: lList },
            remoteRecord: { date, volunteerId: volId, order: rList },
            fieldConflicts: [{
              field: 'order',
              localValue: lList,
              remoteValue: rList,
            }],
            resolution: 'keep-local',
          });
        }
      }
    }
    return result;
  }

  private detectNestedDateKeyedConflicts(
    dataType: SyncDataType,
    baseSnapshot: any,
    remoteData: any,
    currentLocal?: any,
  ): SyncConflictGroup {
    const result: SyncConflictGroup = {
      dataType,
      typeLabel: DATA_TYPE_LABELS[dataType],
      conflicts: [],
    };
    const local = currentLocal !== undefined ? currentLocal : baseSnapshot;
    const base = baseSnapshot || {};
    const remote = remoteData || {};
    const allDates = new Set([...Object.keys(base || {}), ...Object.keys(local || {}), ...Object.keys(remote || {})]);
    const typeName = dataType === 'prepData' ? '备餐' : '配送';

    for (const date of allDates) {
      const localDate = local?.[date] || {};
      const remoteDate = remote?.[date] || {};
      const baseDate = base?.[date] || {};
      const allTaskIds = new Set([...Object.keys(localDate), ...Object.keys(remoteDate)]);

      for (const taskId of allTaskIds) {
        const lEntry = localDate[taskId];
        const rEntry = remoteDate[taskId];
        const bEntry = baseDate[taskId];
        if (!lEntry && rEntry) continue;
        if (lEntry && !rEntry) continue;

        if (lEntry && rEntry) {
          const allKeys = new Set([
            ...Object.keys(bEntry || {}),
            ...Object.keys(lEntry),
            ...Object.keys(rEntry),
          ]);
          const fieldConflicts: FieldConflict[] = [];
          for (const key of allKeys) {
            const lv = lEntry[key];
            const rv = rEntry[key];
            const bv = bEntry?.[key];
            const lChanged = JSON.stringify(lv) !== JSON.stringify(bv);
            const rChanged = JSON.stringify(rv) !== JSON.stringify(bv);
            if (lChanged && rChanged && JSON.stringify(lv) !== JSON.stringify(rv)) {
              fieldConflicts.push({ field: key, localValue: lv, remoteValue: rv });
            }
          }
          if (fieldConflicts.length > 0) {
            result.conflicts.push({
              recordId: `${date}/${taskId}`,
              recordType: dataType,
              recordLabel: `${date} 任务#${taskId.slice(-4)} ${typeName}状态`,
              localRecord: { date, taskId, ...lEntry },
              remoteRecord: { date, taskId, ...rEntry },
              fieldConflicts,
              resolution: 'field-level',
              fieldResolutions: {},
            });
          }
        }
      }
    }
    return result;
  }

  private compareRecordFields(
    base: any,
    local: any,
    remote: any,
    dataType: SyncDataType,
  ): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    const allKeys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    const ignoredFields = this.getIgnoredFieldsForType(dataType);

    for (const key of allKeys) {
      if (ignoredFields.has(key)) continue;
      const lv = local[key];
      const rv = remote[key];
      const bv = base[key];
      const lChanged = JSON.stringify(lv) !== JSON.stringify(bv);
      const rChanged = JSON.stringify(rv) !== JSON.stringify(bv);
      if (lChanged && rChanged && JSON.stringify(lv) !== JSON.stringify(rv)) {
        conflicts.push({ field: key, localValue: lv, remoteValue: rv });
      }
    }
    return conflicts;
  }

  private getIgnoredFieldsForType(dataType: SyncDataType): Set<string> {
    switch (dataType) {
      case 'exceptionRecords': return new Set(['updatedAt']);
      case 'phoneNotifications': return new Set(['updatedAt']);
      case 'callbackTasks': return new Set(['updatedAt']);
      case 'visitRecords': return new Set(['createdAt']);
      default: return new Set();
    }
  }

  private buildRecordLabel(dataType: SyncDataType, record: any): string {
    switch (dataType) {
      case 'elders':
        return record?.name || `老人#${record?.id?.slice(-4)}`;
      case 'volunteers':
        return record?.name || `志愿者#${record?.id?.slice(-4)}`;
      case 'tasks':
        return `${record?.date} ${record?.id?.slice(-4)}`;
      case 'mealTags':
        return record?.name || `标签#${record?.id?.slice(-4)}`;
      case 'exceptionRecords':
        return `${record?.date} 异常#${record?.id?.slice(-4)}`;
      case 'visitRecords':
        return `${record?.visitDate} 回访#${record?.id?.slice(-4)}`;
      case 'phoneNotifications':
        return `${record?.date} 通知#${record?.id?.slice(-4)}`;
      case 'callbackTasks':
        return `${record?.date} 回拨#${record?.id?.slice(-4)}`;
      default:
        return `#${record?.id?.slice(-4) || 'unknown'}`;
    }
  }

  mergeConflicts(group: SyncConflictGroup, localData: any): any {
    const dataType = group.dataType;

    if (dataType === 'kanbanSort') {
      return this.mergeKanbanSort(group, localData);
    }
    if (dataType === 'prepData' || dataType === 'deliveryData') {
      return this.mergeNestedDateKeyed(group, localData);
    }

    const arr: any[] = Array.isArray(localData) ? [...localData] : [];
    const byId = new Map(arr.map((r, idx) => [r.id, idx]));

    for (const conflict of group.conflicts) {
      const merged = this.mergeSingleRecord(conflict);
      const idx = byId.get(conflict.recordId);
      if (idx !== undefined) {
        arr[idx] = merged;
      } else {
        arr.push(merged);
      }
    }
    return arr;
  }

  private mergeSingleRecord(conflict: RecordConflict): any {
    const { localRecord, remoteRecord, resolution, fieldConflicts, fieldResolutions } = conflict;
    if (resolution === 'keep-local') return { ...localRecord };
    if (resolution === 'adopt-remote') return { ...remoteRecord };

    const merged: any = { ...localRecord };
    for (const fc of fieldConflicts) {
      const choice = fieldResolutions?.[fc.field] || 'local';
      merged[fc.field] = choice === 'local' ? fc.localValue : fc.remoteValue;
    }
    return merged;
  }

  private mergeKanbanSort(group: SyncConflictGroup, localData: any): any {
    const merged: any = { ...(localData || {}) };
    for (const conflict of group.conflicts) {
      const [date, volId] = conflict.recordId.split('/');
      const choice = conflict.resolution === 'adopt-remote' ? 'remote' : 'local';
      const list = choice === 'local'
        ? conflict.localRecord.order
        : conflict.remoteRecord.order;
      if (!merged[date]) merged[date] = {};
      merged[date][volId] = [...list];
    }
    return merged;
  }

  private mergeNestedDateKeyed(group: SyncConflictGroup, localData: any): any {
    const merged: any = { ...(localData || {}) };
    for (const conflict of group.conflicts) {
      const [date, taskId] = conflict.recordId.split('/');
      const mergedEntry: any = {};
      const localEntry = merged[date]?.[taskId] || conflict.localRecord;
      const remoteEntry = conflict.remoteRecord;

      const allKeys = new Set([
        ...Object.keys(localEntry),
        ...Object.keys(remoteEntry),
      ]);
      allKeys.delete('date');
      allKeys.delete('taskId');

      if (conflict.resolution === 'keep-local') {
        for (const k of allKeys) mergedEntry[k] = localEntry[k];
      } else if (conflict.resolution === 'adopt-remote') {
        for (const k of allKeys) mergedEntry[k] = remoteEntry[k];
      } else {
        for (const fc of conflict.fieldConflicts) {
          const choice = conflict.fieldResolutions?.[fc.field] || 'local';
          mergedEntry[fc.field] = choice === 'local' ? fc.localValue : fc.remoteValue;
        }
        for (const k of allKeys) {
          if (!(k in mergedEntry)) mergedEntry[k] = localEntry[k];
        }
      }

      if (!merged[date]) merged[date] = {};
      merged[date][taskId] = mergedEntry;
    }
    return merged;
  }

  buildDedupKeyForException(r: { taskId: string; source: string; category?: string }): string {
    return `exc-${r.taskId}-${r.source}-${r.category || 'default'}`;
  }

  buildDedupKeyForNotification(n: { taskId: string; source: string; targetId: string }): string {
    return `notif-${n.taskId}-${n.source}-${n.targetId}`;
  }

  buildDedupKeyForCallback(c: { notificationId: string; status: string }): string {
    return `cb-${c.notificationId}-${c.status}`;
  }

  deduplicateArray<T extends { id: string }>(
    arr: T[],
    keyFn: (item: T) => string,
  ): T[] {
    const seen = new Map<string, T>();
    for (const item of arr) {
      const key = keyFn(item);
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }
}

export const SYNC_INSTANCE = () => MultiWindowSyncService.getInstance();
