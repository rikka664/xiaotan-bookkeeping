// 主进程记账接口测试：把 electron 假扮掉，用临时目录里的真实 SQLite 测增删改查统计
// 注意：绝不读写用户真实账本 %APPDATA%\小谭记账\xiaotan.db
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const state = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  dbDir: '',
  saveDialog: vi.fn()
}))

// 假扮 electron：测试跑在纯 Node 里没有 electron，只提供本代码用到的部分
vi.mock('electron', () => ({
  app: {
    setName: () => {},
    getPath: () => state.dbDir,
    whenReady: () => ({ then: () => {} }),
    on: () => {},
    quit: () => {}
  },
  BrowserWindow: class {},
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => {
      state.handlers.set(name, fn)
    }
  },
  dialog: {
    showSaveDialog: (...args: unknown[]) => state.saveDialog(...args)
  },
  shell: { openExternal: () => {}, showItemInFolder: () => {} }
}))

import '../src/main/index'
import { getDb } from '../src/main/db'

// 拿到各接口（与界面通过传话窗口调用的是同一批函数）
const add = (p: unknown) => state.handlers.get('expense:add')!(null, p)
const list = (f?: unknown) => state.handlers.get('expense:list')!(null, f)
const update = (p: unknown) => state.handlers.get('expense:update')!(null, p)
const remove = (p: unknown) => state.handlers.get('expense:delete')!(null, p)
const stats = (p: unknown) => state.handlers.get('expense:stats')!(null, p)
const exportCsv = () => state.handlers.get('expense:export')!(null)

const okPayload = {
  amountCents: 1234,
  categoryL1: '餐饮饮食',
  categoryL2: '午餐',
  date: '2026-09-01',
  note: '公司楼下'
}

