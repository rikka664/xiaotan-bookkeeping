import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import App from './App.vue'

// 界面组件库 Element Plus，语言设置为中文
createApp(App).use(ElementPlus, { locale: zhCn }).mount('#app')
