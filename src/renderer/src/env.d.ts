/// <reference types="vite/client" />

import type { Expense, ExportResult, ListFilter, NewExpense, StatsPeriod, StatsResult } from '../../shared/types'

declare global {
  interface Window {
    api: {
      addExpense: (data: NewExpense) => Promise<{ id: number }>
      listExpenses: (filter: ListFilter) => Promise<Expense[]>
      updateExpense: (data: NewExpense & { id: number }) => Promise<void>
      deleteExpense: (id: number) => Promise<void>
      getStats: (period: StatsPeriod) => Promise<StatsResult>
      exportExpenses: () => Promise<ExportResult>
      showItemInFolder: (path: string) => Promise<void>
    }
  }
}

export {}
