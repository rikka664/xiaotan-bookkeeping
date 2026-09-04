// uni-app 入口文件：手机版 App 从这里启动（相当于电脑版的 src/main/index.ts）
import App from './App'
import { createSSRApp } from 'vue'

// uni-app 规定：入口文件必须导出一个 createApp 函数，框架启动时会调用它
// createSSRApp 是 Vue3 提供的"创建应用"方法，把根组件 App 交给它就行
export function createApp() {
  const app = createSSRApp(App)
  return { app }
}