describe('记账核心接口', () => {
  beforeAll(() => {
    // 用系统临时目录当"假账本"，测完即删
    state.dbDir = mkdtempSync(join(tmpdir(), 'xiaotan-test-'))
  })

  afterAll(() => {
    // 先关掉数据库连接，Windows 上文件开着时删不掉
    try {
      getDb().close()
    } catch {
      // 忽略
    }
    try {
      rmSync(state.dbDir, { recursive: true, force: true })
    } catch {
      // 临时目录删不掉也没关系，系统会自动清理
    }
  })

  beforeEach(() => {
    // 每个用例从空账本开始，互不干扰
    getDb().prepare('DELETE FROM expenses').run()
    state.saveDialog.mockReset()
  })

  describe('记一笔（expense:add）', () => {
    it('正常记一笔，返回自增 id，账本里能查到', () => {
      const r = add({ ...okPayload }) as { id: number }
      expect(r.id).toBeGreaterThan(0)
      const rows = list({}) as Array<Record<string, unknown>>
      expect(rows).toHaveLength(1)
      expect(rows[0].amountCents).toBe(1234)
    })

    it('拒绝非法金额：0、负数、小数、非数字、超过 1 亿元', () => {
      for (const amountCents of [0, -1, 1.5, NaN, Infinity, '100', 1e10 + 1, undefined]) {
        expect(() => add({ ...okPayload, amountCents })).toThrow('数据不合法')
      }
    })

    it('金额上限 1 亿元整（1e10 分）可以记', () => {
      const r = add({ ...okPayload, amountCents: 1e10 }) as { id: number }
      expect(r.id).toBeGreaterThan(0)
    })

    it('拒绝不存在的分类', () => {
      expect(() => add({ ...okPayload, categoryL1: '不存在的大类' })).toThrow('数据不合法')
    })

    it('拒绝二级分类与一级分类不匹配', () => {
      // 「出租车」属于交通出行，不属于餐饮饮食
      expect(() => add({ ...okPayload, categoryL2: '出租车' })).toThrow('数据不合法')
    })

    it('拒绝非法日期格式', () => {
      for (const date of ['2026-9-1', '2026/09/01', '', 20260901, '2026-09']) {
        expect(() => add({ ...okPayload, date })).toThrow('数据不合法')
      }
    })

    it('备注超过 200 字自动截断，非字符串备注按空处理', () => {
      add({ ...okPayload, note: '啊'.repeat(250) })
      add({ ...okPayload, note: 123 })
      const rows = list({}) as Array<{ note: string }>
      const notes = rows.map((r) => r.note)
      expect(notes).toContain('啊'.repeat(200))
      expect(notes).toContain('')
    })
  })

  describe('账单列表（expense:list）', () => {
    it('默认返回全部，按日期从新到旧排列', () => {
      add({ ...okPayload, date: '2026-09-01', amountCents: 100 })
      add({ ...okPayload, date: '2026-08-01', amountCents: 200 })
      add({ ...okPayload, date: '2026-09-02', amountCents: 300 })
      const rows = list({}) as Array<{ date: string }>
      expect(rows.map((r) => r.date)).toEqual(['2026-09-02', '2026-09-01', '2026-08-01'])
    })

    it('同一天的多笔按记账先后倒序（后记的排前面）', () => {
      add({ ...okPayload, amountCents: 100 })
      add({ ...okPayload, amountCents: 200 })
      const rows = list({}) as Array<{ amountCents: number }>
      expect(rows.map((r) => r.amountCents)).toEqual([200, 100])
    })

    it('按月筛选', () => {
      add({ ...okPayload, date: '2026-09-05', amountCents: 100 })
      add({ ...okPayload, date: '2026-08-05', amountCents: 200 })
      const rows = list({ month: '2026-09' }) as Array<{ amountCents: number }>
      expect(rows.map((r) => r.amountCents)).toEqual([100])
    })

    it('按一级分类筛选', () => {
      add({ ...okPayload, categoryL1: '餐饮饮食', amountCents: 100 })
      add({ ...okPayload, categoryL1: '交通出行', categoryL2: '公交地铁', amountCents: 200 })
      const rows = list({ categoryL1: '交通出行' }) as Array<{ amountCents: number }>
      expect(rows.map((r) => r.amountCents)).toEqual([200])
    })

    it('月份 + 分类组合筛选', () => {
      add({ ...okPayload, date: '2026-09-05', categoryL1: '餐饮饮食', amountCents: 100 })
      add({ ...okPayload, date: '2026-08-05', categoryL1: '餐饮饮食', amountCents: 200 })
      add({ ...okPayload, date: '2026-09-05', categoryL1: '交通出行', categoryL2: '公交地铁', amountCents: 300 })
      const rows = list({ month: '2026-09', categoryL1: '餐饮饮食' }) as Array<{ amountCents: number }>
      expect(rows.map((r) => r.amountCents)).toEqual([100])
    })

    it('非法的月份格式不参与筛选（按全部返回）', () => {
      add({ ...okPayload, amountCents: 100 })
      add({ ...okPayload, date: '2026-08-01', amountCents: 200 })
      const rows = list({ month: '2026/09' }) as Array<{ amountCents: number }>
      expect(rows).toHaveLength(2)
    })
  })

  describe('修改账单（expense:update）', () => {
    it('修改后金额、分类、备注都更新', () => {
      const { id } = add({ ...okPayload }) as { id: number }
      update({ id, amountCents: 500, categoryL1: '交通出行', categoryL2: '公交地铁', date: '2026-09-03', note: '改过' })
      const rows = list({}) as Array<Record<string, unknown>>
      expect(rows).toHaveLength(1)
      expect(rows[0].amountCents).toBe(500)
      expect(rows[0].categoryL2).toBe('公交地铁')
      expect(rows[0].note).toBe('改过')
    })

    it('id 不是整数或数据非法时拒绝', () => {
      const { id } = add({ ...okPayload }) as { id: number }
      expect(() => update({ id: 1.5, ...okPayload })).toThrow('数据不合法')
      expect(() => update({ id, ...okPayload, amountCents: 0 })).toThrow('数据不合法')
      expect(() => update({ id, ...okPayload, categoryL1: '不存在' })).toThrow('数据不合法')
      expect(() => update({ id, ...okPayload, date: 'bad' })).toThrow('数据不合法')
    })
  })

  describe('删除账单（expense:delete）', () => {
    it('删除后列表里查不到', () => {
      const { id } = add({ ...okPayload }) as { id: number }
      remove({ id })
      expect(list({})).toHaveLength(0)
    })

    it('id 不是整数时拒绝', () => {
      expect(() => remove({ id: 1.5 })).toThrow('数据不合法')
      expect(() => remove({ id: '1' })).toThrow('数据不合法')
    })

    it('删除不存在的 id 不报错', () => {
      expect(() => remove({ id: 99999 })).not.toThrow()
    })
  })

  describe('统计（expense:stats）', () => {
    // 构造三个时间段的账单：本月、今年其他月份、去年
    function seed(): void {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const thisMonth = `${y}-${m}-05`
      const prev = new Date(y, now.getMonth() - 1, 10)
      const otherMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-10`
      add({ ...okPayload, date: thisMonth, categoryL1: '餐饮饮食', amountCents: 100 })
      add({ ...okPayload, date: otherMonth, categoryL1: '交通出行', categoryL2: '公交地铁', amountCents: 200 })
      add({ ...okPayload, date: `${y - 1}-12-01`, categoryL1: '购物消费', categoryL2: '服饰鞋帽', amountCents: 300 })
    }

    it('本月：只统计当月账单', () => {
      seed()
      const r = stats({ period: 'month' }) as { totalCents: number; count: number; byCategory: Array<Record<string, unknown>> }
      expect(r.totalCents).toBe(100)
      expect(r.count).toBe(1)
      expect(r.byCategory[0].category).toBe('餐饮饮食')
    })

    it('今年：统计全年账单', () => {
      seed()
      const r = stats({ period: 'year' }) as { totalCents: number; count: number; byCategory: Array<Record<string, unknown>> }
      expect(r.totalCents).toBe(300)
      expect(r.count).toBe(2)
      expect(r.byCategory[0].category).toBe('交通出行') // 200 分 > 100 分，排前面
    })

    it('全部：统计所有账单', () => {
      seed()
      const r = stats({ period: 'all' }) as { totalCents: number; count: number; byCategory: Array<Record<string, unknown>> }
      expect(r.totalCents).toBe(600)
      expect(r.count).toBe(3)
      expect(r.byCategory).toHaveLength(3)
      expect(r.byCategory[0].category).toBe('购物消费') // 300 分最多
    })

    it('空账本统计结果都是 0', () => {
      const r = stats({ period: 'all' }) as { totalCents: number; count: number; byCategory: unknown[] }
      expect(r.totalCents).toBe(0)
      expect(r.count).toBe(0)
      expect(r.byCategory).toEqual([])
    })

    it('无效的统计周期按「本月」处理', () => {
      seed()
      const r = stats({ period: 'week' }) as { totalCents: number }
      expect(r.totalCents).toBe(100)
    })
  })

  describe('导出 CSV（expense:export）', () => {
    it('空账本时不弹保存框，直接提示没有数据', async () => {
      const r = (await exportCsv()) as { saved: boolean; empty: boolean; count: number }
      expect(r.saved).toBe(false)
      expect(r.empty).toBe(true)
      expect(r.count).toBe(0)
      expect(state.saveDialog).not.toHaveBeenCalled()
    })

    it('用户取消保存框时不生成文件', async () => {
      add({ ...okPayload })
      state.saveDialog.mockResolvedValueOnce({ canceled: true })
      const r = (await exportCsv()) as { saved: boolean; empty: boolean; count: number }
      expect(r.saved).toBe(false)
      expect(r.empty).toBe(false)
      expect(r.count).toBe(0)
    })

    it('导出成功：文件内容有表头、BOM、金额换算，含逗号引号的备注正确转义', async () => {
      const exportPath = join(state.dbDir, '导出测试.csv')
      add({ ...okPayload, amountCents: 1234, note: '备注,含"引号"' })
      add({ ...okPayload, amountCents: 2000, note: '普通备注' })
      state.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: exportPath })

      const r = (await exportCsv()) as { saved: boolean; path: string; count: number }
      expect(r.saved).toBe(true)
      expect(r.path).toBe(exportPath)
      expect(r.count).toBe(2)

      const content = readFileSync(exportPath, 'utf8')
      // 开头有 BOM，Excel 打开中文才不乱码
      expect(content.startsWith('﻿')).toBe(true)
      const lines = content.replace(/^﻿/, '').split('\r\n')
      expect(lines[0]).toBe('日期,一级分类,二级分类,金额(元),备注')
      // 导出按日期倒序，同一天按记账先后倒序：后记的「普通备注」在前
      expect(lines[1]).toBe('2026-09-01,餐饮饮食,午餐,20.00,普通备注')
      // 金额从分换算成元，两位小数；含逗号引号的备注正确转义
      expect(lines[2]).toBe('2026-09-01,餐饮饮食,午餐,12.34,"备注,含""引号"""')
    })
  })
})
