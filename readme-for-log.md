## 📋 项目概述

这是一个**多 AI 医生协作诊疗系统**,让多个 AI 模型扮演不同医生角色,共同讨论病例并给出诊断建议。

### 技术栈对比

| 技术 | 本项目 (Vue 3) | React 对应 |
|------|----------------|------------|
| **框架** | Vue 3 + Composition API | React + Hooks |
| **状态管理** | Pinia | Redux/Zustand/Context |
| **UI 库** | Ant Design Vue | Ant Design React |
| **构建工具** | Vite | Vite/Create React App |
| **数据持久化** | localStorage | localStorage |

---

## 🏗️ 项目架构

```
ai-doctor/
├── src/
│   ├── main.js              # 入口文件 (类似 React 的 index.js)
│   ├── App.vue              # 根组件 (类似 App.jsx)
│   ├── store/               # 状态管理 (类似 Redux store)
│   │   ├── index.js         # 主要业务逻辑 store
│   │   ├── sessions.js      # 会话管理 store
│   │   └── global.js        # 全局配置 store
│   ├── components/          # UI 组件 (类似 React components)
│   ├── api/                 # API 调用层
│   ├── utils/               # 工具函数
│   └── composables/         # 组合式函数 (类似 React Hooks)
```

---

## 🔄 完整业务流程

### **阶段 1: 初始化与配置**

```javascript
// main.js - 应用入口
import { createApp } from 'vue'
import { createPinia } from 'pinia'  // 状态管理库
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())  // 类似 React 的 <Provider store={store}>
app.mount('#app')
```

**React 对比:**
```jsx
// React 版本
import { Provider } from 'react-redux'
ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
)
```

---

### **阶段 2: 状态管理结构**

#### **核心 Store (store/index.js)**

```javascript
export const useConsultStore = defineStore('consult', {
  state: () => ({
    consultationName: '',           // 会诊名称
    settings: {                     // 全局设置
      globalSystemPrompt: '...',    // AI 系统提示词
      turnOrder: 'random',          // 发言顺序
      maxRoundsWithoutElimination: 3
    },
    doctors: [],                    // 医生列表
    patientCase: {                  // 患者病例
      name: '', gender: '', age: null,
      currentProblem: '', pastHistory: ''
    },
    workflow: {                     // 工作流状态
      phase: 'setup',               // 阶段: setup/discussion/voting/finished
      currentRound: 0,              // 当前轮次
      activeTurn: null,             // 当前发言医生
      paused: false                 // 是否暂停
    },
    discussionHistory: [],          // 讨论历史记录
    finalSummary: {}                // 最终总结
  })
})
```

**React 对比 (使用 Zustand):**
```javascript
const useConsultStore = create((set) => ({
  consultationName: '',
  doctors: [],
  startConsultation: () => set({ phase: 'discussion' })
}))
```

---

### **阶段 3: 完整诊疗流程**

#### **流程图:**

```
┌─────────────┐
│  1. 配置阶段 │ (setup)
│  - 添加医生  │
│  - 输入病例  │
└──────┬──────┘
       ↓
┌─────────────┐
│  2. 讨论阶段 │ (discussion)
│  - 医生轮流  │ ← 打字机效果
│  - AI 发言   │   逐字显示
└──────┬──────┘
       ↓
┌─────────────┐
│  3. 投票阶段 │ (voting)
│  - 互相评估  │
│  - 淘汰机制  │ ← 最差的被淘汰
└──────┬──────┘
       ↓
  是否继续? ──Yes→ 返回讨论
       ↓ No
┌─────────────┐
│  4. 结束阶段 │ (finished)
│  - 生成总结  │
│  - 导出报告  │
└─────────────┘
```

---

### **流程详解:**

#### **步骤 1: 开始会诊**

