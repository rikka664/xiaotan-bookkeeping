<script setup>
// 「修改账单」页面：从账单列表点"修改"跳进来，改完保存返回
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { CATEGORIES } from '../../common/categories.js'
import { getExpense, updateExpense } from '../../common/data.js'

// 表单数据（打开页面时用原账单填进去）
const form = ref({ id: 0, amountYuan: '', categoryL1: '', categoryL2: '', date: '', note: '' })

// 页面加载：uni-app 的 onLoad 能拿到跳转时带的参数（账单编号 id）
onLoad((query) => {
  const row = getExpense(Number(query.id))
  if (!row) {
    uni.showToast({ title: '账单不存在', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  form.value = {
    id: row.id,
    amountYuan: (row.amountCents / 100).toFixed(2), // 分换回元的显示文字
    categoryL1: row.categoryL1,
    categoryL2: row.categoryL2,
    date: row.date,
    note: row.note
  }
})

// 金额输入过滤：只允许数字和一个小数点，小数最多两位（和记一笔页同一条规则）
function onAmountInput(e) {
  const cleaned = e.detail.value.replace(/[^\d.]/g, '')
  const m = cleaned.match(/^(\d+)(\.\d{0,2})?/)
  form.value.amountYuan = m ? m[0] : ''
}

// 当前大类下的二级小类选项
const l2Options = computed(
  () => CATEGORIES.find((c) => c.name === form.value.categoryL1)?.children ?? []
)

// 分类选择器（一级）：第 0 项是占位提示，实际选项从第 1 项开始
const l1Names = CATEGORIES.map((c) => c.name)
const l1Index = computed(() => Math.max(l1Names.indexOf(form.value.categoryL1), 0))

// 换一级大类：记下新大类并把小类清掉（必须重选）
function onL1Change(e) {
  const i = Number(e.detail.value)
  form.value.categoryL1 = l1Names[i]
  form.value.categoryL2 = ''
}

// 二级小类选择器：同样是"第 0 项占位"的规则
const l2Index = computed(() => Math.max(l2Options.value.indexOf(form.value.categoryL2), 0))

function onL2Change(e) {
  const i = Number(e.detail.value)
  if (l2Options.value[i]) {
    form.value.categoryL2 = l2Options.value[i]
  }
}

// 日期选择器选好新日期
function onDateChange(e) {
  form.value.date = e.detail.value
}

// 保存按钮能不能点：金额合格 + 大类小类都选了（和记一笔页同一条规则）
const canSave = computed(
  () =>
    /^\d+(\.\d{1,2})?$/.test(form.value.amountYuan) &&
    Number(form.value.amountYuan) > 0 &&
    !!form.value.categoryL1 &&
    !!form.value.categoryL2
)

// 保存修改：成功后返回账单列表（列表会自动刷新）
function save() {
  if (!canSave.value) return
  try {
    updateExpense({
      id: form.value.id,
      amountCents: Math.round(Number(form.value.amountYuan) * 100),
      categoryL1: form.value.categoryL1,
      categoryL2: form.value.categoryL2,
      date: form.value.date,
      note: form.value.note.trim()
    })
    uni.showToast({ title: '已修改', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (err) {
    uni.showToast({ title: '修改失败，请重试', icon: 'none' })
    console.error(err)
  }
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="form-row">
        <text class="label">金额</text>
        <view class="amount-wrap">
          <text class="yuan">¥</text>
          <input
            class="amount-input"
            type="digit"
            :value="form.amountYuan"
            placeholder="0.00"
            placeholder-class="ph"
            @input="onAmountInput"
          />
        </view>
      </view>

      <view class="form-row">
        <text class="label">一级分类</text>
        <picker mode="selector" :range="l1Names" :value="l1Index" @change="onL1Change">
          <view class="picker-value">{{ form.categoryL1 || '请选择' }} ▾</view>
        </picker>
      </view>

      <view class="form-row">
        <text class="label">二级分类</text>
        <picker mode="selector" :range="l2Options" :value="l2Index" @change="onL2Change">
          <view class="picker-value" :class="{ dim: !form.categoryL2 }">
            {{ form.categoryL2 || (form.categoryL1 ? '请选择' : '先选一级') }} ▾
          </view>
        </picker>
      </view>

      <view class="form-row">
        <text class="label">日期</text>
        <picker mode="date" :value="form.date" @change="onDateChange">
          <view class="picker-value">{{ form.date }} 📅</view>
        </picker>
      </view>

      <view class="form-row">
        <text class="label">备注</text>
        <input
          v-model="form.note"
          class="note-input"
          placeholder="可选"
          placeholder-class="ph"
          :maxlength="200"
        />
      </view>

      <button class="save-btn" :disabled="!canSave" @click="save">保存修改</button>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 20rpx 24rpx 40rpx;
}
.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 16rpx 28rpx 30rpx;
}
.form-row {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1px solid #f0f2f5;
}
.label {
  width: 160rpx;
  flex: none;
  font-size: 28rpx;
  color: #606266;
}
.amount-wrap {
  flex: 1;
  display: flex;
  align-items: center;
}
.yuan {
  font-size: 32rpx;
  color: #2f6fed;
  font-weight: 600;
  margin-right: 10rpx;
}
.amount-input {
  flex: 1;
  font-size: 36rpx;
  font-weight: 600;
  color: #303133;
}
.picker-value {
  font-size: 28rpx;
  color: #303133;
}
.picker-value.dim {
  color: #c0c4cc;
}
.note-input {
  flex: 1;
  font-size: 28rpx;
  color: #303133;
}
.ph {
  color: #c0c4cc;
}
.save-btn {
  width: 100%;
  margin-top: 30rpx;
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
