## 📚 学习路径

### 第一步：了解项目背景和功能 (15分钟)
1. **阅读 README_REACT.md** - 了解项目概述、功能特性
2. **阅读 MIGRATION_COMPLETE.md** - 了解项目架构和技术栈
3. **启动项目体验功能**：
   ```bash
   pnpm install
   pnpm dev
   # 访问 http://localhost:5173
   ```
4. **实际操作一次完整流程**：
   - 配置几个AI医生（全局设置）
   - 输入患者信息
   - 开始会诊
   - 观察多轮讨论和投票过程
   - 查看最终答案

### 第二步：理解数据流和状态管理 (30分钟)

#### 核心状态管理（Zustand stores）
建议按此顺序阅读：

1. **useGlobalStore.js** (最简单，约100行)
   - 全局配置：医生列表、图像识别设置、预设提示词
   - localStorage 持久化
   - 学习要点：基础的 Zustand store 结构

2. **useSessionsStore.js** (中等，约150行)
   - 多会话管理
   - 会话的增删改查、切换
   - 学习要点：状态同步、localStorage 序列化

3. **useConsultStore.js** (最复杂，约423行) ⭐
   - **核心业务逻辑**：整个会诊流程都在这里
   - 关键方法学习顺序：
     ```
     startConsultation()     // 启动会诊
     ↓
     runDiscussionRound()    // 运行一轮讨论
     ↓
     parseVote()             // 解析投票结果
     ↓
     autoVoteAndProceed()    // 自动投票并继续
     ↓
     finalizeSummary()       // 生成最终答案
     ```

### 第三步：理解 UI 组件层次 (45分钟)

#### 组件学习顺序（从简单到复杂）

**基础展示组件**（先看这些）：
1. DoctorList.jsx (约30行) - 医生列表展示
2. VoteTally.jsx (约40行) - 投票统计
3. ExpandableText.jsx (约50行) - 可折叠文本

**核心交互组件**（重点理解）：
4. ChatDisplay.jsx ⭐ (约120行)
   - 消息展示：医生发言、系统消息、投票信息
   - Markdown 渲染
   - 自动滚动到底部

5. CaseInputForm.jsx ⭐⭐ (约180行)
   - 患者信息输入表单
   - 图片上传和识别队列
   - 学习要点：**useImageRecognitionQueue.js** 并发控制

6. DiscussionPanel.jsx ⭐ (约150行)
   - 会诊讨论主面板
   - 暂停/继续控制
   - 状态切换逻辑

7. StatusPanel.jsx ⭐⭐ (约200行)
   - 状态总览
   - PDF/图片导出功能
   - 学习要点：**exportSession.js** 导出逻辑

**配置管理组件**（可选深入）：
8. GlobalSettingsModal.jsx (约490行)
   - 医生配置、拖拽排序（@dnd-kit）
   - 图像识别配置和测试
   - 配置导入导出

9. ConsultationSettingsModal.jsx (约290行)
   - 问诊设置、关联历史问诊
   
10. SessionListDrawer.jsx (约190行)
    - 会话列表管理

### 第四步：理解关键业务逻辑 (60分钟)

#### 重点研究这些流程：

1. **会诊流程** (src/store/useConsultStore.js)
   ```
   配置阶段 → 开始会诊 → 讨论轮次 → 投票淘汰 → 最终答案
   ```
   - 如何调用 AI API
   - 如何解析投票结果（JSON + 正则备用）
   - 如何判断淘汰医生
   - 如何生成最终答案

2. **图片识别队列** (src/hooks/useImageRecognitionQueue.js)
   - 并发控制（maxConcurrent）
   - 队列状态管理
   - 错误重试机制

3. **会话持久化** (src/store/useSessionsStore.js)
   - 如何序列化到 localStorage
   - 如何在会话间切换
   - 如何关联历史会诊

### 第五步：API 和工具函数 (30分钟)

1. **callAI.js** - 调用不同 LLM 供应商的统一接口
2. **imageRecognition.js** - 硅基流动图像识别 API
3. **prompt.js** - 提示词构建工具
4. **exportSession.js** - PDF/图片导出

### 第六步：实践练习

#### 建议的实践任务：

**初级练习**：
1. 修改界面颜色主题
2. 添加一个新的医生供应商选项
3. 调整投票轮数的默认值

**中级练习**：
1. 给 ChatDisplay 添加消息搜索功能
2. 给状态面板添加统计图表（讨论轮次、投票分布）
3. 优化图片识别队列的显示效果

**高级练习**：
1. 实现投票历史的可视化时间线
2. 添加会诊过程的回放功能
3. 实现多个会诊的对比分析功能

## 💡 学习建议

### 调试技巧：
```javascript
// 在 useConsultStore.js 中添加日志
console.log('当前状态:', get().status);
console.log('医生列表:', get().doctors);
console.log('消息历史:', get().messages);
```

### 关键概念：
1. **Zustand 状态管理**：`create()` 创建 store，`set()` 更新状态，`get()` 获取状态
2. **React Hooks**：`useState`, `useEffect`, `useCallback`, `useMemo`
3. **异步流程控制**：Promise、async/await、并发控制
4. **localStorage 持久化**：序列化、反序列化

### 推荐阅读文档：
- Zustand: https://github.com/pmndrs/zustand
- Ant Design: https://ant.design/components/overview-cn
- @dnd-kit: https://docs.dndkit.com/