```javascript
// store/index.js - startConsultation 方法
startConsultation() {
  // 1. 校验输入
  if (!this.patientCase.name || !this.patientCase.currentProblem) {
    throw new Error('请填写患者信息')
  }
  
  // 2. 重置状态
  this.doctors = this.doctors.map(d => ({
    ...d, 
    status: 'active',  // 所有医生激活
    votes: 0           // 票数清零
  }))
  
  // 3. 进入讨论阶段
  this.workflow.phase = 'discussion'
  this.workflow.currentRound = 1
  
  // 4. 生成发言顺序
  this.generateTurnQueue()
  
  // 5. 开始讨论
  this.runDiscussionRound()
}
```

---

#### **步骤 2: 讨论轮次 (核心逻辑)**

```javascript
async runDiscussionRound() {
  // 遍历所有在席医生
  for (const doctorId of this.workflow.turnQueue) {
    const doctor = this.doctors.find(d => d.id === doctorId)
    
    // 1. 显示"正在输入..."
    this.discussionHistory.push({
      type: 'system',
      content: `${doctor.name} 正在输入...`
    })
    
    // 2. 构建 AI 提示词
    const fullPrompt = buildFullPrompt(
      doctor.customPrompt,        // 医生角色提示词
      this.patientCase,           // 患者病例
      this.discussionHistory,     // 历史讨论
      doctor.id,
      this.linkedConsultations    // 关联病例
    )
    
    // 3. 调用 AI API
    const response = await callAI(doctor, fullPrompt, providerHistory)
    
    // 4. 打字机效果显示回复
    const msg = { type: 'doctor', doctorId, doctorName, content: '' }
    this.discussionHistory.push(msg)
    
    for (let i = 0; i < response.length; i++) {
      this.discussionHistory[messageIndex].content += response[i]
      await delay(15)  // 每个字符延迟 15ms
    }
  }
  
  // 5. 进入投票阶段
  this.workflow.phase = 'voting'
  await this.autoVoteAndProceed()
}
```

**React 对比:**
```jsx
// React 版本使用 useEffect + useState
const [messages, setMessages] = useState([])
const [isTyping, setIsTyping] = useState(false)

useEffect(() => {
  async function runRound() {
    setIsTyping(true)
    const response = await callAI(...)
    
    // 打字机效果
    for (let char of response) {
      setMessages(prev => [...prev, char])
      await delay(15)
    }
    setIsTyping(false)
  }
  runRound()
}, [round])
```

---

#### **步骤 3: AI 调用层 (api/callAI.js)**

```javascript
export async function callAI(doctor, fullPrompt, historyForProvider) {
  const { provider, model, apiKey, baseUrl } = doctor
  
  // 根据不同供应商调用不同 API
  switch (provider) {
    case 'openai':
      return callOpenAI({ apiKey, model, fullPrompt, history })
    case 'anthropic':
      return callAnthropic({ apiKey, model, fullPrompt, history })
    case 'gemini':
      return callGemini({ apiKey, model, fullPrompt, history })
    // ... 其他供应商
  }
}

// OpenAI 调用示例
async function callOpenAI({ apiKey, model, fullPrompt, history }) {
  const messages = [
    { role: 'system', content: fullPrompt.system },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: fullPrompt.user }
  ]
  
  const res = await axios.post(
    `${baseUrl}/v1/chat/completions`,
    { model, messages, temperature: 0.7 },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  
  return res.data.choices[0].message.content.trim()
}
```

---

#### **步骤 4: 投票与淘汰机制**

