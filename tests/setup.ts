// 测试环境补齐：jsdom 缺少的浏览器 API，element-plus 组件会用到
// （测试跑在模拟浏览器里，这些 API 补上才不会报错）
import { vi } from 'vitest'

// 界面组件在"模拟失败"用例里会打印错误日志，测试时静音，避免刷屏
vi.spyOn(console, 'error').mockImplementation(() => {})

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList
}
