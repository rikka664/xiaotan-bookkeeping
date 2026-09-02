// 分类体系完整性测试：保证记账软件的分类数据不出乱子
import { describe, it, expect } from 'vitest'
import { CATEGORIES } from '../src/shared/categories'

describe('支出分类体系', () => {
  it('有 10 个一级大类（与产品文档一致）', () => {
    expect(CATEGORIES).toHaveLength(10)
  })

  it('每个一级大类都有名称和图标', () => {
    for (const c of CATEGORIES) {
      expect(c.name).toBeTruthy()
      expect(c.icon).toBeTruthy()
    }
  })

  it('一级大类之间没有重名', () => {
    const names = CATEGORIES.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('每个一级大类下都有二级小类，且内部没有重名', () => {
    for (const c of CATEGORIES) {
      expect(c.children.length).toBeGreaterThan(0)
      expect(new Set(c.children).size).toBe(c.children.length)
    }
  })
})