```javascript
async autoVoteAndProceed() {
  this.resetVotes()
  
  // 每个医生都投票选出"最不准确"的医生
  for (const voter of activeDoctors) {
    const votePrompt = buildVotePrompt(
      voter.customPrompt,
      this.patientCase,
      this.discussionHistory,
      this.doctors,
      voter
    )
    
    // AI 返回 JSON: {"targetDoctorId":"xxx", "reason":"..."}
    const response = await callAI(voter, votePrompt, ...)
    const voteData = parseVoteJSON(response)
    
    // 给目标医生加票
    const target = this.doctors.find(d => d.id === voteData.targetDoctorId)
    target.votes++
  }
  
  // 淘汰票数最多的医生
  const maxVotes = Math.max(...this.doctors.map(d => d.votes))
  this.doctors = this.doctors.map(d => ({
    ...d,
    status: d.votes === maxVotes ? 'eliminated' : 'active'
  }))
  
  // 判断是否继续或结束
  if (activeDoctors.length === 1 || 
      this.workflow.roundsWithoutElimination >= maxRounds) {
    await this.finishConsultation()
  } else {
    this.startNextRound()
  }
}
```

---

#### **步骤 5: 生成最终总结**

```javascript
async finishConsultation() {
  this.workflow.phase = 'finished'
  
  // 选择票数最少的医生来做总结
  const summarizer = this.doctors
    .filter(d => d.status === 'active')
    .sort((a, b) => a.votes - b.votes)[0]
  
  const summaryPrompt = buildFinalSummaryPrompt(
    this.settings.summaryPrompt,
    this.patientCase,
    this.discussionHistory,
    summarizer.id
  )
  
  const summary = await callAI(summarizer, summaryPrompt, ...)
  
  this.finalSummary = {
    status: 'completed',
    doctorName: summarizer.name,
    content: summary
  }
}
```

---

### **阶段 4: 组件层 (Components)**

#### **主应用组件结构:**

```vue
<!-- App.vue -->
<template>
  <div class="app-container">
    <!-- 顶部状态栏 -->
    <StatusPanel 
      :phase="workflow.phase"
      :round="workflow.currentRound"
      :activeTurn="workflow.activeTurn"
    />
    
    <!-- 左侧:医生列表 -->
    <DoctorList 
      :doctors="doctors"
      @add="addDoctor"
      @remove="removeDoctor"
    />
    
    <!-- 中间:讨论面板 -->
    <ChatDisplay 
      :messages="discussionHistory"
      :typing="workflow.activeTurn"
    />
    
    <!-- 右侧:控制面板 -->
    <VotingControls
      v-if="workflow.phase === 'voting'"
      @next="startNextRound"
    />
    
    <!-- 设置模态框 -->
    <GlobalSettingsModal
      v-model:visible="showSettings"
      :settings="settings"
      @save="updateSettings"
    />
  </div>
</template>

<script setup>
import { useConsultStore } from './store'
import { storeToRefs } from 'pinia'

const store = useConsultStore()
const { doctors, workflow, discussionHistory } = storeToRefs(store)
</script>
```

**React 对比:**
```jsx
// React 版本
function App() {
  const { doctors, workflow, discussionHistory } = useConsultStore()
  
  return (
    <div className="app-container">
      <StatusPanel phase={workflow.phase} round={workflow.currentRound} />
      <DoctorList doctors={doctors} onAdd={addDoctor} />
      <ChatDisplay messages={discussionHistory} />
      <VotingControls onNext={startNextRound} />
    </div>
  )
}
```

---

### **阶段 5: 数据持久化 (sessions.js)**

```javascript
export const useSessionsStore = defineStore('sessions', {
  state: () => ({
    sessions: [],      // 所有会诊记录
    currentId: ''      // 当前会诊 ID
  }),
  
  actions: {
    // 创建新会诊
    createNew(name) {
      const id = `consult-${Date.now()}`
      const session = {
        id,
        name,
        status: '配置/准备',
        createdAt: new Date().toISOString()
      }
      this.sessions.unshift(session)
      
      // 保存到 localStorage
      localStorage.setItem('sessions', JSON.stringify(this.sessions))
      localStorage.setItem(`session_${id}`, JSON.stringify({
        doctors: [],
        patientCase: {},
        discussionHistory: []
      }))
    },
    
    // 切换会诊
    switchTo(id) {
      this.currentId = id
      const data = JSON.parse(localStorage.getItem(`session_${id}`))
      
      // 加载到主 store
      const consult = useConsultStore()
      consult.doctors = data.doctors
      consult.patientCase = data.patientCase
      consult.discussionHistory = data.discussionHistory
    }
  }
})
```

