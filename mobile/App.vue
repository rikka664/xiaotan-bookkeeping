<script>
// App.vue 是整个手机版应用的"根组件"：它不显示内容，负责应用级的事件和全局样式
export default {
  // 应用第一次启动时触发（只触发一次）
  onLaunch() {},
  // 应用从后台回到前台时触发（比如切出去又切回来）
  onShow() {},
  // 应用进入后台时触发（比如按了 Home 键）
  onHide() {}
}
</script>

<style>
/* 全局默认样式：每个页面共用的背景色和文字颜色 */
page {
  background-color: #f5f6f8;
  color: #303133;
  font-size: 15px;
}
</style>
