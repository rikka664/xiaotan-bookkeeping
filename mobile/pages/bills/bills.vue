<script setup>
// 「账单」页面：按月份/分类筛选账单，点某笔可以修改或删除，还能导出备份
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { CATEGORIES } from '../../common/categories.js'
import { listExpenses, deleteExpense, exportCsv, fmtYuan } from '../../common/data.js'

const bills = ref([]) // 当前显示的账单列表
const month = ref('') // 选中的月份（YYYY-MM），空 = 全部月份
const categoryL1 = ref('') // 选中的一级分类，空 = 全部分类

// 分类选择器用的选项列表：第 0 项是"全部分类"，后面是 10 个大类
const categoryNames = ['全部分类', ...CATEGORIES.map((c) => c.name)]
const categoryIndex = ref(0) // 分类选择器当前选到第几项

// 每次回到这个页面都重新读账单（比如从修改页返回来，列表能立刻刷新）
onShow(() => {
  load()
})

// 按当前筛选条件读账单
function load() {
  bills.value = listExpenses({
    month: month.value || undefined,
    categoryL1: categoryL1.value || undefined
  })
}

// 月份选择器选好后：记下月份并刷新列表
function onMonthChange(e) {
  month.value = e.detail.value
  load()
}

// 点 ✕ 清除月份筛选，恢复显示全部
function clearMonth() {
  month.value = ''
  load()
}

// 分类选择器选好后：换算成分类名（第 0 项"全部分类"转换成空字符串）并刷新
function onCategoryChange(e) {
  categoryIndex.value = Number(e.detail.value)
  categoryL1.value = categoryIndex.value === 0 ? '' : categoryNames[categoryIndex.value]
  load()
}

// 合计：把每笔的"分"加起来再显示成"元"
const totalCents = computed(() => bills.value.reduce((s, b) => s + b.amountCents, 0))

// 找到分类的图标（找不到就用 📦 兜底）
function iconOf(l1) {
  return CATEGORIES.find((c) => c.name === l1)?.icon ?? '📦'
}

// 点某笔账单：弹出"修改 / 删除"选择菜单
function onRowTap(row) {
  uni.showActionSheet({
    itemList: ['修改', '删除'],
    success: (res) => {
      if (res.tapIndex === 0) {
        // 跳到修改页，把账单编号带过去
        uni.navigateTo({ url: '/pages/edit/edit?id=' + row.id })
      } else {
        remove(row)
      }
    }
  })
}

// 删除前弹窗确认，确认后才真的删（和电脑版一样防误删）
function remove(row) {
  uni.showModal({
    title: '删除账单',
    content: `确定删除这笔「${row.categoryL2} ¥${fmtYuan(row.amountCents)}」吗？删除后不可恢复。`,
    confirmText: '删除',
    confirmColor: '#e34948',
    success: (res) => {
      if (!res.confirm) return
      try {
        deleteExpense(row.id)
        uni.showToast({ title: '已删除', icon: 'success' })
        load()
      } catch (err) {
        uni.showToast({ title: '删除失败，请重试', icon: 'none' })
        console.error(err)
      }
    }
  })
}

// 导出备份：生成 CSV 表格文件
// 网页版：浏览器直接下载；手机版：存进手机的"下载"目录
function doExport() {
  try {
    const result = exportCsv()
    if (result.empty) {
      uni.showToast({ title: '还没有账单可以导出', icon: 'none' })
      return
    }
    // #ifdef H5
    // 网页版下载：造一个临时下载链接，模拟用户点了一下
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(a.href)
    // #endif
    // #ifdef APP-PLUS
    saveToDownloads(result)
    // #endif
  } catch (err) {
    uni.showToast({ title: '导出失败，请重试', icon: 'none' })
    console.error(err)
  }
}

