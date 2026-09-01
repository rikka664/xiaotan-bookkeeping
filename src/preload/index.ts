import { contextBridge, ipcRenderer } from 'electron'
import type { Expense, ExportResult, ListFilter, NewExpense, StatsPeriod, StatsResult } from '../shared/types'

// 「传话窗口」：界面（网页）与本地数据库之间传话的唯一通道。
// 界面里能用的记账能力都在这里，除此之外碰不到任何系统功能。
const api = {
  addExpense: (data: NewExpense): Promise<{ id: number }> => ipcRenderer.invoke('expense:add', data),
  listExpenses: (filter: ListFilter): Promise<Expense[]> => ipcRenderer.invoke('expense:list', filter),
  updateExpense: (data: NewExpense & { id: number }): Promise<void> =>
    ipcRenderer.invoke('expense:update', data),
  deleteExpense: (id: number): Promise<void> => ipcRenderer.invoke('expense:delete', { id }),
  getStats: (period: StatsPeriod): Promise<StatsResult> => ipcRenderer.invoke('expense:stats', { period }),
  exportExpenses: (): Promise<ExportResult> => ipcRenderer.invoke('expense:export'),
  showItemInFolder: (path: string): Promise<void> => ipcRenderer.invoke('app:showItemInFolder', path)
}

contextBridge.exposeInMainWorld('api', api)
