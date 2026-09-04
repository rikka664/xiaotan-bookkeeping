<script setup>
// 「统计」页面：本月/今年/全部的总支出、分类占比、排行
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { CATEGORIES } from '../../common/categories.js'
import { getStats, fmtYuan } from '../../common/data.js'

const period = ref('month') // 当前统计周期：month 本月 / year 今年 / all 全部
const stats = ref({ totalCents: 0, count: 0, byCategory: [] }) // 统计结果

// 三个切换按钮的配置（名字 + 对应周期值）
const periodTabs = [
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' }
]

// 每次回到这个页面都重新统计（账单可能刚变过）
onShow(() => {
  load()
})

function load() {
  stats.value = getStats(period.value)
}

// 切换统计周期
function pickPeriod(key) {
  period.value = key
  load()
}

// 统计范围的文字说明（显示在大金额上面）
const periodLabel = computed(() => {
  const now = new Date()
  if (period.value === 'month') return `${now.getFullYear()}年${now.getMonth() + 1}月`
  if (period.value === 'year') return `${now.getFullYear()}年`
  return '全部时间'
})

// 最大的分类金额（排行条的宽度按它当 100% 来算）
const maxCents = computed(() => Math.max(...stats.value.byCategory.map((r) => r.totalCents), 1))

// 手机版没有宽裕空间画饼图，用"色点 + 横条排行"代替（一眼能看出谁花得多）
function iconOf(name) {
  return CATEGORIES.find((c) => c.name === name)?.icon ?? '📦'
}
</script>

<template>
  <view class="page">
    <!-- 周期切换 -->
    <view class="tabs">
      <view
        v-for="t in periodTabs"
        :key="t.key"
        class="tab"
        :class="{ active: period === t.key }"
        @click="pickPeriod(t.key)"
      >
        {{ t.label }}
      </view>
    </view>

    <!-- 有数据：总支出 + 分类排行 -->
    <template v-if="stats.count > 0">
      <view class="card hero">
        <view class="hero-label">{{ periodLabel }} · 总支出</view>
        <view class="hero-amount">¥{{ fmtYuan(stats.totalCents) }}</view>
        <view class="hero-sub">共 {{ stats.count }} 笔</view>
      </view>

      <view class="card">
        <view class="rank-title">分类排行</view>
        <view v-for="r in stats.byCategory" :key="r.category" class="rank-row">
          <text class="rank-name">{{ iconOf(r.category) }} {{ r.category }}</text>
          <view class="rank-bar-wrap">
            <view class="rank-bar" :style="{ width: Math.max((r.totalCents / maxCents) * 100, 2) + '%' }"></view>
          </view>
          <text class="rank-amount">¥{{ fmtYuan(r.totalCents) }}</text>
          <text class="rank-pct">{{ ((r.totalCents / stats.totalCents) * 100).toFixed(1) }}%</text>
        </view>
      </view>
    </template>

    <!-- 没数据：友好提示 -->
    <view v-else class="empty">
      <text class="empty-icon">📊</text>
      <text class="empty-text">{{ periodLabel }}还没有记账记录，去「记一笔」记下第一笔吧</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 20rpx 24rpx 40rpx;
}
.tabs {
  display: flex;
  background: #ffffff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
}
.tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  font-size: 28rpx;
  color: #606266;
  border-radius: 12rpx;
}
.tab.active {
  background: #2f6fed;
  color: #ffffff;
  font-weight: 600;
}
.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 30rpx 28rpx;
  margin-bottom: 20rpx;
}
.hero {
  text-align: center;
}
.hero-label {
  font-size: 26rpx;
  color: #909399;
}
.hero-amount {
  font-size: 72rpx;
  font-weight: 700;
  color: #303133;
  margin: 12rpx 0;
}
.hero-sub {
  font-size: 26rpx;
  color: #909399;
}
.rank-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20rpx;
}
.rank-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}
.rank-name {
  width: 200rpx;
  flex: none;
  font-size: 26rpx;
  color: #606266;
}
.rank-bar-wrap {
  flex: 1;
  height: 14rpx;
  background: #eef0f3;
  border-radius: 7rpx;
  overflow: hidden;
}
.rank-bar {
  height: 100%;
  background: #2f6fed;
  border-radius: 7rpx;
}
.rank-amount {
  width: 140rpx;
  flex: none;
  text-align: right;
  font-size: 26rpx;
  font-weight: 600;
  color: #303133;
}
.rank-pct {
  width: 100rpx;
  flex: none;
  text-align: right;
  font-size: 22rpx;
  color: #909399;
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
  padding: 0 60rpx;
  text-align: center;
  line-height: 1.6;
}
</style>