// 手机版：把 CSV 文件写进手机的"下载"目录（plus 是 App 上才有的手机能力）
function saveToDownloads(result) {
  plus.io.resolveLocalFileSystemURL(
    '_downloads/',
    (dir) => {
      dir.getFile(
        result.filename,
        { create: true },
        (fileEntry) => {
          fileEntry.createWriter(
            (writer) => {
              writer.onwrite = () => {
                uni.showModal({
                  title: '导出成功',
                  content: `已导出 ${result.count} 笔账单到手机「下载」目录：${result.filename}`,
                  showCancel: false
                })
              }
              writer.onerror = (e) => {
                uni.showToast({ title: '写入文件失败', icon: 'none' })
                console.error(e)
              }
              writer.write(result.csv)
            },
            (e) => {
              uni.showToast({ title: '打开文件失败', icon: 'none' })
              console.error(e)
            }
          )
        },
        (e) => {
          uni.showToast({ title: '创建文件失败', icon: 'none' })
          console.error(e)
        }
      )
    },
    (e) => {
      uni.showToast({ title: '找不到下载目录', icon: 'none' })
      console.error(e)
    }
  )
}
</script>

<template>
  <view class="page">
    <!-- 筛选栏：月份 + 分类 + 导出按钮 -->
    <view class="filter-bar">
      <view class="filter-item">
        <picker mode="date" fields="month" :value="month" @change="onMonthChange">
          <view class="filter-text">📅 {{ month || '全部月份' }}</view>
        </picker>
        <text v-if="month" class="filter-clear" @click="clearMonth">✕</text>
      </view>
      <picker class="filter-item" mode="selector" :range="categoryNames" :value="categoryIndex" @change="onCategoryChange">
        <view class="filter-text">🏷️ {{ categoryIndex === 0 ? '全部分类' : categoryNames[categoryIndex] }}</view>
      </picker>
      <view class="export-btn" @click="doExport">📤 导出</view>
    </view>

    <!-- 合计 -->
    <view v-if="bills.length" class="summary">
      共 {{ bills.length }} 笔 · 合计 ¥{{ fmtYuan(totalCents) }}
    </view>

    <!-- 账单列表 -->
    <view v-if="bills.length" class="list">
      <view v-for="b in bills" :key="b.id" class="row" @click="onRowTap(b)">
        <view class="row-left">
          <view class="row-cat">{{ iconOf(b.categoryL1) }} {{ b.categoryL1 }} / {{ b.categoryL2 }}</view>
          <view class="row-sub">
            {{ b.date }}<text v-if="b.note" class="row-note"> · {{ b.note }}</text>
          </view>
        </view>
        <view class="row-amount">-¥{{ fmtYuan(b.amountCents) }}</view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty">
      <text class="empty-icon">🗒️</text>
      <text class="empty-text">没有符合条件的账单</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 20rpx 24rpx 40rpx;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.filter-item {
  position: relative;
  flex: none;
}
.filter-text {
  font-size: 26rpx;
  color: #303133;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
}
.filter-clear {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 36rpx;
  height: 36rpx;
  line-height: 32rpx;
  text-align: center;
  background: #909399;
  color: #ffffff;
  border-radius: 50%;
  font-size: 22rpx;
}
.export-btn {
  margin-left: auto;
  font-size: 26rpx;
  color: #2f6fed;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
}
.summary {
  font-size: 24rpx;
  color: #606266;
  margin-bottom: 16rpx;
}
.list {
  background: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx;
  border-bottom: 1px solid #f0f2f5;
}
.row:last-child {
  border-bottom: none;
}
.row-left {
  flex: 1;
  min-width: 0;
}
.row-cat {
  font-size: 28rpx;
  color: #303133;
  font-weight: 600;
}
.row-sub {
  font-size: 24rpx;
  color: #909399;
  margin-top: 8rpx;
}
.row-note {
  color: #909399;
}
.row-amount {
  flex: none;
  margin-left: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #303133;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}
.empty-text {
  font-size: 26rpx;
  color: #c0c4cc;
}
</style>
