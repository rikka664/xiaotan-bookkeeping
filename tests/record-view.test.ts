// 「记一笔」页面测试：金额输入清理、分类两级联动、保存流程
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import RecordView from '../src/renderer/src/views/RecordView.vue'

// 假扮提示气泡（ElMessage），方便断言"提示了什么"
const elMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>()
  return {
    ...actual,
    default: actual.default,
    ElMessage: { ...actual.ElMessage, success: elMocks.success, error: elMocks.error }
  }
})

// 假扮"传话窗口"（window.api），记录保存请求
const api = { addExpense: vi.fn() }

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const wrappers: VueWrapper[] = []

function mountView(): VueWrapper {
  const w = mount(RecordView, { global: { plugins: [ElementPlus] }, attachTo: document.body })
  wrappers.push(w)
  return w
}

beforeEach(() => {
  ;(window as unknown as { api: typeof api }).api = api
  api.addExpense.mockReset().mockResolvedValue({ id: 1 })
  elMocks.success.mockClear()
  elMocks.error.mockClear()
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  wrappers.length = 0
  document.body.innerHTML = ''
})

describe('记一笔页面', () => {
  it('金额输入框只允许数字和小数点，小数最多两位', async () => {
    const w = mountView()
    const input = w.find('.amount-input')

    await input.setValue('12.345')
    expect((input.element as HTMLInputElement).value).toBe('12.34')

    await input.setValue('abc12x.3')
    expect((input.element as HTMLInputElement).value).toBe('12.3')

    await input.setValue('abc')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('日期默认是今天', () => {
    const w = mountView()
    const dateInput = w.find('.el-date-editor input')
    expect((dateInput.element as HTMLInputElement).value).toBe(todayStr())
  })

  it('金额为空、为 0 或分类没选全时保存按钮不可点；选全后可点', async () => {
    const w = mountView()
    const btn = w.find('.save-btn')
    expect(btn.attributes('disabled')).toBeDefined()

    await w.find('.amount-input').setValue('0')
    expect(btn.attributes('disabled')).toBeDefined()

    await w.find('.amount-input').setValue('10')
    expect(btn.attributes('disabled')).toBeDefined() // 还没选分类

    await w.find('.l1-btn').trigger('click')
    expect(btn.attributes('disabled')).toBeDefined() // 还没选二级

    await w.find('.l2-btn').trigger('click')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('选一级分类后出现二级分类；切换一级后二级清空重选', async () => {
    const w = mountView()
    expect(w.find('.l2-btn').exists()).toBe(false) // 初始只有提示语

    await w.find('.l1-btn').trigger('click')
    await w.find('.l2-btn').trigger('click')
    expect(w.find('.l2-btn.active').text()).toBe('早餐')

    await w.findAll('.l1-btn')[1].trigger('click') // 切到「交通出行」
    expect(w.find('.l2-btn.active').exists()).toBe(false)
    expect(w.find('.l2-btn').text()).toBe('公交地铁')
  })

  it('点「记下来」：金额换算成分、备注去空格传给后台，成功后表单清空', async () => {
    const w = mountView()
    await w.find('.amount-input').setValue('12.34')
    await w.find('.l1-btn').trigger('click')
    await w.find('.l2-btn').trigger('click')
    await w.find('input[placeholder="可选，比如：请朋友吃饭"]').setValue('  午饭  ')
    await w.find('.save-btn').trigger('click')
    await flushPromises()

    expect(api.addExpense).toHaveBeenCalledWith({
      amountCents: 1234,
      categoryL1: '餐饮饮食',
      categoryL2: '早餐',
      date: todayStr(),
      note: '午饭'
    })
    expect(elMocks.success).toHaveBeenCalledWith('已记一笔 ✅')
    expect((w.find('.amount-input').element as HTMLInputElement).value).toBe('')
    expect(w.find('.l2-btn').exists()).toBe(false) // 一级分类已清空，二级收起
  })

  it('保存失败时提示错误，表单内容不清空', async () => {
    api.addExpense.mockRejectedValueOnce(new Error('模拟失败'))
    const w = mountView()
    await w.find('.amount-input').setValue('10')
    await w.find('.l1-btn').trigger('click')
    await w.find('.l2-btn').trigger('click')
    await w.find('.save-btn').trigger('click')
    await flushPromises()

    expect(elMocks.error).toHaveBeenCalledWith('保存失败，请重试')
    expect((w.find('.amount-input').element as HTMLInputElement).value).toBe('10')
  })
})
