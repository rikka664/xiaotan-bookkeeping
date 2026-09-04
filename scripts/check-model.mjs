// 查看 aicodeswitch 当前为 Claude Code 绑定的模型
// 用法: node scripts/check-model.mjs
// 原理: 请求网关 /api/tool-bindings 拿到绑定，再查 /api/routes 对号入座，最后输出模型名
//       不动任何配置，纯查询。
//       网关没启动时友好提示，不报冷冰冰的报错。

import http from 'node:http';

const GATEWAY = 'http://127.0.0.1:4567';

// ── HTTP 封装（用 Node 内置 http，不额外装包）──────────────────────
function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: new URL(GATEWAY).hostname, port: 4567, path, method },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(body));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── 主逻辑 ───────────────────────────────────────────────────────
(async () => {
  // 先确认网关活着
  let bindings;
  try {
    const raw = await request('/api/tool-bindings');
    bindings = JSON.parse(raw);
  } catch (e) {
    console.error('❌ 无法连接 aicodeswitch 网关（127.0.0.1:4567）');
    console.error('   请先启动网关：在终端运行 aicos start');
    console.error('   或在浏览器打开 http://127.0.0.1:4567 确认面板正常显示');
    process.exit(1);
  }

  // 取 claude-code 绑定的路由 ID
  const cc = bindings['claude-code'];
  if (!cc || !cc.routeId) {
    console.log('⚠️  claude-code 当前没有绑定任何路由（未配置模型）');
    process.exit(0);
  }
  const routeId = cc.routeId;

  // 拿路由列表，找到对应那条
  let routes;
  try {
    const raw = await request('/api/routes');
    routes = JSON.parse(raw);
  } catch {
    routes = [];
  }

  const route = routes.find((r) => r.id === routeId);
  const routeName = route ? route.name : '（未知路由）';

  // 根据路由名推断模型（和 switch-cc-model.js 的常量保持一致）
  const MODEL_MAP = {
    'agnes default route': '🤖 Agnes（agnes-2.5-flash，免费）',
    deepseek:             '🐋 DeepSeek（deepseek-v4-pro[1m]）',
    'glm-5.3-flash':      '⚡ GLM-5.3-Flash（BAI 平台，免费）',
    'qwen3.8-flash':      '🌀 Qwen3.8-Flash（BAI 平台，免费）',
    'ling-3.0-flash':     '🟣 Ling-3.0-Flash-Fin（OpenRouter，免费）',
  };
  // route.name 可能是完整显示名，只要包含关键词就算匹配
  const matchedKey = Object.keys(MODEL_MAP).find(
    (k) => routeName.includes(k)
  );
  const modelDisplay = matchedKey ? MODEL_MAP[matchedKey] : `🔀 ${routeName}`;

  console.log(`✅ 当前模型：${modelDisplay}`);
  console.log(`   路由名称：${routeName}`);
  console.log('   切换：双击桌面「切换到DeepSeek模型.bat」或「切换到Agnes模型.bat」');
})().catch((e) => {
  console.error('查询失败：', e.message);
  process.exit(1);
});
