## 项目介绍
实现一个 A2UI-playground, 用户通过 web 应用生成对应的 UI 界面。

## 项目架构
项目使用 monorepo 组织代码
包含一下几个核心模块

### packages 
a2ui SDK - npm 包

- a2ui-core: 包含 UI 组件库和渲染引擎
    - parser: 解析 a2ui 协议
    - vnode: 映射管理 a2ui 协议生成的组件
    - treebuilder: 根据 a2ui 协议调用 a2ui 渲染器, 并生成最终的渲染树
- a2ui-vue: 基于 vue 的 a2ui 协议渲染引擎

#### 主要职责
1. 维护 a2ui 相关的 sdk, 并支持生产对应的 npm 包

### web
web 应用

- a2ui-playground: 包含 A2UI-playground 的 web 应用

#### 主要职责及详细功能
1. 可以通过对话的方式, 让 AI Agent 生成对应的UI界面
2. 可以在 web 应用中预览对应的 AI 界面
3. 可以支持多轮对话, 对生成的 UI 进行调整
4. 可以预览 a2ui-vue 定义的基础 a2ui 组件
5. 可以支持协议调试

### server
server 端应用

- a2ui-playground-server: 包含 A2UI-playground 的 server 端应用

#### 主要职责及详细功能
1. 基于 openAI, 实现 a2ui agent
2. 实现 a2ui-server, 支持 a2ui 协议的生成及缓存

### 基础依赖
所有的项目需要支持 typescript

web
- 使用 vite 构建 playground

server
- 使用 koa 实现服务接口
- agent 基于 openAI 建立
- 使用 ts-node 运行
