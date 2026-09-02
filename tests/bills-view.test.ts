// 「账单列表」页面测试：加载展示、修改、删除确认、导出提示
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import BillsView from '../src/renderer/src/views/BillsView.vue'

// 假扮提示气泡与确认弹窗
const elMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  confirm: vi.fn()
}))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    default: actual.default,
    ElMessage: { ...actual.ElMessage, success: elMocks.success, error: elMocks.error, info: elMocks.info },
    ElMessageBox: { ...actual.ElMessageBox, confirm: elMocks.confirm }
  }
})

// 假扮"传话窗口"（window.api）
const api = {
  listExpenses: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  exportExpenses: vi.fn(),
  showItemInFolder: vi.fn()
}

const rows = [
  { id: 1, amountCents: 1230, categoryL1: '餐饮饮食', categoryL2: '午餐', date: '2026-09-01', note: '午饭' },
  { id: 2, amountCents: 800, categoryL1: '交通出行', categoryL2: '公交地铁', date: '2026-09-02', note: '' }
]

const wrappers: VueWrapper[] = []

function mountView(): VueWrapper {
  const w = mount(BillsView, { global: { plugins: [ElementPlus] }, attachTo: document.body })
  wrappers.push(w)
  return w
}

beforeEach(() => {
  ;(window as unknown as { api: typeof api }).api = api
  api.listExpenses.mockReset().mockResolvedValue(rows)
  api.updateExpense.mockReset().mockResolvedValue(undefined)
  api.deleteExpense.mockReset().mockResolvedValue(undefined)
  api.exportExpenses.mockReset()
  elMocks.confirm.mockReset().mockResolvedValue('confirm')
  elMocks.success.mockClear()
  elMocks.error.mockClear()
  elMocks.info.mockClear()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('账单列表页面', () => {
  it('打开页面自动加载账单，展示每笔内容和合计', async () => {
    mountView()
    await flushPromises()

    expect(api.listExpenses).toHaveBeenCalledWith({ month: undefined, categoryL1: undefined })
    const text = wrapperText()
    expect(text).toContain('餐饮饮食 / 午餐')
    expect(text).toContain('-¥12.30')
    expect(text).toContain('共 2 笔')
    expect(text).toContain('¥20.30')
    expect(text).toContain('—') // 空备注显示占位符
  })

  it('点「修改」打开编辑框并带出原值，保存后调用更新接口并刷新列表', async () => {
    const w = mountView()
    await flushPromises()

    const editBtns = w.findAll('button').filter((b) => b.text() === '修改')
    await editBtns[0].trigger('click')
    await flushPromises()

    const amountInput = document.querySelector('.el-dialog input[placeholder="0.00"]') as HTMLInputElement
    expect(amountInput.value).toBe('12.30')

    amountInput.value = '20.00'
    amountInput.dispatchEvent(new Event('input'))
    await flushPromises()

    const dialog = document.querySelector('.el-dialog')!
    const saveBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === '保存')!
    ;(saveBtn as HTMLButtonElement).click()
    await flushPromises()

    expect(api.updateExpense).toHaveBeenCalledWith({
      id: 1,
      amountCents: 2000,
      categoryL1: '餐饮饮食',
      categoryL2: '午餐',
      date: '2026-09-01',
      note: '午饭'
    })
    expect(api.listExpenses).toHaveBeenCalledTimes(2) // 保存成功后重新加载
  })

  it('点「删除」先弹确认，确认后调用删除接口并刷新列表', async () => {
    const w = mountView()
    await flushPromises()

    const delBtns = w.findAll('button').filter((b) => b.text() === '删除')
    await delBtns[0].trigger('click')
    await flushPromises()

    expect(elMocks.confirm).toHaveBeenCalled()
    expect(api.deleteExpense).toHaveBeenCalledWith(1)
    expect(api.listExpenses).toHaveBeenCalledTimes(2)
    expect(elMocks.success).toHaveBeenCalledWith('已删除')
  })

  it('删除时点「取消」则什么都不做', async () => {
    elMocks.confirm.mockRejectedValueOnce('cancel')
    const w = mountView()
    await flushPromises()

    const delBtns = w.findAll('button').filter((b) => b.text() === '删除')
    await delBtns[0].trigger('click')
    await flushPromises()

    expect(api.deleteExpense).not.toHaveBeenCalled()
  })

  it('没有数据可导出时提示先去记一笔', async () => {
    api.exportExpenses.mockResolvedValueOnce({ saved: false, count: 0, empty: true })
    const w = mountView()
    await flushPromises()

    const exportBtn = w.findAll('button').find((b) => b.text().includes('导出备份'))!
    await exportBtn.trigger('click')
    await flushPromises()

    expect(api.exportExpenses).toHaveBeenCalled()
    expect(elMocks.info).toHaveBeenCalledWith('还没有账单可以导出，先去记一笔吧')
  })
})

function wrapperText(): string {
  return wrappers[wrappers.length - 1].text()
}
