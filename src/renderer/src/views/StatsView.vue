<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { CATEGORIES } from '../../../shared/categories'
import type { StatsPeriod, StatsResult } from '../../../shared/types'

const period = ref<StatsPeriod>('month')
const stats = ref<StatsResult>({ totalCents: 0, count: 0, byCategory: [] })
const loading = ref(false)

const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

// 分类固定配色（图表规范：颜色永远跟着分类走，不跟排名走；彩色最多 8 种，
// 最后两个大类用中性灰，语义上就是"其他"的颜色）
const HUE_MAP: Record<string, string> = {
  餐饮饮食: '#2a78d6',
  交通出行: '#eb6834',
  购物消费: '#1baf7a',
  居住住房: '#eda100',
  娱乐休闲: '#e87ba4',
  医疗健康: '#008300',
  教育学习: '#4a3aa7',
  人情往来: '#e34948',
  通讯网络: '#8a8f98',
  其他支出: '#8a8f98'
}
const OTHER_GRAY = '#8a8f98'

function iconOf(name: string): string {
  return CATEGORIES.find((c) => c.name === name)?.icon ?? '📦'
}

function fmt(cents: number): string {
  return (cents / 100).toFixed(2)
}

const periodLabel = computed(() => {
  const now = new Date()
  if (period.value === 'month') return `${now.getFullYear()}年${now.getMonth() + 1}月`
  if (period.value === 'year') return `${now.getFullYear()}年`
  return '全部时间'
})

const maxCents = computed(() => Math.max(...stats.value.byCategory.map((r) => r.totalCents), 1))

// 环形图数据：超过 7 个分类时，把后面的合并进「其他分类」灰色扇区（最多 8 个扇区）
const donutData = computed(() => {
  const rows = stats.value.byCategory
  if (rows.length <= 7) return rows
  const top = rows.slice(0, 7)
  const rest = rows.slice(7)
  return [
    ...top,
    {
      category: '其他分类',
      totalCents: rest.reduce((s, r) => s + r.totalCents, 0),
      count: rest.reduce((s, r) => s + r.count, 0)
    }
  ]
})

function renderChart(): void {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const rows = donutData.value
  chart.setOption({
    color: rows.map((r) => HUE_MAP[r.category] ?? OTHER_GRAY),
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>¥${fmt(p.value)}（${p.percent}%）`
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#52514e', fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        label: {
          formatter: '{d}%',
          fontSize: 11,
          color: '#52514e'
        },
        data: rows.map((r) => ({
          name: `${iconOf(r.category)} ${r.category}`,
          value: r.totalCents,
          label: { show: r.totalCents / stats.value.totalCents >= 0.1 }
        }))
      }
    ]
  })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    stats.value = await window.api.getStats(period.value)
    await nextTick()
    renderChart()
  } catch (err) {
    ElMessage.error('统计读取失败，请重试')
    console.error(err)
  } finally {
    loading.value = false
  }
}

watch(period, load)

function onResize(): void {
  chart?.resize()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div v-loading="loading" class="stats-page">
    <div class="filter-row">
      <el-radio-group v-model="period">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="year">今年</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="stats.count === 0" class="empty-wrap">
      <el-empty :description="`${periodLabel}还没有记账记录，去「记一笔」记下第一笔吧`" />
    </div>

    <template v-else>
      <div class="hero">
        <div class="hero-label">{{ periodLabel }} · 总支出</div>
        <div class="hero-amount">¥{{ fmt(stats.totalCents) }}</div>
        <div class="hero-sub">共 {{ stats.count }} 笔</div>
      </div>

      <el-card shadow="never" class="chart-card">
        <div ref="chartEl" class="chart"></div>
      </el-card>

      <el-card shadow="never" class="rank-card">
        <div class="rank-title">分类排行</div>
        <div v-for="r in stats.byCategory" :key="r.category" class="rank-row">
          <span class="rank-dot" :style="{ background: HUE_MAP[r.category] ?? OTHER_GRAY }"></span>
          <span class="rank-name">{{ iconOf(r.category) }} {{ r.category }}</span>
          <span class="rank-bar-wrap">
            <span
              class="rank-bar"
              :style="{ width: Math.max((r.totalCents / maxCents) * 100, 2) + '%' }"
            ></span>
          </span>
          <span class="rank-amount">¥{{ fmt(r.totalCents) }}</span>
          <span class="rank-pct">{{ ((r.totalCents / stats.totalCents) * 100).toFixed(1) }}%</span>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.filter-row {
  display: flex;
  justify-content: flex-end;
}
.empty-wrap {
  padding-top: 40px;
}
.hero {
  text-align: center;
  padding: 4px 0 2px;
}
.hero-label {
  font-size: 13px;
  color: #909399;
}
.hero-amount {
  font-size: 40px;
  font-weight: 700;
  color: #303133;
  font-variant-numeric: tabular-nums;
  margin: 4px 0;
}
.hero-sub {
  font-size: 13px;
  color: #909399;
}
.chart-card,
.rank-card {
  border-radius: 12px;
}
.chart {
  height: 300px;
}
.rank-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.rank-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.rank-name {
  width: 150px;
  flex: none;
  font-size: 13px;
  color: #606266;
}
.rank-bar-wrap {
  flex: 1;
  height: 8px;
  background: #eef0f3;
  border-radius: 4px;
  overflow: hidden;
}
.rank-bar {
  display: block;
  height: 100%;
  background: #2a78d6;
  border-radius: 4px;
}
.rank-amount {
  width: 90px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  font-variant-numeric: tabular-nums;
  flex: none;
}
.rank-pct {
  width: 56px;
  text-align: right;
  font-size: 12px;
  color: #909399;
  flex: none;
}
</style>
