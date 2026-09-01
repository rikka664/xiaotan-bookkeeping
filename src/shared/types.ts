// 界面与本地数据库之间传递的数据格式定义（两端共用，保证一致）

export interface NewExpense {
  /** 金额，单位：分（用整数存储，避免小数计算误差） */
  amountCents: number
  categoryL1: string
  categoryL2: string
  /** 日期，格式 YYYY-MM-DD */
  date: string
  note: string
}

export interface Expense extends NewExpense {
  id: number
  createdAt: string
  updatedAt: string
}

export interface ListFilter {
  /** 月份，格式 YYYY-MM，省略表示全部 */
  month?: string
  /** 一级分类筛选，省略表示全部 */
  categoryL1?: string
}

export type StatsPeriod = 'month' | 'year' | 'all'

export interface CategoryStat {
  category: string
  totalCents: number
  count: number
}

export interface StatsResult {
  totalCents: number
  count: number
  byCategory: CategoryStat[]
}

export interface ExportResult {
  /** 是否成功保存了文件 */
  saved: boolean
  /** 保存的文件完整路径（保存成功时才有） */
  path?: string
  /** 导出的笔数 */
  count: number
  /** 是否是"没有数据可导出"（区别于用户取消保存） */
  empty: boolean
}
