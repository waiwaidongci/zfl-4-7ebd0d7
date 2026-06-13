# 志愿者送餐管理应用

社区老人送餐全流程管理系统，覆盖排班、备餐、配送、闭环管理等核心业务场景。所有数据存储在浏览器 localStorage 中，支持多窗口实时同步和数据导入导出。

## 功能模块

### 1. 每日排班（Schedule）
- **老人档案管理**：维护老人基本信息、餐食偏好、标签、送餐地址、联系方式、配送日期、暂停日期等
- **志愿者管理**：维护志愿者信息、配送能力、熟悉片区、可用日期
- **餐食标签管理**：自定义餐食标签（少盐、糖尿病餐、素食、软饭等）
- **任务生成与分配**：按日期生成送餐任务，支持自动分配和手动调整
- **排班模拟**：多日排班模拟预览，确认无误后提交写入正式数据
- **路线看板**：按志愿者分组的任务看板，支持拖拽调整路线顺序
- **临时送餐变更**：针对特定日期的地址、联系方式、餐食标签、志愿者等临时调整
- **异常处置闭环**：异常记录登记、处理进度跟踪
- **电话通知与回拨**：电话通知记录、回拨任务管理
- **老人回访**：回访记录管理，包含健康反馈、用餐反馈、下次关注事项

### 2. 备餐产能与出餐核对（Meal Prep）
- 每日备餐总览，按标签/批次分组统计
- 备餐状态流转（待备餐 → 备餐中 → 已完成 / 缺餐异常）
- 批量状态更新
- 厨房打印视图，支持按批次打印
- 缺餐异常自动登记

### 3. 志愿者配送（Volunteer Delivery）
- 志愿者视角的配送任务列表
- 配送状态流转（待配送 → 配送中 → 已送达 / 异常 / 未接通）
- 配送异常登记与通知
- 回访提醒处理
- 电话拨打结果记录
- 路线顺序显示

### 4. 闭环仪表盘（Closure Dashboard）
- 全局数据概览
- 异常处理进度统计
- 任务完成率分析
- 志愿者负载统计

## 数据存储

### localStorage 数据来源

应用所有业务数据均存储在浏览器 `localStorage` 中，不依赖后端服务。首次打开且本地没有历史数据时，应用会使用源码内置的演示数据作为初始状态，包括 3 位老人、2 名志愿者和预设餐食标签；用户后续录入、编辑或导入的数据会写入 `localStorage`，并在下次启动时优先读取本地数据。

**存储键列表**：

| 数据类型 | localStorage Key | 说明 |
|---------|-----------------|------|
| 老人档案 | `zfl-4-elders` | 老人基本信息数组 |
| 志愿者信息 | `zfl-4-volunteers` | 志愿者信息数组 |
| 送餐任务 | `zfl-4-tasks` | 送餐任务数组 |
| 餐食标签 | `zfl-4-meal-tags` | 餐食标签数组 |
| 异常记录 | `zfl-4-exceptions` | 异常处置记录 |
| 回访记录 | `zfl-4-visits` | 老人回访记录 |
| 电话通知 | `zfl-4-phone-notifications` | 电话通知记录 |
| 回拨任务 | `zfl-4-callback-tasks` | 回拨任务队列 |
| 看板排序 | `zfl-4-kanban-sort` | 志愿者路线排序 |
| 备餐状态 | `zfl-4-prep-data` | 按日期+任务ID的备餐状态 |
| 配送状态 | `zfl-4-delivery-data` | 按日期+任务ID的配送状态 |
| 临时变更 | `zfl-4-temp-delivery-changes` | 临时送餐变更记录 |
| 离线草稿 | `zfl-4-offline-delivery-drafts` | 离线配送草稿 |
| 变更版本号 | `zfl-4-change-version` | 多窗口同步用的版本计数器 |

### 数据导入导出

应用支持完整的数据导入导出功能，便于数据备份和迁移。

**导出**：
- 点击「📦 数据导入导出」按钮
- 选择导出范围（全部数据或指定类型）
- 生成 JSON 格式备份文件下载

**导入**：
- 选择 JSON 备份文件
- 系统自动解析并预览导入内容
- 对每条数据标记为「新增」「重复」或「覆盖」
- 确认后执行导入

