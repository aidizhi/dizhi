# assets 目录说明

本目录集中存放项目使用的静态资源，以 SVG 矢量图形为主。SVG 相比位图具备
**无损缩放、体积小、可被 CSS / JS 动态控制** 等优势，是本项目的核心呈现载体。

```
assets/
├── README.md        本说明文件
└── svg/
    └── icon-sprite.svg   图标雪碧图（<symbol> 定义）
```

> 仓库根目录还散落着若干站点级位图（如 favicon、PWA 图标、`apple-touch-icon.png`
> 等），它们服务于浏览器与安装场景，不在本目录范围内。

---

## 一、图标雪碧图 `svg/icon-sprite.svg`

### 设计约定

- 采用 `<symbol>` 定义每个图标，统一 `viewBox="0 0 24 24"` 视口，便于按需缩放。
- 图标使用 `stroke="currentColor"` 描边，**颜色由外层 CSS 的 `color` 属性决定**，
  因此可随上下文（如悬停、激活态）自由变色。
- 描边宽度统一为 `2`，`stroke-linecap` / `stroke-linejoin` 均为 `round`，
  保证线条端点与拐角圆润一致。
- 根 `<svg>` 设置 `width="0" height="0"` 并绝对定位隐藏，仅作为定义容器，
  不占用布局空间。

### 可用图标

| 图标 ID | 用途 |
|---------|------|
| `icon-home` | 首页 |
| `icon-search` | 搜索 |
| `icon-settings` | 设置（齿轮） |
| `icon-user` | 用户 |
| `icon-bell` | 通知 |
| `icon-menu` | 菜单（汉堡） |
| `icon-refresh` | 刷新 |
| `icon-download` | 下载 |

### 用法

**1）外部引用（推荐，便于缓存）**

雪碧图作为独立文件时，通过 `<use href="文件路径#symbol-id">` 引用：

```html
<svg class="icon" aria-hidden="true">
  <use href="assets/svg/icon-sprite.svg#icon-home"></use>
</svg>
```

> 旧版 Safari 对跨文件 `xlink:href` 支持更好；如遇兼容问题，可同时补充
> `xlink:href`。本仓库图标统一使用标准 `href`。

**2）内联引用（同文档内）**

若雪碧图已内联进当前 HTML，则直接用 `#id` 引用：

```html
<svg class="icon" aria-hidden="true"><use href="#icon-search"></use></svg>
```

### 配套 CSS 建议

```css
.icon {
  display: inline-block;
  width: 1em;            /* 跟随字号缩放 */
  height: 1em;
  fill: none;
  stroke: currentColor;  /* 颜色继承自 color */
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vertical-align: middle;
}

/* 状态变色示例 */
.icon:hover { color: #38bdf8; }
.icon.is-active { color: #818cf8; }
```

---

## 二、SVG 资源命名与新增规范

为保持资源一致、便于协作，新增 SVG 资源时请遵循：

1. **文件名**：小写连字符命名，如 `wave-bg.svg`、`icon-sprite.svg`。
2. **视口**：图标统一 `viewBox="0 0 24 24"`；背景 / 装饰类按实际画布设定并
   搭配 `preserveAspectRatio`。
3. **颜色**：优先使用 `currentColor` 或在 `<defs>` 中集中定义渐变，避免硬编码
   十六进制色散落各处。
4. **可访问性**：装饰性图形加 `aria-hidden="true"`；含语义的图形加
   `role="img"` 与 `aria-label`。
5. **动画**：使用 SMIL 时务必在 `<style>` 中加入 `@media (prefers-reduced-motion)`
   媒体查询，尊重用户的减弱动画偏好。
6. **优化**：提交前可用 `svgo`（已列为 devDependency）压缩路径、去除冗余属性。

```bash
# 单文件优化示例
npx svgo assets/svg/icon-sprite.svg
```

---

## 三、与工具库配合

图标与图形的路径数据可交由 [`lib/svg-utils.js`](../lib/svg-utils.js) 处理，
包括路径长度计算、变形插值、绝对转相对、transform 解析等。例如在制作路径
morphing 动画时，可先用 `convertToRelative` 规范化起止路径，再用
`morphPath` 逐帧插值，详见工具库源码注释。
