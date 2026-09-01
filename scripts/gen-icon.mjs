// 生成应用图标 build/icon.png（256x256）：
// 蓝色圆角方块 + 白色铜钱（外圆内方）—— 纯代码绘制，零第三方依赖
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 256
const CENTER = 127.5
const CORNER_R = 58 // 圆角半径
const COIN_R = 74 // 铜钱外圆半径
const HOLE_HALF = 21 // 铜钱方孔半边长

// ---------- PNG 编码（使用 Node 内置 zlib，不依赖任何第三方库） ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 位深
  ihdr[9] = 6 // 颜色类型 RGBA
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0 // 每行前加一个 0（PNG 滤镜类型：无）
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- 图形计算 ----------
const GRAD_TOP = [74, 142, 249] // #4a8ef9
const GRAD_BOTTOM = [37, 99, 235] // #2563eb
const WHITE = [255, 255, 255]

// 圆角方块覆盖率（0 完全在外，1 完全在内，边缘平滑过渡）
function roundRectCov(x, y) {
  const b = CENTER - CORNER_R
  const qx = Math.abs(x - CENTER) - b
  const qy = Math.abs(y - CENTER) - b
  const d = Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - CORNER_R
  return d <= 0 ? 1 : d <= 1 ? 1 - d : 0
}

// 圆形覆盖率
function circleCov(x, y, r) {
  const d = Math.hypot(x - CENTER, y - CENTER) - r
  return d <= 0 ? 1 : d <= 1 ? 1 - d : 0
}

// 采样一个点的颜色（返回预乘 alpha 的 RGBA，便于边缘混色）
function sample(x, y) {
  const rr = roundRectCov(x, y)
  if (rr <= 0) return [0, 0, 0, 0]
  const t = y / (SIZE - 1)
  const bg = [
    GRAD_TOP[0] + (GRAD_BOTTOM[0] - GRAD_TOP[0]) * t,
    GRAD_TOP[1] + (GRAD_BOTTOM[1] - GRAD_TOP[1]) * t,
    GRAD_TOP[2] + (GRAD_BOTTOM[2] - GRAD_TOP[2]) * t
  ]
  const cc = circleCov(x, y, COIN_R)
  if (cc <= 0) return [bg[0] * rr, bg[1] * rr, bg[2] * rr, rr]
  const inHole = Math.abs(x - CENTER) <= HOLE_HALF && Math.abs(y - CENTER) <= HOLE_HALF
  if (inHole) return [bg[0] * rr, bg[1] * rr, bg[2] * rr, rr]
  // 白色铜钱以 cc 覆盖在背景上（预乘色相加 = 正确混色）
  const a = rr * cc + rr * (1 - cc)
  return [
    WHITE[0] * rr * cc + bg[0] * rr * (1 - cc),
    WHITE[1] * rr * cc + bg[1] * rr * (1 - cc),
    WHITE[2] * rr * cc + bg[2] * rr * (1 - cc),
    a
  ]
}

// ---------- 渲染（每像素 4x4 超采样抗锯齿） ----------
const rgba = Buffer.alloc(SIZE * SIZE * 4)
for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const [sr, sg, sb, sa] = sample(px + (sx + 0.5) / 4, py + (sy + 0.5) / 4)
        r += sr
        g += sg
        b += sb
        a += sa
      }
    }
    const i = (py * SIZE + px) * 4
    if (a > 0) {
      rgba[i] = Math.min(255, Math.round(r / a))
      rgba[i + 1] = Math.min(255, Math.round(g / a))
      rgba[i + 2] = Math.min(255, Math.round(b / a))
    }
    rgba[i + 3] = Math.min(255, Math.round((a / 16) * 255))
  }
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'icon.png')
writeFileSync(outPath, encodePng(SIZE, SIZE, rgba))
console.log('图标已生成:', outPath)

// 终端字符预览（32x32，'#'=白色铜钱，'.'=蓝色底，空格=透明圆角外区域）
console.log('--- 预览 ---')
for (let py = 0; py < 32; py++) {
  let line = ''
  for (let px = 0; px < 32; px++) {
    const [r, g, b, a] = sample(px * 8 + 4, py * 8 + 4)
    if (a <= 0.05) line += ' '
    else if (r > 200 && g > 200 && b > 200) line += '#'
    else line += '.'
  }
  console.log(line)
}
