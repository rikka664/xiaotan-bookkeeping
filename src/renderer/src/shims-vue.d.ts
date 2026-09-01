// 让 TypeScript 认识 .vue 文件（单独的声明文件，保持全局生效）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
