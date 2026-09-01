<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CATEGORIES } from '../../../shared/categories'

const amountYuan = ref('')
const categoryL1 = ref('')
const categoryL2 = ref('')
const date = ref(today())
const note = ref('')
const saving = ref(false)

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 输入时只允许数字和一个小数点，小数最多两位
function onAmountInput(): void {
  const cleaned = amountYuan.value.replace(/[^\d.]/g, '')
  const m = cleaned.match(/^(\d+)(\.\d{0,2})?/)
  amountYuan.value = m ? m[0] : ''
}

const amountOk = computed(
  () => /^\d+(\.\d{1,2})?$/.test(amountYuan.value) && Number(amountYuan.value) > 0
)

const currentCategory = computed(() => CATEGORIES.find((c) => c.name === categoryL1.value))

function pickL1(name: string): void {
  categoryL1.value = name
  categoryL2.value = ''
}

const canSave = computed(() => amountOk.value && !!categoryL1.value && !!categoryL2.value)

async function save(): Promise<void> {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    const cents = Math.round(Number(amountYuan.value) * 100)
    await window.api.addExpense({
      amountCents: cents,
      categoryL1: categoryL1.value,
      categoryL2: categoryL2.value,
      date: date.value,
      note: note.value.trim()
    })
    ElMessage.success('已记一笔 ✅')
    amountYuan.value = ''
    categoryL1.value = ''
    categoryL2.value = ''
    note.value = ''
    date.value = today()
  } catch (err) {
    ElMessage.error('保存失败，请重试')
    console.error(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="record-page">
    <el-card class="record-card" shadow="never">
      <div class="amount-row">
        <span class="yuan">¥</span>
        <input
          v-model="amountYuan"
          class="amount-input"
          placeholder="0.00"
          inputmode="decimal"
          @input="onAmountInput"
        />
      </div>

      <div class="field-label">分类</div>
      <div class="l1-grid">
        <button
          v-for="c in CATEGORIES"
          :key="c.name"
          type="button"
          class="l1-btn"
          :class="{ active: categoryL1 === c.name }"
          @click="pickL1(c.name)"
        >
          {{ c.icon }} {{ c.name }}
        </button>
      </div>
      <div v-if="currentCategory" class="l2-grid">
        <button
          v-for="child in currentCategory.children"
          :key="child"
          type="button"
          class="l2-btn"
          :class="{ active: categoryL2 === child }"
          @click="categoryL2 = child"
        >
          {{ child }}
        </button>
      </div>
      <div v-else class="l2-hint">先选一个大类，再选小类</div>

      <div class="field-row">
        <span class="field-label">日期</span>
        <el-date-picker
          v-model="date"
          type="date"
          value-format="YYYY-MM-DD"
          :clearable="false"
          style="width: 170px"
        />
      </div>
      <div class="field-row">
        <span class="field-label">备注</span>
        <el-input v-model="note" placeholder="可选，比如：请朋友吃饭" maxlength="200" />
      </div>

      <el-button
        type="primary"
        size="large"
        class="save-btn"
        :disabled="!canSave"
        :loading="saving"
        @click="save"
      >
        记下来
      </el-button>
    </el-card>
  </div>
</template>

<style scoped>
.record-page {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}
.record-card {
  width: 560px;
  border-radius: 12px;
}
.amount-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  border-bottom: 2px solid #dcdfe6;
  padding-bottom: 8px;
  margin-bottom: 20px;
}
.amount-row:focus-within {
  border-bottom-color: #2f6fed;
}
.yuan {
  font-size: 26px;
  font-weight: 600;
  color: #2f6fed;
}
.amount-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 34px;
  font-weight: 600;
  color: #303133;
  background: transparent;
}
.amount-input::placeholder {
  color: #c0c4cc;
}
.field-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.field-row {
  margin-bottom: 16px;
}
.l1-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.l1-btn,
.l2-btn {
  border: 1px solid #e4e7ed;
  background: #fff;
  border-radius: 8px;
  padding: 8px 4px;
  cursor: pointer;
  font-size: 13px;
  color: #606266;
  transition: all 0.15s;
}
.l1-btn:hover,
.l2-btn:hover {
  border-color: #2f6fed;
  color: #2f6fed;
}
.l1-btn.active,
.l2-btn.active {
  border-color: #2f6fed;
  background: #ecf3ff;
  color: #2f6fed;
  font-weight: 600;
}
.l2-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.l2-btn {
  padding: 5px 14px;
}
.l2-hint {
  font-size: 13px;
  color: #c0c4cc;
  margin-bottom: 16px;
}
.save-btn {
  width: 100%;
  margin-top: 4px;
}
</style>
