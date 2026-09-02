// 「统计视图」页面测试：周期切换、饼图合并逻辑、空数据提示、排行占比
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import StatsView from '../src/renderer/src/views/StatsView.vue'
import { CATEGORIES } from '../src/shared/categories'

// 假扮 echarts 图表库（测试里画不了真图，记录它收到了什么数据）
const echartsState = vi.hoisted(() => ({
  init: vi.fn(),
  chart: { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
}))
vi.mock('echarts', () => ({ init: echartsState.init }))

// 假扮提示气泡
const elMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    default: actual.default,
    ElMessage: { ...actual.ElMessage, success: elMocks.success, error: elMocks.error, info: elMocks.info }
  }
})

// 假扮"传话窗口"（window.api）
const api = { getStats: vi.fn() }

const wrappers: VueWrapper[] = []

function mountView(): VueWrapper {
  const w = mount(StatsView, { global: { plugins: [ElementPlus] }, attachTo: document.body })
  wrappers.push(w)
  return w
}

// 10 个分类都有数据：金额从 100 分到 1000 分
function tenCats(): Array<{ category: string; totalCents: number; count: number }> {
  return CATEGORIES.map((c, i) => ({ category: c.name, totalCents: (i + 1) * 100, count: 1 }))
}

beforeEach(() => {
  ;(window as unknown as { api: typeof api }).api = api
  api.getStats.mockReset()
  echartsState.init.mockReset().mockReturnValue(echartsState.chart)
  echartsState.chart.setOption.mockReset()
  echartsState.chart.resize.mockReset()
  echartsState.chart.dispose.mockReset()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('统计视图页面', () => {
  it('打开页面默认加载「本月」统计，展示总支出和笔数', async () => {
    api.getStats.mockResolvedValue({ totalCents: 5500, count: 10, byCategory: tenCats() })
    const w = mountView()
    await flushPromises()

    expect(api.getStats).toHaveBeenCalledWith('month')
    expect(w.text()).toContain('¥55.00')
    expect(w.text()).toContain('共 10 笔')
  })

  it('饼图超过 7 个分类时，后面的合并进「其他分类」灰色扇区', async () => {
    api.getStats.mockResolvedValue({ totalCents: 5500, count: 10, byCategory: tenCats() })
    mountView()
    await flushPromises()

    expect(echartsState.init).toHaveBeenCalledTimes(1)
    const option = echartsState.chart.setOption.mock.calls[0][0] as {
      series: Array<{ data: Array<{ name: string; value: number }> }>
    }
    const data = option.series[0].data
    expect(data).toHaveLength(8)
    expect(data[7].name).toContain('其他分类')
    expect(data[7].value).toBe(2700) // 第 8~10 名合计：800 + 900 + 1000
  })

  it('切换「今年」会重新拉取统计', async () => {
    api.getStats.mockResolvedValue({ totalCents: 0, count: 0, byCategory: [] })
    const w = mountView()
    await flushPromises()

    const radios = w.findAll('input[type="radio"]')
    expect(radios).toHaveLength(3)
    await radios[1].setValue(true)
    await flushPromises()

    expect(api.getStats).toHaveBeenLastCalledWith('year')
  })

  it('没有数据时显示空提示，不画图', async () => {
    api.getStats.mockResolvedValue({ totalCents: 0, count: 0, byCategory: [] })
    const w = mountView()
    await flushPromises()

    expect(w.text()).toContain('还没有记账记录')
    expect(echartsState.init).not.toHaveBeenCalled()
  })

  it('分类排行展示每个分类的金额和占比', async () => {
    api.getStats.mockResolvedValue({
      totalCents: 10000,
      count: 2,
      byCategory: [
        { category: '餐饮饮食', totalCents: 7500, count: 1 },
        { category: '交通出行', totalCents: 2500, count: 1 }
      ]
    })
    const w = mountView()
    await flushPromises()

    const text = w.text()
    expect(text).toContain('¥100.00')
    expect(text).toContain('¥75.00')
    expect(text).toContain('¥25.00')
    expect(text).toContain('75.0%')
    expect(text).toContain('25.0%')
  })
})