**导入导出格式**：
```json
{
  "version": "1.0",
  "exportedAt": "2024-06-14T08:00:00.000Z",
  "elders": [...],
  "volunteers": [...],
  "tasks": [...],
  "mealTags": [...],
  "exceptionRecords": [...],
  "visitRecords": [...],
  "phoneNotifications": [...],
  "callbackTasks": [...],
  "kanbanSort": {...},
  "prepData": {...},
  "deliveryData": {...},
  "temporaryDeliveryChanges": [...]
}
```

## 多窗口同步

应用支持同一浏览器下多个标签页/窗口间的实时数据同步。

### 同步机制
- **BroadcastChannel API**：主通道，支持同源窗口间实时消息广播
- **StorageEvent**：备用通道，监听 localStorage 变化进行同步
- **版本号机制**：`zfl-4-change-version` 计数器标记数据变更
- **分布式锁**：基于 localStorage 的乐观锁，防止并发写入冲突

### 冲突检测与解决
当多个窗口同时修改同一数据时，系统会自动检测冲突：
- 基于快照的三路合并（本地快照 + 本地当前 + 远程）
- 支持字段级别的冲突解决
- 提供「保留本地」「采用远程」「字段级」三种解决策略

### 使用注意事项
1. **同一浏览器**：多窗口同步仅在同一浏览器的同源页面间生效
2. **数据备份**：定期导出数据备份，避免浏览器缓存清理导致数据丢失
3. **并发操作**：尽量避免多人同时编辑同一条记录，减少冲突概率
4. **隐私模式**：隐私/无痕模式下 localStorage 数据不会持久化
5. **清除缓存**：清除浏览器数据会导致所有本地数据丢失，请务必先导出备份

## 快速开始

### 环境要求
- Node.js >= 20.x
- npm >= 10.x

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
# 或
npm run dev
```

启动后访问 `http://localhost:5174` 查看应用。

### 运行测试

```bash
# 运行所有单元测试（单次）
npm run test:ci

# 监听模式运行测试
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

### 构建

```bash
# 生产环境构建
npm run build:prod

# 开发环境构建
npm run build:dev
```

构建产物输出到 `dist/` 目录。

### 代码格式化

```bash
# 检查格式
npm run format:check

# 自动格式化
npm run format
```

## 技术栈

- **框架**：Angular 20
- **语言**：TypeScript 5.9
- **样式**：原生 CSS
- **测试**：Jasmine + Karma
- **构建工具**：Angular CLI / Angular Build
- **数据存储**：浏览器 localStorage
- **多窗口通信**：BroadcastChannel + StorageEvent

## 项目结构

```
src/
├── app/
│   ├── meal-prep/              # 备餐模块
│   │   ├── meal-prep.component.ts
│   │   ├── meal-prep.service.ts
│   │   ├── meal-prep.service.spec.ts
│   │   ├── meal-prep.types.ts
│   │   └── kitchen-print.component.ts
│   ├── volunteer-delivery/     # 志愿者配送模块
│   │   ├── volunteer-delivery.component.ts
│   │   ├── volunteer-delivery.service.ts
│   │   ├── volunteer-delivery.service.spec.ts
│   │   ├── volunteer-delivery.types.ts
│   │   ├── delivery-detail.component.ts
│   │   ├── delivery-status-buttons.component.ts
│   │   └── volunteer-selector.component.ts
│   ├── closure-dashboard/      # 闭环仪表盘模块
│   │   ├── closure-dashboard.component.ts
│   │   ├── closure-dashboard.service.ts
│   │   ├── closure-dashboard.service.spec.ts
│   │   └── closure-dashboard.types.ts
│   ├── sync.service.ts         # 多窗口同步服务
│   ├── shared.types.ts         # 共享类型定义
│   ├── app.ts                  # 根组件
│   └── app.config.ts           # 应用配置
├── main.ts                     # 入口文件
├── test.ts                     # 测试入口
├── index.html
└── styles.css
```

## CI/CD

项目配置了 GitHub Actions 持续集成流水线，在每次 push 和 PR 时自动执行：

1. 依赖安装（`npm ci`）
2. 代码格式检查（`npm run format:check`）
3. 单元测试（`npm run test:ci`）
4. 生产构建（`npm run build:prod`）
5. 构建产物上传（保留 7 天）

配置文件位于 [.github/workflows/ci.yml](.github/workflows/ci.yml)。
