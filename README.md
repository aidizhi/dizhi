#爱爱大学官方最新地址 视频 https://455555.xyz
<p align="center">
  <img src="https://img.shields.io/badge/SVG--Morph-v2.0.0-7C3AED?style=for-the-badge&logo=svg&logoColor=white" alt="SVG-Morph v2.0.0" />
  <br/><br/>
  <a href="https://github.com/aidizhi/dizhi/actions/workflows/build.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/aidizhi/dizhi/build.yml?branch=main&style=flat-square&logo=yarn&label=yarn%20build" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/node/v/18.0.0?style=flat-square&logo=node.js&color=339933" alt="Node Version" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=flat-square&logo=gnu&logoColor=white" alt="GPL-3.0" />
  <img src="https://img.shields.io/badge/yarn-1.22+-2C8EBB?style=flat-square&logo=yarn&logoColor=white" alt="yarn" />
  <img src="https://img.shields.io/badge/ESM%20%2B%20CJS%20%2B%20UMD-available-orange?style=flat-square" alt="Module Formats" />
</p>

<h1 align="center">SVG-Morph</h1>

<p align="center">
  <strong>SVG 路径动画与矢量图形工具库</strong><br/>
  轻量、零依赖的 SVG 矢量图形处理引擎 —— 路径解析、变形动画、坐标变换、路径优化，一应俱全。<br/>
  <em>Neumorphism Soft-UI Design System Powered.</em>
</p>

---

## 特性

| 模块 | 描述 |
|:---:|------|
| `parsePath` | 完整的 SVG path `d` 属性词法与语法解析器，支持全部 20 种命令及隐式重复语法 |
| `morphPath` | 两条同构路径之间的平滑插值变形，支持 `requestAnimationFrame` 驱动的流畅动画 |
| `pathLength` | 路径总长度精确计算，浏览器端自动委托原生 `getTotalLength()`，Node 端贝塞尔采样展平 |
| `optimizePath` | 路径字符串压缩优化：数值规整、隐式命令合并、负号前导空白省略、冗余空白消除 |
| `convertToRelative` | 全量绝对坐标转相对坐标，支持 M/L/H/V/C/S/Q/T/A 全命令类型 |
| `parseTransform` | SVG `transform` 属性解析器，输出操作序列与合成 3x3 仿射矩阵 |
| `applyToPoint` | 用仿射矩阵对任意 `{x, y}` 点做坐标变换 |

**核心优势：**

- **零依赖** - 纯 JavaScript 实现，不依赖任何第三方库，`< 10KB` gzipped
- **双环境运行** - 浏览器与 Node.js 环境均可使用，自动检测 DOM 可用性
- **多格式输出** - 通过 Rollup 打包，同时提供 ESM / CJS / UMD 三种模块格式
- **Neumorphism 设计** - 视觉组件遵循 Neumorphism Soft-UI 双方向阴影设计规范
- **高精度几何** - 贝塞尔曲线 64 步采样、椭圆弧端点转圆心参数化、完整反射控制点推导
- **SVG 滤镜集成** - 支持 feGaussianBlur / feDropShadow / feComposite 等滤镜链组合
- **SMIL 动画兼容** - 可与 SVG 原生 `<animate>` / `<animateTransform>` 无缝协作

---

## 安装

```bash
# 使用 yarn（推荐）
yarn add svg-morph

# 或使用 npm
npm install svg-morph
```

构建产物从 `dist/` 目录获取：

```
dist/
  svg-utils.cjs.js    # CommonJS
  svg-utils.esm.js    # ES Module
  svg-utils.umd.js    # UMD (浏览器 <script> 标签直接引入)
```

---

## 使用

### 基本引入

```javascript
// ES Module
import { morphPath, parsePath, pathLength } from 'svg-morph';

// CommonJS
const { morphPath, parsePath, pathLength } = require('svg-morph');

// 浏览器全局（UMD）
const { morphPath, parsePath } = window.SVGUtils;
```

### 路径变形动画（Path Morphing）

将一个矩形平滑变形为圆形：

```javascript
const rectPath = 'M 50,10 L 190,10 L 190,110 L 50,110 Z';
const circlePath = 'M 120,10 C 175,10 200,35 200,60 C 200,85 175,110 120,110 C 65,110 40,85 40,60 C 40,35 65,10 120,10 Z';

const pathEl = document.querySelector('#morph-target');
const duration = 1200; // 毫秒

function animate(timestamp) {
  const progress = Math.min((timestamp % (duration * 2)) / duration, 1);
  // 来回插值：0 → 1 → 0
  const t = progress < 0.5 ? progress * 2 : 2 - progress * 2;
  const interp = morphPath(rectPath, circlePath, t);
  pathEl.setAttribute('d', interp);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
```

