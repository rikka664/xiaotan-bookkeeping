<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CATEGORIES } from '../../../shared/categories'
import type { Expense } from '../../../shared/types'

const bills = ref<Expense[]>([])
const month = ref('') // YYYY-MM，空表示全部
const categoryL1 = ref('') // 空表示全部
const loading = ref(false)

const totalCents = computed(() => bills.value.reduce((s, b) => s + b.amountCents, 0))

function fmt(cents: number): string {
  return (cents / 100).toFixed(2)
}

function iconOf(l1: string): string {
  return CATEGORIES.find((c) => c.name === l1)?.icon ?? '📦'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    bills.value = await window.api.listExpenses({
      month: month.value || undefined,
      categoryL1: categoryL1.value || undefined
    })
  } catch (err) {
    ElMessage.error('读取账单失败，请重试')
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---------- 修改账单 ----------
const editDialog = ref(false)
const editForm = ref({ id: 0, amountYuan: '', categoryL1: '', categoryL2: '', date: '', note: '' })
const editSaving = ref(false)

const editL2Options = computed(
  () => CATEGORIES.find((c) => c.name === editForm.value.categoryL1)?.children ?? []
)

const editOk = computed(
  () =>
    /^\d+(\.\d{1,2})?$/.test(editForm.value.amountYuan) &&
    Number(editForm.value.amountYuan) > 0 &&
    !!editForm.value.categoryL1 &&
    !!editForm.value.categoryL2
)

function openEdit(row: Expense): void {
  editForm.value = {
    id: row.id,
    amountYuan: (row.amountCents / 100).toFixed(2),
    categoryL1: row.categoryL1,
    categoryL2: row.categoryL2,
    date: row.date,
    note: row.note
  }
  editDialog.value = true
}

function onEditL1Change(): void {
  editForm.value.categoryL2 = ''
}

async function saveEdit(): Promise<void> {
  if (!editOk.value || editSaving.value) return
  editSaving.value = true
  try {
    const f = editForm.value
    await window.api.updateExpense({
      id: f.id,
      amountCents: Math.round(Number(f.amountYuan) * 100),
      categoryL1: f.categoryL1,
      categoryL2: f.categoryL2,
      date: f.date,
      note: f.note.trim()
    })
    ElMessage.success('已修改 ✅')
    editDialog.value = false
    await load()
  } catch (err) {
    ElMessage.error('修改失败，请重试')
    console.error(err)
  } finally {
    editSaving.value = false
  }
}

// ---------- 导出备份 ----------
const exporting = ref(false)

async function exportCsv(): Promise<void> {
  if (exporting.value) return
  exporting.value = true
  try {
    const result = await window.api.exportExpenses()
    if (result.empty) {
      ElMessage.info('还没有账单可以导出，先去记一笔吧')
      return
    }
    if (result.saved && result.path) {
      try {
        await ElMessageBox.confirm(
          `已导出 ${result.count} 笔账单到：\n${result.path}`,
          '导出成功',
          {
            type: 'success',
            confirmButtonText: '打开所在文件夹',
            cancelButtonText: '关闭',
            showCancelButton: true
          }
        )
        await window.api.showItemInFolder(result.path)
      } catch {
        // 用户点了「关闭」
      }
    }
  } catch (err) {
    ElMessage.error('导出失败，请重试')
    console.error(err)
  } finally {
    exporting.value = false
  }
}

// ---------- 删除账单 ----------
async function remove(row: Expense): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除这笔「${row.categoryL2} ¥${fmt(row.amountCents)}」吗？删除后不可恢复。`,
      '删除账单',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return // 用户点了取消
  }
  try {
    await window.api.deleteExpense(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (err) {
    ElMessage.error('删除失败，请重试')
    console.error(err)
  }
}
</script>

<template>
  <div class="bills-page">
    <div class="filter-bar">
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        placeholder="全部月份"
        :clearable="true"
        style="width: 140px"
        @change="load"
      />
      <el-select
        v-model="categoryL1"
        placeholder="全部分类"
        clearable
        style="width: 150px"
        @change="load"
      >
        <el-option v-for="c in CATEGORIES" :key="c.name" :label="`${c.icon} ${c.name}`" :value="c.name" />
      </el-select>
      <span class="summary" v-if="bills.length">
        共 {{ bills.length }} 笔 · 合计 <b>¥{{ fmt(totalCents) }}</b>
      </span>
      <el-button class="export-btn" :loading="exporting" @click="exportCsv">📤 导出备份</el-button>
    </div>

    <el-table v-loading="loading" :data="bills" style="width: 100%" :empty-text="'没有符合条件的账单'">
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column label="分类" width="200">
        <template #default="{ row }">
          {{ iconOf(row.categoryL1) }} {{ row.categoryL1 }} / {{ row.categoryL2 }}
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.note">{{ row.note }}</span>
          <span v-else class="dim">—</span>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="120" align="right">
        <template #default="{ row }">
          <span class="money">-¥{{ fmt(row.amountCents) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">修改</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="editDialog" title="修改账单" width="420px">
      <el-form label-width="70px">
        <el-form-item label="金额">
          <el-input v-model="editForm.amountYuan" placeholder="0.00" style="width: 100%">
            <template #prefix>¥</template>
          </el-input>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.categoryL1" placeholder="一级分类" style="width: 47%" @change="onEditL1Change">
            <el-option v-for="c in CATEGORIES" :key="c.name" :label="`${c.icon} ${c.name}`" :value="c.name" />
          </el-select>
          <el-select v-model="editForm.categoryL2" placeholder="二级分类" style="width: 47%; margin-left: 6%" :disabled="!editForm.categoryL1">
            <el-option v-for="child in editL2Options" :key="child" :label="child" :value="child" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker v-model="editForm.date" type="date" value-format="YYYY-MM-DD" :clearable="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="editForm.note" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!editOk" :loading="editSaving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bills-page {
  padding: 4px 0;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.summary {
  margin-left: auto;
  font-size: 13px;
  color: #606266;
}
.export-btn {
  flex: none;
}
.money {
  font-weight: 600;
}
.dim {
  color: #c0c4cc;
}
</style>
