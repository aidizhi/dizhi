# 更新记录（CHANGELOG）

本项目所有显著变更均会记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。本仓库以 SVG 矢量图形为核心，
因此变更记录侧重 SVG 资源、路径工具、动画与滤镜相关能力。

## [Unreleased]

### 计划中
- 提供 SVG 渐变（`<linearGradient>` / `<radialGradient>`）的运行时解析与插值工具。
- 新增 `lib/svg-filter-presets.js`，沉淀常用滤镜预设（发光、毛玻璃、混合模式）。

---

## [2.0.0] - 2026-06-18

### 重构 / 破坏性变更
- **协议变更**：由 MIT 切换为 **GPL-3.0**，确保衍生作品同样以自由协议开源。
- 重构 `lib/svg-utils.js` 为纯函数库，移除对全局状态的依赖；统一以
  CommonJS + `window` 全局双形式导出，浏览器与 Node.js 均可直接 `require` 或 `<script>` 引入。
- `parseTransform` 返回结构由单一矩阵调整为 `{ operations, matrix }`，同时暴露操作序列与合成矩阵；
  旧的 `parseTransform(str).a` 形式需改为 `parseTransform(str).matrix.a`。

### 新增
- 新增 `pathLength(d)`：浏览器优先调用原生 `getTotalLength`，无 DOM 时降级为
  解析 + 曲线采样展平计算，支持 M/L/H/V/C/S/Q/T/A/Z 全命令集。
- 新增 `morphPath(from, to, progress)`：在两条同构路径间线性插值，用于
  Path2D 变形动画。
- 新增 `optimizePath(d)`：数值规整、隐式命令合并、负数省略空白，压缩路径体积。
- 新增 `convertToRelative(d)`：将绝对坐标命令转换为相对坐标命令。
- 新增 `parseTransform(str)` / `applyToPoint(matrix, point)`：解析并组合
  translate/rotate/scale/skewX/skewY/matrix。
- 新增 `templates/wave-bg.svg`：三层叠加渐变波浪背景模板，自带 SMIL 横向平移
  动画，并尊重 `prefers-reduced-motion`。
- 新增 `assets/svg/icon-sprite.svg`：基于 `<symbol>` 的图标雪碧图，含
  home/search/settings/user/bell/menu 等图标。
- 新增 `.prettierrc`，对 `*.svg` 使用 html 解析器并放宽 `printWidth` 至 200。

### 变更
- 将路径数值精度统一为 3 位小数，并通过尾零裁剪进一步压缩输出。
- `package.json` 升至 `2.0.0`，`author` 标注为 Vector Graphics Team。

### 修复
- 修正 `pathLength` 在 moveto（M/m）命令上误累加定位位移的问题——moveto
  仅定位起点、不绘制线段，不再计入路径长度。
- 修正相对坐标判定：小写命令才为相对坐标，避免绝对/相对混淆导致的长度与
  转换结果错误。

---

## [1.5.0] - 2026-04-09

### 新增
- 引入 SMIL 原生动画方案，为关键 SVG 元素提供 `<animate>` / `<animateTransform>`。
- 新增 Path2D 路径变形运行时，支持在贝塞尔控制点序列间平滑过渡。
- 新增高斯模糊、发光、混合模式等 SVG 滤镜预设。

### 变更
- 统一图标描边宽度为 2，`stroke-linecap` / `stroke-linejoin` 均为 `round`，
  并采用 `currentColor` 以便通过 CSS 控制配色。

### 修复
- 修复部分路径首命令缺少 `M` 导致渲染失败的问题。
- 修复 Safari 下 `<use>` 跨文件引用 `xlink:href` 的兼容问题，补充 `href` 回退。

---

## [1.4.0] - 2026-02-20

### 新增
- 新增 SVG 图标体系，覆盖导航、操作、状态三类高频图标。
- 为可访问性补充 `role="img"` 与 `aria-label`，并默认隐藏装饰性图形
  （`aria-hidden="true"`）。

### 变更
- 将零散的 `<svg>` 内联片段整理为可复用模板，便于跨页面统一维护。

---

## [1.3.0] - 2025-12-15

### 新增
- 新增渐变与图案（`<pattern>`）资源，支撑背景与纹理需求。
- 提供路径插值计算的雏形实现，作为后续 morphing 能力的基础。

### 修复
- 修复 `viewBox` 与 `width/height` 不一致导致的图标缩放错位。

---

## [1.2.0] - 2025-10-28

### 新增
- 引入 Neumorphism 新拟态设计风格，建立双方向阴影系统。
- 新增 CSS3 过渡与关键帧动画，配合 SVG 元素呈现软质 UI 质感。

### 变更
- 调整色彩令牌，统一明暗两套主题色板。

---

## [1.1.0] - 2025-08-30

### 新增
- 接入 PWA：新增 Service Worker 与 manifest，矢量资源纳入离线缓存。
- 新增浏览器检测能力，识别内置浏览器并提供引导。

### 修复
- 修复 PWA 图标在部分 Android 设备上不显示的问题（补充 192/512 尺寸）。

---

## [1.0.0] - 2025-06-10

### 首次发布
- 确立以纯静态 HTML / CSS / Vanilla JS 构建的矢量图形落地页架构。
- 完成首个可部署版本，集成基础 SVG 渲染与响应式布局。
- 提供 GitHub Pages 自动部署流程。

---

[Unreleased]: https://github.com/aidizhi/dizhi/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/aidizhi/dizhi/releases/tag/v2.0.0
[1.5.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.5.0
[1.4.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.4.0
[1.3.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.3.0
[1.2.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.2.0
[1.1.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.1.0
[1.0.0]: https://github.com/aidizhi/dizhi/releases/tag/v1.0.0