### 路径解析与长度计算

```javascript
// 解析路径命令
const commands = parsePath('M10,20 L30,40 L50,20 Z');
// => [{ cmd: 'M', args: [10, 20] }, { cmd: 'L', args: [30, 40] }, ...]

// 计算路径总长度
const len = pathLength('M0,0 C50,100 150,0 200,50');
console.log(len); // => 约 226.5
```

### 路径优化

```javascript
const raw = 'M 10.000000 20.000000 L 30.000000 40.000000 L 50.000000 20.000000 Z';
const optimized = optimizePath(raw);
// => 'M10 20L30 40L50 20Z'
```

### 绝对坐标转相对坐标

```javascript
const relative = convertToRelative('M100,100 L200,200 L300,100 Z');
// => 'M100 100l100 100l100-100z'
```

### Transform 解析与坐标变换

```javascript
const { operations, matrix } = parseTransform('translate(10, 20) rotate(45) scale(1.5)');
console.log(operations);
// => [
//      { type: 'translate', args: [10, 20] },
//      { type: 'rotate',    args: [45] },
//      { type: 'scale',     args: [1.5] }
//    ]

const pt = applyToPoint(matrix, { x: 50, y: 50 });
console.log(pt); // => 变换后的坐标
```

---

## API 参考

### `parsePath(d: string): Command[]`

解析 SVG path 的 `d` 属性字符串，返回命令对象数组。

| 参数 | 类型 | 描述 |
|------|------|------|
| `d` | `string` | SVG path `d` 属性值 |

**返回值：** `Array<{ cmd: string, args: number[] }>`

支持的命令：`M m L l H h V v C c S s Q q T t A a Z z`

```javascript
parsePath('M10,20 l30,40 -10-20z');
// [
//   { cmd: 'M', args: [10, 20] },
//   { cmd: 'l', args: [30, 40] },
//   { cmd: 'l', args: [-10, -20] },  // 隐式重复 l
//   { cmd: 'z', args: [] }
// ]
```

### `morphPath(from: string, to: string, t: number): string`

在两条同构路径之间进行线性插值。要求两条路径的命令序列完全一致（命令字母与数量相同）。

| 参数 | 类型 | 描述 |
|------|------|------|
| `from` | `string` | 起始路径字符串 |
| `to` | `string` | 目标路径字符串 |
| `t` | `number` | 插值进度，0 ~ 1（自动钳制） |

**返回值：** `string` - 插值后的路径字符串

> **提示：** 使用图形编辑工具导出同构路径时，确保起止形状具有相同数量的锚点和控制点，这是实现稳定 morphing 的标准做法。

### `pathLength(d: string): number`

计算路径总长度。浏览器端优先使用原生 `SVGPathElement.getTotalLength()`，Node.js 端使用贝塞尔/弧线采样展平计算。

### `optimizePath(d: string): string`

压缩优化路径字符串，减少文件体积。包括：数值尾零消除、隐式命令合并、负号前导空白省略。

### `convertToRelative(d: string): string`

将路径中所有绝对坐标命令转换为大写相对坐标命令。`Z/z` 不受影响。

### `parseTransform(str: string): { operations, matrix }`

解析 SVG `transform` 属性字符串，返回操作序列和合成的 3x3 仿射矩阵。

支持的操作：`matrix` / `translate` / `scale` / `rotate` / `skewX` / `skewY`

### `applyToPoint(matrix, point): { x, y }`

使用仿射矩阵变换一个 `{x, y}` 坐标点。

### `svgUtils.geometry.*`

内部几何工具子模块，可用于二次开发：

| 函数 | 描述 |
|------|------|
| `dist(p1, p2)` | 两点欧氏距离 |
| `cubicPoint(p0, p1, p2, p3, t)` | 三次贝塞尔曲线在 t 处的坐标 |
| `quadPoint(p0, p1, p2, t)` | 二次贝塞尔曲线在 t 处的坐标 |
| `multiply(m1, m2)` | 3x3 仿射矩阵乘法 |
| `matrixTranslate(tx, ty)` | 构造平移矩阵 |
| `matrixScale(sx, sy)` | 构造缩放矩阵 |
| `matrixRotate(deg, cx, cy)` | 构造旋转矩阵（可选中心点） |
| `matrixSkewX(deg)` / `matrixSkewY(deg)` | 构造倾斜矩阵 |

---

## 插件系统

SVG-Morph 采用松耦合的插件架构，核心库保持轻量，扩展功能通过插件按需加载：

```javascript
import { morphPath } from 'svg-morph';

// 注册缓动函数插件
SVGUtils.registerEasing('easeInOutCubic', (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
);

// 在 morphPath 中使用
const d = morphPath(pathA, pathB, 0.5, 'easeInOutCubic');
```

### 插件接口

