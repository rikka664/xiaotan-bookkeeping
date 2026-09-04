// 手机版账本数据层：账本保存在手机本地（uni 本地存储），不联网、不上传
//
// 大白话说明：
// - uni.getStorageSync / uni.setStorageSync 是 uni-app 自带的"手机本地小仓库"，
//   数据存在 App 自己的空间里，只有卸载 App 才会清掉
// - 金额统一用整数"分"来存（比如 12.34 元存成 1234），避免小数计算的误差
// - 这里的校验规则和电脑版完全一致，保证两端行为一模一样

import { CATEGORIES } from './categories.js'

// 账单列表在本地存储里用的"钥匙名"（取数据、存数据都靠它找到位置）
const STORAGE_KEY = 'xiaotan_expenses'
// 下一条账单编号的钥匙名（保证每条账单的编号不重复、只增不减）
const NEXT_ID_KEY = 'xiaotan_expense_next_id'

// 取今天的日期文字，格式 YYYY-MM-DD（比如 2026-09-04）
export function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 把"分"换算成"元"的显示文字：1234 -> "12.34"
export function fmtYuan(cents) {
  return (cents / 100).toFixed(2)
}

// 校验一级/二级分类是否真的存在（防止存进去一个不存在的分类）
function isValidCategory(l1, l2) {
  const cat = CATEGORIES.find((c) => c.name === l1)
  return !!cat && cat.children.includes(l2)
}

// 校验金额：必须是整数（单位分），范围 1 分 ~ 1 亿元（和电脑版同一条规则）
function isValidAmount(cents) {
  return typeof cents === 'number' && Number.isInteger(cents) && cents > 0 && cents <= 1e10
}

// 校验日期格式必须是 YYYY-MM-DD
function isValidDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// 从本地存储读出全部账单（第一次使用还没有数据时，返回空数组）
function loadAll() {
  const list = uni.getStorageSync(STORAGE_KEY)
  return Array.isArray(list) ? list : []
}

// 把全部账单写回本地存储
function saveAll(list) {
  uni.setStorageSync(STORAGE_KEY, list)
}

// 取下一个可用的新账单编号（用完自动 +1 存回去）
function nextId() {
  const id = Number(uni.getStorageSync(NEXT_ID_KEY)) || 1
  uni.setStorageSync(NEXT_ID_KEY, id + 1)
  return id
}

// 新增一笔账单。数据不合法时抛错（页面会接住错误并提示用户）
export function addExpense(payload) {
  if (
    !payload ||
    !isValidAmount(payload.amountCents) ||
    !isValidCategory(payload.categoryL1, payload.categoryL2) ||
    !isValidDate(payload.date)
  ) {
    throw new Error('数据不合法')
  }
  const list = loadAll()
  const now = new Date()
  list.push({
    id: nextId(),
    amountCents: payload.amountCents,
    categoryL1: payload.categoryL1,
    categoryL2: payload.categoryL2,
    date: payload.date,
    note: typeof payload.note === 'string' ? payload.note.slice(0, 200) : '',
    createdAt: now.toLocaleString(),
    updatedAt: now.toLocaleString()
  })
  saveAll(list)
  return true
}

// 查询账单列表。filter 可带 month（YYYY-MM）和 categoryL1（一级分类），都省略表示全部
// 排序规则和电脑版一致：按日期从新到旧，同一天按记账先后从新到旧
export function listExpenses(filter = {}) {
  let list = loadAll()
  if (typeof filter.month === 'string' && /^\d{4}-\d{2}$/.test(filter.month)) {
    list = list.filter((b) => b.date.startsWith(filter.month))
  }
  if (typeof filter.categoryL1 === 'string' && filter.categoryL1) {
    list = list.filter((b) => b.categoryL1 === filter.categoryL1)
  }
  return list.sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
}

// 按编号找一笔账单（找不到返回 null）
export function getExpense(id) {
  return loadAll().find((b) => b.id === id) || null
}

// 修改一笔账单（按编号覆盖内容）。数据不合法或找不到这笔账单时抛错
export function updateExpense(payload) {
  if (
    !payload ||
    !Number.isInteger(payload.id) ||
    !isValidAmount(payload.amountCents) ||
    !isValidCategory(payload.categoryL1, payload.categoryL2) ||
    !isValidDate(payload.date)
  ) {
    throw new Error('数据不合法')
  }
  const list = loadAll()
  const i = list.findIndex((b) => b.id === payload.id)
  if (i === -1) {
    throw new Error('账单不存在')
  }
  list[i] = {
    ...list[i],
    amountCents: payload.amountCents,
    categoryL1: payload.categoryL1,
    categoryL2: payload.categoryL2,
    date: payload.date,
    note: typeof payload.note === 'string' ? payload.note.slice(0, 200) : '',
    updatedAt: new Date().toLocaleString()
  }
  saveAll(list)
  return true
}

// 删除一笔账单（按编号删；编号不存在就当无事发生，和电脑版行为一致）
export function deleteExpense(id) {
  if (!Number.isInteger(id)) {
    throw new Error('数据不合法')
  }
  saveAll(loadAll().filter((b) => b.id !== id))
  return true
}

// 统计：period = 'month'（本月）/ 'year'（今年）/ 'all'（全部；其他值一律按本月处理，和电脑版一致）
// 返回 { totalCents 总支出（分）, count 笔数, byCategory: [{category, totalCents, count}] 按金额从多到少 }
export function getStats(period) {
  const p = period === 'year' ? 'year' : period === 'all' ? 'all' : 'month'
  const now = new Date()
  let prefix = ''
  if (p === 'month') {
    prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  } else if (p === 'year') {
    prefix = `${now.getFullYear()}`
  }
  // prefix 为空表示"全部"：不过滤日期
  const list = prefix ? loadAll().filter((b) => b.date.startsWith(prefix)) : loadAll()
  const byCategoryMap = {}
  let totalCents = 0
  for (const b of list) {
    totalCents += b.amountCents
    // 按一级分类累加：第一次遇到这个分类就先建一个空行
    const row = byCategoryMap[b.categoryL1] || (byCategoryMap[b.categoryL1] = { category: b.categoryL1, totalCents: 0, count: 0 })
    row.totalCents += b.amountCents
    row.count += 1
  }
  const byCategory = Object.values(byCategoryMap).sort((a, b) => b.totalCents - a.totalCents)
  return { totalCents, count: list.length, byCategory }
}

// 导出全部账单为 CSV 表格文字（和电脑版同一套格式，Excel/WPS 打开中文不乱码）
// 返回 { empty 是否没数据, count 笔数, csv 文件内容（开头带 BOM 记号）, filename 建议文件名 }
export function exportCsv() {
  const rows = listExpenses()
  if (rows.length === 0) {
    return { empty: true, count: 0, csv: '', filename: '' }
  }
  // 字段里如果有逗号、引号或换行，要用引号包起来，才不会把表格列弄乱
  const esc = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [
    '日期,一级分类,二级分类,金额(元),备注',
    ...rows.map((r) => [r.date, r.categoryL1, r.categoryL2, fmtYuan(r.amountCents), r.note].map(esc).join(','))
  ]
  const now = new Date()
  const filename = `小谭记账-账单-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`
  // 内容开头加 BOM 记号（﻿），Excel/WPS 打开中文才不会乱码
  return { empty: false, count: rows.length, csv: '﻿' + lines.join('\r\n'), filename }
}
