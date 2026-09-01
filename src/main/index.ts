import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from './db'
import { CATEGORIES } from '../shared/categories'
import type { CategoryStat, ListFilter, NewExpense, StatsPeriod } from '../shared/types'

// 统一应用名：保证开发版和安装版使用同一个数据目录（账本不会因安装/升级而"丢失"）
app.setName('小谭记账')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    title: '小谭记账',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 窗口内容就绪后再显示，避免白屏闪烁
  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('closed', () => {
    mainWindow = null
  })

  // 界面里点到的外部链接一律用系统浏览器打开
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发时加载开发服务器（支持热更新），打包后加载本地文件
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
}

// ---------- 记账数据接口（界面通过"传话窗口"调用这些接口） ----------

// 校验一级/二级分类是否合法
function isValidCategory(l1: string, l2: string): boolean {
  const cat = CATEGORIES.find((c) => c.name === l1)
  return !!cat && cat.children.includes(l2)
}

// 校验金额：必须是整数（单位分），范围 1 分 ~ 1 亿元
function isValidAmount(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isInteger(cents) && cents > 0 && cents <= 1e10
}

// 校验日期格式 YYYY-MM-DD
function isValidDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// 新增一笔
ipcMain.handle('expense:add', (_event, payload: NewExpense) => {
  if (
    !payload ||
    !isValidAmount(payload.amountCents) ||
    !isValidCategory(payload.categoryL1, payload.categoryL2) ||
    !isValidDate(payload.date)
  ) {
    throw new Error('数据不合法')
  }
  const note = typeof payload.note === 'string' ? payload.note.slice(0, 200) : ''
  const info = getDb()
    .prepare(
      'INSERT INTO expenses (amount_cents, category_l1, category_l2, date, note) VALUES (?, ?, ?, ?, ?)'
    )
    .run(payload.amountCents, payload.categoryL1, payload.categoryL2, payload.date, note)
  return { id: Number(info.lastInsertRowid) }
})

// 查询账单（支持按月份、按一级分类筛选）
ipcMain.handle('expense:list', (_event, filter: ListFilter = {}) => {
  const conds: string[] = []
  const params: string[] = []
  if (typeof filter.month === 'string' && /^\d{4}-\d{2}$/.test(filter.month)) {
    conds.push('date LIKE ?')
    params.push(filter.month + '%')
  }
  if (typeof filter.categoryL1 === 'string' && filter.categoryL1) {
    conds.push('category_l1 = ?')
    params.push(filter.categoryL1)
  }
  const where = conds.length ? ' WHERE ' + conds.join(' AND ') : ''
  return getDb()
    .prepare(
      `SELECT id, amount_cents AS amountCents, category_l1 AS categoryL1, category_l2 AS categoryL2,
              date, note, created_at AS createdAt, updated_at AS updatedAt
       FROM expenses${where} ORDER BY date DESC, id DESC`
    )
    .all(...params)
})

// 修改一笔
ipcMain.handle('expense:update', (_event, payload: NewExpense & { id: number }) => {
  if (
    !payload ||
    !Number.isInteger(payload.id) ||
    !isValidAmount(payload.amountCents) ||
    !isValidCategory(payload.categoryL1, payload.categoryL2) ||
    !isValidDate(payload.date)
  ) {
    throw new Error('数据不合法')
  }
  const note = typeof payload.note === 'string' ? payload.note.slice(0, 200) : ''
  getDb()
    .prepare(
      `UPDATE expenses SET amount_cents = ?, category_l1 = ?, category_l2 = ?, date = ?, note = ?,
       updated_at = datetime('now', 'localtime') WHERE id = ?`
    )
    .run(payload.amountCents, payload.categoryL1, payload.categoryL2, payload.date, note, payload.id)
})

// 删除一笔
ipcMain.handle('expense:delete', (_event, payload: { id: number }) => {
  if (!payload || !Number.isInteger(payload.id)) {
    throw new Error('数据不合法')
  }
  getDb().prepare('DELETE FROM expenses WHERE id = ?').run(payload.id)
})

// 统计：本月 / 今年 / 全部 的总支出与分类汇总
ipcMain.handle('expense:stats', (_event, payload: { period: StatsPeriod }) => {
  const period: StatsPeriod = payload?.period === 'year' ? 'year' : payload?.period === 'all' ? 'all' : 'month'
  const now = new Date()
  let prefix = ''
  if (period === 'month') {
    prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  } else if (period === 'year') {
    prefix = `${now.getFullYear()}`
  }
  const where = prefix ? ' WHERE date LIKE ?' : ''
  const params = prefix ? [prefix + '%'] : []
  const total = getDb()
    .prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS count FROM expenses${where}`)
    .get(...params) as { total: number; count: number }
  const byCategory = getDb()
    .prepare(
      `SELECT category_l1 AS category, SUM(amount_cents) AS totalCents, COUNT(*) AS count
       FROM expenses${where} GROUP BY category_l1 ORDER BY totalCents DESC`
    )
    .all(...params) as unknown as CategoryStat[]
  return { totalCents: total.total, count: total.count, byCategory }
})

// 导出全部账单为 CSV 文件（Excel / WPS 双击即可打开，中文不乱码）
ipcMain.handle('expense:export', async () => {
  const rows = getDb()
    .prepare(
      'SELECT date, category_l1 AS categoryL1, category_l2 AS categoryL2, amount_cents AS amountCents, note FROM expenses ORDER BY date DESC, id DESC'
    )
    .all() as unknown as { date: string; categoryL1: string; categoryL2: string; amountCents: number; note: string }[]

  if (rows.length === 0) {
    return { saved: false, count: 0, empty: true }
  }

  const now = new Date()
  const defaultName = `小谭记账-账单-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.csv`
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, {
        title: '导出账单备份',
        defaultPath: defaultName,
        filters: [{ name: 'CSV 表格文件（Excel 可打开）', extensions: ['csv'] }]
      })
    : await dialog.showSaveDialog({
        title: '导出账单备份',
        defaultPath: defaultName,
        filters: [{ name: 'CSV 表格文件（Excel 可打开）', extensions: ['csv'] }]
      })
  if (result.canceled || !result.filePath) {
    return { saved: false, count: 0, empty: false }
  }

  // CSV 转义：字段里含逗号、引号或换行时用引号包起来
  const esc = (s: string): string => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [
    '日期,一级分类,二级分类,金额(元),备注',
    ...rows.map((r) =>
      [r.date, r.categoryL1, r.categoryL2, (r.amountCents / 100).toFixed(2), r.note].map(esc).join(',')
    )
  ]
  // 文件开头加 BOM，保证 Excel/WPS 打开中文不乱码
  writeFileSync(result.filePath, '﻿' + lines.join('\r\n'), 'utf8')
  return { saved: true, path: result.filePath, count: rows.length }
})

// 在系统文件管理器中显示某个文件
ipcMain.handle('app:showItemInFolder', (_event, path: string) => {
  if (typeof path === 'string' && path) {
    shell.showItemInFolder(path)
  }
})

app.whenReady().then(() => {
  createWindow()

  // macOS 上点击 Dock 图标且无窗口时，重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 所有窗口关闭后退出应用（macOS 除外，符合 mac 使用习惯）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