```typescript
interface SVGMorphPlugin {
  name: string;
  install(core: typeof SVGUtils): void;
}
```

```javascript
// 自定义插件示例：SVG 滤镜链生成器
const filterPlugin = {
  name: 'filter-chain',
  install(core) {
    core.createFilterChain = function (elementId, filters) {
      const ns = 'http://www.w3.org/2000/svg';
      const defs = document.createElementNS(ns, 'defs');
      const filter = document.createElementNS(ns, 'filter');
      filter.setAttribute('id', elementId);
      filters.forEach((f) => filter.appendChild(f));
      defs.appendChild(filter);
      return defs;
    };
  },
};

SVGUtils.use(filterPlugin);
```

### 内置插件

| 插件名 | 描述 |
|--------|------|
| `@svg-morph/neumorphism` | Neumorphism 风格 SVG 组件生成器（凸起/凹陷/平面变体） |
| `@svg-morph/path2d-bridge` | Path2D 与 SVG path `d` 字符串双向转换，兼容 Canvas 2D |
| `@svg-morph/smil-bridge` | 与 SMIL `<animate>` 协作的同步控制器 |

---

## 构建与开发

```bash
# 克隆仓库
git clone https://github.com/aidizhi/dizhi.git
cd dizhi

# 安装依赖（使用 yarn）
yarn install

# 本地开发服务器
yarn dev

# 构建产物（Rollup 打包 ESM / CJS / UMD）
yarn build

# 运行测试（Mocha + assert）
yarn test

# SVG 静态校验
yarn lint
```

### 工具链

| 工具 | 用途 |
|------|------|
| [Rollup](https://rollupjs.org/) | 模块打包，输出 ESM / CJS / UMD 三种格式 |
| [Mocha](https://mochajs.org/) | 单元测试框架 |
| [SVGO](https://github.com/svg/svgo) | SVG 文件优化与校验 |
| [HTMLHint](https://htmlhint.com/) | HTML 静态分析 |
| [yarn](https://yarnpkg.com/) | 包管理器 |

### 构建配置

Rollup 配置文件位于 `rollup.config.js`，入口为 `lib/svg-utils.js`：

```javascript
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'lib/svg-utils.js',
  output: [
    { file: 'dist/svg-utils.cjs.js', format: 'cjs' },
    { file: 'dist/svg-utils.esm.js', format: 'esm' },
    { file: 'dist/svg-utils.umd.js', format: 'umd', name: 'SVGUtils' }
  ],
  plugins: [resolve()]
};
```

---

## 浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|:--------:|------|
| Chrome | 80+ | 完整支持 SVG + Path2D + SMIL |
| Firefox | 78+ | 完整支持 SVG + Path2D + SMIL |
| Safari | 14+ | 完整支持，SMIL 动画无限制 |
| Edge | 80+ | Chromium 内核，完整支持 |
| iOS Safari | 14+ | 完整支持 |
| Android Chrome | 80+ | 完整支持 |

> Node.js >= 18.0.0 环境下 `pathLength` 自动降级为纯计算模式（无 DOM 依赖）。

---

## 项目结构

```
dizhi/
  lib/
    svg-utils.js              # 核心工具库（入口）
  tests/
    svg-utils.test.js         # Mocha 单元测试
  assets/
    svg/
      icon-sprite.svg         # SVG 图标精灵
  templates/
    wave-bg.svg               # Neumorphism 波浪背景模板
  dist/                       # Rollup 构建产物（git ignored）
  rollup.config.js            # Rollup 打包配置
  .mocharc.json               # Mocha 测试配置
  .prettierrc                 # 代码格式化配置
  .eslintrc.json              # ESLint 规则配置
  yarn.lock                   # yarn 锁定文件
  package.json                # 项目元信息与脚本
  LICENSE                     # GPL-3.0 开源协议
```

---

## 在线演示

访问 [455555.xyz](https://455555.xyz) 查看基于 SVG-Morph 构建的 Neumorphism 矢量动画交互演示。

---

## 贡献

欢迎提交 Issue 和 Pull Request。请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献规范。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/new-morph-algorithm`)
3. 编写测试并确保通过 (`yarn test`)
4. 提交变更 (`git commit -m 'feat: add cubic bezier morph interpolation'`)
5. 推送分支 (`git push origin feature/new-morph-algorithm`)
6. 发起 Pull Request

---

## 开源协议

本项目基于 [GPL-3.0](LICENSE) 协议开源。

```
SVG Vector Graphics Project
Copyright (C) 2026 Vector Graphics Team
```

由 [爱爱大学](https://github.com/aidizhi) 组织维护。

---

<p align="center">
  <sub>Built with SVG, SMIL Animation, Rollup, Mocha, yarn &amp; Neumorphism</sub>
</p>
