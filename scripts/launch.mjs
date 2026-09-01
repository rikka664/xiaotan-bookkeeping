// 启动器：在本机启动 Electron 应用前，先移除环境变量 ELECTRON_RUN_AS_NODE。
// 原因：这台电脑的启动环境中带着 ELECTRON_RUN_AS_NODE=1（来源不明的遗留设置），
// 它会让 Electron 误以为自己应该"伪装成 Node.js 运行"，导致应用无法启动。
// 这里只清理本次启动的环境，不改动电脑上的任何全局设置。
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [cmd = 'dev', ...args] = process.argv.slice(2)

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const bin = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  'electron-vite',
  'bin',
  'electron-vite.js'
)
const child = spawn(process.execPath, [bin, cmd, ...args], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
