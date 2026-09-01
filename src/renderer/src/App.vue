<script setup lang="ts">
import { ref } from 'vue'
import RecordView from './views/RecordView.vue'
import BillsView from './views/BillsView.vue'
import StatsView from './views/StatsView.vue'

const activeMenu = ref('record')

const views: Record<string, { icon: string; title: string; component: any }> = {
  record: { icon: '✏️', title: '记一笔', component: RecordView },
  bills: { icon: '📋', title: '账单', component: BillsView },
  stats: { icon: '📊', title: '统计', component: StatsView }
}
</script>

<template>
  <el-container class="app-container">
    <el-header class="app-header" height="56px">
      <span class="app-title">📒 小谭记账</span>
      <span class="app-subtitle">每一笔，都算数</span>
    </el-header>
    <el-container class="app-body">
      <el-aside width="170px" class="app-aside">
        <el-menu :default-active="activeMenu" @select="(i) => (activeMenu = i)">
          <el-menu-item v-for="(v, k) in views" :key="k" :index="k">
            {{ v.icon }} {{ v.title }}
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <!-- :key 让切换菜单时重新加载对应页面，保证数据总是最新 -->
        <component :is="views[activeMenu].component" :key="activeMenu" />
      </el-main>
    </el-container>
  </el-container>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.app-container {
  height: 100%;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #2f6fed;
  color: #fff;
}
.app-title {
  font-size: 20px;
  font-weight: 600;
}
.app-subtitle {
  font-size: 13px;
  opacity: 0.85;
}
.app-aside {
  border-right: 1px solid #e5e7eb;
}
.app-main {
  background: #f7f8fa;
  padding: 16px 20px;
  overflow-y: auto;
}
</style>
