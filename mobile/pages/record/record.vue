<script setup>
// 「记一笔」页面：输入金额 → 选两级分类 → 选日期 → 存进手机本地账本
import { computed, ref } from 'vue'
import { CATEGORIES } from '../../common/categories.js'
import { addExpense, today } from '../../common/data.js'

const amountYuan = ref('') // 金额输入框里的文字（单位是元，存的时候换算成分）
const categoryL1 = ref('') // 选中的一级大类名字
const categoryL2 = ref('') // 选中的二级小类名字
const date = ref(today()) // 记账日期，默认今天，可以通过日期选择器改
const note = ref('') // 备注（可以不填）

// 金额输入过滤：只允许数字和一个小数点，小数最多两位（和电脑版同一条规则）
function onAmountInput(e) {
  const cleaned = e.detail.value.replace(/[^\d.]/g, '')
  const m = cleaned.match(/^(\d+)(\.\d{0,2})?/)
  amountYuan.value = m ? m[0] : ''
}

// 金额是否合格：格式对（最多两位小数）且大于 0
const amountOk = computed(
  () => /^\d+(\.\d{1,2})?$/.test(amountYuan.value) && Number(amountYuan.value) > 0
)

// 当前选中大类下的二级小类列表（没选大类时是 undefined，界面会显示提示语）
const currentCategory = computed(() => CATEGORIES.find((c) => c.name === categoryL1.value))

// 点某个大类：记下大类名字，并把之前选的小类清掉（大类换了小类必须重选）
function pickL1(name) {
  categoryL1.value = name
  categoryL2.value = ''
}

// 保存按钮能不能点：金额合格 + 大类小类都选了
const canSave = computed(() => amountOk.value && !!categoryL1.value && !!categoryL2.value)

// 记一笔：把表单数据换算、校验后存进手机本地账本
function save() {
  if (!canSave.value) return
  try {
    addExpense({
      amountCents: Math.round(Number(amountYuan.value) * 100), // 元换算成分（四舍五入）
      categoryL1: categoryL1.value,
      categoryL2: categoryL2.value,
      date: date.value,
      note: note.value.trim()
    })
    uni.showToast({ title: '已记一笔', icon: 'success' })
    // 存完把表单清空，方便连续记下一笔
    amountYuan.value = ''
    categoryL1.value = ''
    categoryL2.value = ''
    note.value = ''
    date.value = today()
  } catch (err) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error(err)
  }
}
</script>

<template>
  <view class="page">
    <view class="card">
      <!-- 金额输入：type="digit" 会弹出带小数点的数字键盘 -->
      <view class="amount-row">
        <text class="yuan">¥</text>
        <input
          class="amount-input"
          type="digit"
          :value="amountYuan"
          placeholder="0.00"
          placeholder-class="amount-placeholder"
          @input="onAmountInput"
        />
      </view>

      <view class="field-label">分类</view>
      <view class="l1-grid">
        <view
          v-for="c in CATEGORIES"
          :key="c.name"
          class="l1-btn"
          :class="{ active: categoryL1 === c.name }"
          @click="pickL1(c.name)"
        >
          {{ c.icon }} {{ c.name }}
        </view>
      </view>
      <view v-if="currentCategory" class="l2-grid">
        <view
          v-for="child in currentCategory.children"
          :key="child"
          class="l2-btn"
          :class="{ active: categoryL2 === child }"
          @click="categoryL2 = child"
        >
          {{ child }}
        </view>
      </view>
      <view v-else class="l2-hint">先选一个大类，再选小类</view>

      <view class="field-row">
        <text class="field-label-inline">日期</text>
        <picker mode="date" :value="date" @change="(e) => (date = e.detail.value)">
          <view class="picker-value">{{ date }} 📅</view>
        </picker>
      </view>
      <view class="field-row">
        <text class="field-label-inline">备注</text>
        <input
          v-model="note"
          class="note-input"
          placeholder="可选，比如：请朋友吃饭"
          placeholder-class="note-placeholder"
          :maxlength="200"
        />
      </view>

      <button class="save-btn" :disabled="!canSave" @click="save">记下来</button>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 20rpx 24rpx 40rpx;
}
.card {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 30rpx 28rpx;
}
.amount-row {
  display: flex;
  align-items: baseline;
  border-bottom: 2px solid #dcdfe6;
  padding-bottom: 12rpx;
  margin-bottom: 30rpx;
}
.yuan {
  font-size: 44rpx;
  font-weight: 600;
  color: #2f6fed;
  margin-right: 12rpx;
}
.amount-input {
  flex: 1;
  font-size: 64rpx;
  font-weight: 600;
  color: #303133;
  height: 90rpx;
}
.amount-placeholder {
  color: #c0c4cc;
}
.field-label {
  font-size: 26rpx;
  color: #909399;
  margin-bottom: 16rpx;
}
.field-label-inline {
  font-size: 26rpx;
  color: #909399;
  width: 90rpx;
  flex: none;
}
.l1-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 20rpx;
}
.l1-btn {
  width: 31%;
  box-sizing: border-box;
  text-align: center;
  padding: 16rpx 4rpx;
  border: 1px solid #e4e7ed;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #606266;
  background: #ffffff;
}
.l2-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-bottom: 24rpx;
}
.l2-btn {
  padding: 10rpx 24rpx;
  border: 1px solid #e4e7ed;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: #606266;
  background: #ffffff;
}
.l1-btn.active,
.l2-btn.active {
  border-color: #2f6fed;
  background: #ecf3ff;
  color: #2f6fed;
  font-weight: 600;
}
.l2-hint {
  font-size: 24rpx;
  color: #c0c4cc;
  margin-bottom: 24rpx;
}
.field-row {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}
.picker-value {
  font-size: 28rpx;
  color: #303133;
  background: #f5f6f8;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
}
.note-input {
  flex: 1;
  font-size: 28rpx;
  background: #f5f6f8;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
}
.note-placeholder {
  color: #c0c4cc;
}
.save-btn {
  width: 100%;
  margin-top: 10rpx;
  background: #2f6fed;
  color: #ffffff;
  font-size: 32rpx;
  border-radius: 16rpx;
}
.save-btn[disabled] {
  background: #a9c4f5;
  color: #ffffff;
}
</style>
