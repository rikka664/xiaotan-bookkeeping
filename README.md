# 小谭记账

个人桌面记账软件：记录每一笔花销，按两级分类管理，清晰看到钱花在了哪里。

- **平台**：Windows 10/11（代码兼容 macOS）
- **界面**：简体中文
- **货币**：人民币（元），金额支持两位小数
- **数据**：账本保存在本机 SQLite 文件（`%APPDATA%\小谭记账\xiaotan.db`），不联网、不上传

## 功能

- **记一笔**：输入金额，选择两级分类（先选一级大类，再选二级小类），选日期（默认今天），可选备注
- **账单列表**：按日期从新到旧排列，可按月份、按分类筛选，支持修改和删除（删除前弹窗确认）
- **统计视图**：本月 / 今年 / 全部总支出、各一级大类支出占比（环形图）、每个分类的支出明细排行
- **导出备份**：一键导出 CSV 文件（Excel 可直接打开），方便备份

## 安装

下载最新安装包：<https://github.com/rikka664/xiaotan-bookkeeping/releases>

双击「小谭记账-x.x.x-安装包.exe」→ 选择安装目录 → 下一步 → 完成，桌面会出现「小谭记账」图标。

## 技术栈

Electron · Vue 3 · Element Plus · TypeScript · Vite · SQLite

## 开发

```bash
npm install
npm run dev        # 开发运行（本仓库的启动入口，勿直接运行 electron）
npm run dist:win   # 打包 Windows 安装包（输出到 dist/ 目录）
```

详细产品文档与开发备忘录见 [CLAUDE.md](CLAUDE.md)。