---

## 🎯 关键技术点

### 1. **响应式状态 (Vue 3 vs React)**

```javascript
// Vue 3 - 自动追踪依赖
const store = useConsultStore()
store.doctors.push(newDoctor)  // 自动触发更新

// React - 必须使用 setter
const [doctors, setDoctors] = useState([])
setDoctors([...doctors, newDoctor])  // 手动触发更新
```

### 2. **计算属性 (Getters)**

```javascript
// Vue Pinia
getters: {
  activeDoctors(state) {
    return state.doctors.filter(d => d.status === 'active')
  }
}

// React 等价
const activeDoctors = useMemo(
  () => doctors.filter(d => d.status === 'active'),
  [doctors]
)
```

### 3. **异步流程控制**

```javascript
// 暂停/恢复功能
async waitWhilePaused() {
  while (this.workflow.paused) {
    await delay(100)  // 每 100ms 检查一次
  }
}

// 在需要暂停的地方调用
await this.waitWhilePaused()
```

---

## 📊 数据流图

```
┌─────────────┐
│  用户操作    │
│ (点击按钮)   │
└──────┬──────┘
       ↓
┌─────────────┐
│   Actions   │ ← store/index.js 中的方法
│ (业务逻辑)   │
└──────┬──────┘
       ↓
┌─────────────┐
│  API 调用   │ ← api/callAI.js
│ (调用 AI)    │
└──────┬──────┘
       ↓
┌─────────────┐
│  State 更新 │ ← Pinia state
│ (状态变化)   │
└──────┬──────┘
       ↓
┌─────────────┐
│  UI 重渲染  │ ← Vue 组件自动更新
│ (界面刷新)   │
└─────────────┘
```

---

## 🔥 核心特性实现

### **1. 打字机效果**

```javascript
// 逐字显示 AI 回复
for (let i = 0; i < response.length; i++) {
  this.discussionHistory[messageIndex].content += response[i]
  await delay(15)  // 15ms 延迟
}
```

### **2. 多模型支持**

```javascript
// 统一接口,支持多个 AI 供应商
switch (provider) {
  case 'openai': return callOpenAI(...)
  case 'anthropic': return callAnthropic(...)
  case 'gemini': return callGemini(...)
}
```

### **3. 会话管理**

```javascript
// 自动保存到 localStorage
saveSnapshotFromConsult() {
  const snapshot = JSON.parse(JSON.stringify(consult.$state))
  localStorage.setItem(`session_${id}`, JSON.stringify(snapshot))
}
```

---

## 🆚 Vue 3 vs React 对比总结

| 特性 | Vue 3 | React |
|------|-------|-------|
| **状态管理** | Pinia (defineStore) | Redux/Zustand |
| **响应式** | 自动追踪 (Proxy) | 手动 setState |
| **模板** | `<template>` | JSX |
| **生命周期** | onMounted, onUnmounted | useEffect |
| **计算属性** | getters | useMemo |
| **双向绑定** | v-model | value + onChange |
| **条件渲染** | v-if / v-show | && / 三元运算符 |

---

## 🚀 运行流程总结

1. **启动应用** → 初始化 Pinia stores
2. **用户配置** → 添加医生、填写病例
3. **开始会诊** → 进入 discussion 阶段
4. **AI 轮流发言** → 打字机效果显示
5. **投票淘汰** → 医生互评,淘汰不准确的
6. **循环 3-5** → 直到满足结束条件
7. **生成总结** → 最优医生输出最终诊断
8. **保存记录** → 存入 localStorage

希望这个详细的介绍能帮助你理解整个项目!有任何问题随时问我 😊