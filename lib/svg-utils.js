/**
 * svg-utils.js - SVG 矢量图形工具函数库
 * ==========================================================================
 * 提供路径解析、长度计算、路径变形（morphing）、路径优化、绝对转相对、
 * transform 解析等常用能力。所有函数均不依赖第三方库，纯 JavaScript 实现，
 * 可同时在浏览器与 Node.js 环境中运行。
 *
 * 主要 API：
 *   - parsePath(d)            解析路径字符串为命令对象数组
 *   - pathLength(d)           计算路径总长度（优先使用浏览器原生 getTotalLength）
 *   - morphPath(from, to, t) 在两条结构相同的路径之间插值变形
 *   - optimizePath(d)        优化路径（去小数尾零、隐式合并同类命令、压缩空白）
 *   - convertToRelative(d)   将绝对坐标命令转换为相对坐标命令
 *   - parseTransform(str)    解析 transform 属性，返回操作数组与合成矩阵
 *   - applyToPoint(matrix, p) 用合成矩阵变换一个点
 *
 * 版权所有 (C) 2026 Vector Graphics Team
 * 遵循 GPL-3.0 协议发布。
 * ==========================================================================
 */

'use strict';

/** 每条命令所需的参数个数（大小写一致） */
const COMMAND_ARG_COUNT = {
  M: 2, m: 2,
  L: 2, l: 2,
  H: 1, h: 1,
  V: 1, v: 1,
  C: 6, c: 6,
  S: 4, s: 4,
  Q: 4, q: 4,
  T: 2, t: 2,
  A: 7, a: 7,
  Z: 0, z: 0,
};

/** 保留小数位数（用于 optimizePath 的数值规整） */
const PRECISION = 3;

/* --------------------------------------------------------------------------
 * 内部几何工具
 * ------------------------------------------------------------------------ */

/** 两点欧氏距离 */
function dist(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 相对坐标累加 */
function addPoint(cur, dx, dy) {
  return { x: cur.x + dx, y: cur.y + dy };
}

/** 三次贝塞尔曲线在 t 处的点 */
function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

/** 二次贝塞尔曲线在 t 处的点 */
function quadPoint(p0, p1, p2, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/* --------------------------------------------------------------------------
 * parsePath - 路径词法/语法解析
 * ------------------------------------------------------------------------ */

/**
 * 解析 SVG path 的 d 属性，返回命令对象数组。
 * 每个对象形如 { cmd: 'M', args: [x, y] }，args 为原始数值数组。
 *
 * 支持隐式重复命令：首个 M/m 之后的坐标对自动作为 L/l 处理，
 * 其它命令的后续坐标对重复同一命令。
 *
 * @param {string} d 路径字符串
 * @returns {Array<{cmd:string,args:number[]}>}
 */
function parsePath(d) {
  if (typeof d !== 'string') {
    throw new TypeError('parsePath: 路径必须是字符串');
  }
  // 匹配命令字母或数值（含负号、小数、科学计数法）
  const tokenRe = /([a-zA-Z])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
  const tokens = d.match(tokenRe);
  if (!tokens) return [];

  const commands = [];
  let i = 0;
  let prevCmd = '';

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (/^[a-zA-Z]$/.test(cmd)) {
      i += 1; // 消费命令字母
    } else {
      // 隐式重复：M 之后的隐式为 L，m 之后的隐式为 l，其余重复上一命令
      if (prevCmd === 'M') cmd = 'L';
      else if (prevCmd === 'm') cmd = 'l';
      else if (prevCmd) cmd = prevCmd;
      else throw new Error('parsePath: 路径必须以 M 或 m 开头');
    }

    const argCount = COMMAND_ARG_COUNT[cmd];
    if (argCount === undefined) {
      throw new Error('parsePath: 未知的路径命令 "' + cmd + '"');
    }

    const args = [];
    for (let k = 0; k < argCount; k += 1) {
      if (i >= tokens.length || /^[a-zA-Z]$/.test(tokens[i])) {
        throw new Error('parsePath: 命令 "' + cmd + '" 参数不足');
      }
      args.push(parseFloat(tokens[i]));
      i += 1;
    }
    commands.push({ cmd, args });
    prevCmd = cmd;
  }

  return commands;
}

/* --------------------------------------------------------------------------
 * pathLength - 路径总长度
 * ------------------------------------------------------------------------ */

/**
 * 计算路径总长度。
 * 浏览器环境下优先使用原生 SVGPathElement.getTotalLength() 以保证精度；
 * Node.js 或无 DOM 环境下，使用解析 + 曲线采样展平的方式逐段累加。
 *
 * @param {string} d 路径字符串
 * @returns {number} 路径总长度
 */
function pathLength(d) {
  if (typeof d !== 'string') throw new TypeError('pathLength: 路径必须是字符串');

  // 浏览器原生实现
  if (typeof document !== 'undefined' && document.createElementNS) {
    try {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      // 不必挂载到 body，部分引擎需挂载才返回正确值，此处兼容处理
      let len = 0;
      try {
        len = path.getTotalLength();
      } catch (e) {
        document.body.appendChild(svg);
        len = path.getTotalLength();
        document.body.removeChild(svg);
      }
      if (isFinite(len) && len > 0) return len;
    } catch (e) {
      // 降级到手动计算
    }
  }

  // 手动计算：解析命令后逐段累加，曲线用采样展平
  const commands = parsePath(d);
  const STEPS = 64; // 曲线采样步数，越大越精确
  let total = 0;
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let prevCtrl = null; // 上一条曲线的控制点，用于 S/T 反射

  for (const { cmd, args } of commands) {
    const lower = cmd.toLowerCase();
    const rel = cmd === lower; // 小写命令为相对坐标
    let next;

    switch (lower) {
      case 'm': {
        // moveto 仅定位起点，不绘制线段，因此不计入路径长度
        next = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        cur = next;
        start = { x: cur.x, y: cur.y };
        prevCtrl = null;
        break;
      }
      case 'l': {
        next = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        total += dist(cur, next);
        cur = next;
        prevCtrl = null;
        break;
      }
      case 'h': {
        next = { x: rel ? cur.x + args[0] : args[0], y: cur.y };
        total += dist(cur, next);
        cur = next;
        prevCtrl = null;
        break;
      }
      case 'v': {
        next = { x: cur.x, y: rel ? cur.y + args[0] : args[0] };
        total += dist(cur, next);
        cur = next;
        prevCtrl = null;
        break;
      }
      case 'c': {
        const p1 = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        const p2 = rel ? addPoint(cur, args[2], args[3]) : { x: args[2], y: args[3] };
        const p3 = rel ? addPoint(cur, args[4], args[5]) : { x: args[4], y: args[5] };
        total += sampleCubic(cur, p1, p2, p3, STEPS);
        prevCtrl = p2; // 三次贝塞尔第二控制点用于后续 S 反射
        cur = p3;
        break;
      }
      case 's': {
        // 平滑三次：控制点1 = 当前点关于上一控制点的反射
        const c1 = prevCtrl ? reflect(cur, prevCtrl) : cur;
        const c2 = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        const p3 = rel ? addPoint(cur, args[2], args[3]) : { x: args[2], y: args[3] };
        total += sampleCubic(cur, c1, c2, p3, STEPS);
        prevCtrl = c2;
        cur = p3;
        break;
      }
      case 'q': {
        const p1 = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        const p2 = rel ? addPoint(cur, args[2], args[3]) : { x: args[2], y: args[3] };
        total += sampleQuad(cur, p1, p2, STEPS);
        prevCtrl = p1; // 二次贝塞尔控制点用于后续 T 反射
        cur = p2;
        break;
      }
      case 't': {
        const c1 = prevCtrl ? reflect(cur, prevCtrl) : cur;
        const p2 = rel ? addPoint(cur, args[0], args[1]) : { x: args[0], y: args[1] };
        total += sampleQuad(cur, c1, p2, STEPS);
        prevCtrl = c1;
        cur = p2;
        break;
      }
      case 'a': {
        // 椭圆弧：转换为圆心参数化后采样
        const arcPts = arcToPoints(cur, args, rel);
        if (arcPts && arcPts.length) {
          for (let s = 1; s < arcPts.length; s += 1) {
            total += dist(arcPts[s - 1], arcPts[s]);
          }
          cur = arcPts[arcPts.length - 1];
        }
        prevCtrl = null;
        break;
      }
      case 'z': {
        total += dist(cur, start);
        cur = { x: start.x, y: start.y };
        prevCtrl = null;
        break;
      }
      default:
        break;
    }
  }

  return total;
}

/** 点 p1 关于参考点 origin 的反射 */
function reflect(origin, p1) {
  return { x: 2 * origin.x - p1.x, y: 2 * origin.y - p1.y };
}

/** 三次贝塞尔采样累加长度 */
function sampleCubic(p0, p1, p2, p3, steps) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const pt = cubicPoint(p0, p1, p2, p3, t);
    len += dist(prev, pt);
    prev = pt;
  }
  return len;
}

/** 二次贝塞尔采样累加长度 */
function sampleQuad(p0, p1, p2, steps) {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const pt = quadPoint(p0, p1, p2, t);
    len += dist(prev, pt);
    prev = pt;
  }
  return len;
}

/**
 * 椭圆弧（A/a）端点转圆心参数化，并返回采样点序列。
 * args = [rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y]
 */
function arcToPoints(cur, args, rel) {
  const rx = Math.abs(args[0]);
  const ry = Math.abs(args[1]);
  const phi = (args[2] * Math.PI) / 180;
  const largeArc = args[3] !== 0;
  const sweep = args[4] !== 0;
  const end = rel ? addPoint(cur, args[5], args[6]) : { x: args[5], y: args[6] };

  // 起终点重合则无弧
  if (dist(cur, end) === 0) return [cur];

  // 半径为 0 退化为直线
  if (rx === 0 || ry === 0) return [cur, end];

  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // 步骤1：计算 (x1', y1')
  const dx = (cur.x - end.x) / 2;
  const dy = (cur.y - end.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // 步骤2：修正半径
  let rxs = rx * rx;
  let rys = ry * ry;
  const x1ps = x1p * x1p;
  const y1ps = y1p * y1p;
  const lambda = x1ps / rxs + y1ps / rys;
  let rxv = rx;
  let ryv = ry;
  if (lambda > 1) {
    const sqrtLambda = Math.sqrt(lambda);
    rxv = rx * sqrtLambda;
    ryv = ry * sqrtLambda;
    rxs = rxv * rxv;
    rys = ryv * ryv;
  }

  // 步骤3：计算圆心 (cx', cy')
  const sign = largeArc === sweep ? -1 : 1;
  const denom = rxs * y1ps + rys * x1ps;
  const num = rxs * rys - denom;
  const factor = denom === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / denom));
  const cxp = (factor * rxv * y1p) / ryv;
  const cyp = (factor * -ryv * x1p) / rxv;

  // 步骤4：圆心转回原坐标系
  const cx = cosPhi * cxp - sinPhi * cyp + (cur.x + end.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (cur.y + end.y) / 2;

  // 步骤5：计算起止角
  const ux = (x1p - cxp) / rxv;
  const uy = (y1p - cyp) / ryv;
  const vx = (-x1p - cxp) / rxv;
  const vy = (-y1p - cyp) / ryv;

  let theta1 = angleBetween(1, 0, ux, uy);
  let dtheta = angleBetween(ux, uy, vx, vy) % (2 * Math.PI);
  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweep && dtheta < 0) dtheta += 2 * Math.PI;

  // 采样
  const STEPS = 64;
  const pts = [];
  for (let i = 0; i <= STEPS; i += 1) {
    const a = theta1 + (dtheta * i) / STEPS;
    const px = cosPhi * rxv * Math.cos(a) - sinPhi * ryv * Math.sin(a) + cx;
    const py = sinPhi * rxv * Math.cos(a) + cosPhi * ryv * Math.sin(a) + cy;
    pts.push({ x: px, y: py });
  }
  return pts;
}

/** 向量 (ux,uy) 到 (vx,vy) 的有向夹角（弧度） */
function angleBetween(ux, uy, vx, vy) {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  const cos = len === 0 ? 1 : Math.max(-1, Math.min(1, dot / len));
  let a = Math.acos(cos);
  if (ux * vy - uy * vx < 0) a = -a;
  return a;
}

/* --------------------------------------------------------------------------
 * morphPath - 路径变形
 * ------------------------------------------------------------------------ */

/**
 * 在两条结构相同的路径之间线性插值，返回进度 t（0~1）处的路径字符串。
 * 要求两条路径的命令序列完全一致（命令字母与数量相同），这是实现稳定
 * morphing 动画的标准做法——通常在设计期就让起止路径采用同构命令结构。
 *
 * @param {string} fromPath 起始路径
 * @param {string} toPath   目标路径
 * @param {number} progress 进度 0~1（自动钳制到该范围）
 * @returns {string} 插值后的路径字符串
 */
function morphPath(fromPath, toPath, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const a = parsePath(fromPath);
  const b = parsePath(toPath);

  if (a.length !== b.length) {
    throw new Error('morphPath: 两条路径命令数量不一致 (' + a.length + ' vs ' + b.length + ')');
  }

  let result = '';
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].cmd !== b[i].cmd) {
      throw new Error(
        'morphPath: 第 ' + (i + 1) + ' 条命令类型不一致 (' + a[i].cmd + ' vs ' + b[i].cmd + ')'
      );
    }
    const cmd = a[i].cmd;
    const aArgs = a[i].args;
    const bArgs = b[i].args;
    if (aArgs.length !== bArgs.length) {
      throw new Error('morphPath: 第 ' + (i + 1) + ' 条命令参数数量不一致');
    }
    const interp = aArgs.map((v, k) => roundTo(v + (bArgs[k] - v) * t, PRECISION));
    result += cmd + interp.join(' ');
  }
  return result.trim();
}

/* --------------------------------------------------------------------------
 * optimizePath - 路径优化
 * ------------------------------------------------------------------------ */

/**
 * 优化路径字符串，减小体积：
 *   1. 数值规整到 PRECISION 位小数并去除尾零；
 *   2. 利用隐式命令语法，省略连续同类命令的字母（M 后的隐式 L 同样省略）；
 *   3. 在负数前置时省略分隔空白（如 "10 -5" -> "10-5"）；
 *   4. 压缩多余空白。
 *
 * @param {string} d 路径字符串
 * @returns {string} 优化后的路径字符串
 */
function optimizePath(d) {
  const commands = parsePath(d);
  let out = '';
  let prevCmd = '';

  for (const { cmd, args } of commands) {
    const nums = args.map((n) => roundTo(n, PRECISION));
    let str = '';

    for (let i = 0; i < nums.length; i += 1) {
      const n = nums[i];
      // 负数可省略前导空白；其余用空格分隔
      const needSpace = i > 0 && !(n < 0);
      str += (needSpace ? ' ' : '') + n;
    }

    // 判断是否可省略命令字母
    const canImplicit =
      prevCmd !== '' &&
      (cmd === prevCmd || (prevCmd === 'M' && cmd === 'L') || (prevCmd === 'm' && cmd === 'l'));

    if (canImplicit) {
      // 隐式：首参数若非负也无需空格（紧贴上一段），此处用空格安全分隔
      out += (str.startsWith('-') ? '' : ' ') + str;
    } else {
      out += (out ? ' ' : '') + cmd + (str.startsWith('-') ? '' : ' ') + str;
    }
    prevCmd = cmd;
  }

  return out.trim();
}

/* --------------------------------------------------------------------------
 * convertToRelative - 绝对坐标转相对坐标
 * ------------------------------------------------------------------------ */

/**
 * 将路径中的绝对坐标命令（大写）转换为相对坐标命令（小写）。
 * Z/z 不受影响；A 命令仅旋转角度与终点转相对，flags 保持不变。
 *
 * @param {string} d 路径字符串
 * @returns {string} 全部使用相对坐标的路径字符串
 */
function convertToRelative(d) {
  const commands = parsePath(d);
  let out = '';
  let cur = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };

  for (const { cmd, args } of commands) {
    const lower = cmd.toLowerCase();
    const rel = cmd === lower; // 小写命令为相对坐标
    let s = lower;

    switch (lower) {
      case 'm':
      case 'l': {
        let nx, ny;
        if (rel) {
          nx = cur.x + args[0];
          ny = cur.y + args[1];
          s += fmt(args[0]) + ' ' + fmt(args[1]);
        } else {
          nx = args[0];
          ny = args[1];
          s += fmt(nx - cur.x) + ' ' + fmt(ny - cur.y);
        }
        cur = { x: nx, y: ny };
        if (lower === 'm') start = { x: cur.x, y: cur.y };
        break;
      }
      case 'h': {
        let nx;
        if (rel) {
          nx = cur.x + args[0];
          s += fmt(args[0]);
        } else {
          nx = args[0];
          s += fmt(nx - cur.x);
        }
        cur = { x: nx, y: cur.y };
        break;
      }
      case 'v': {
        let ny;
        if (rel) {
          ny = cur.y + args[0];
          s += fmt(args[0]);
        } else {
          ny = args[0];
          s += fmt(ny - cur.y);
        }
        cur = { x: cur.x, y: ny };
        break;
      }
      case 'c': {
        const pts = rel
          ? [
              { x: cur.x + args[0], y: cur.y + args[1] },
              { x: cur.x + args[2], y: cur.y + args[3] },
              { x: cur.x + args[4], y: cur.y + args[5] },
            ]
          : [
              { x: args[0], y: args[1] },
              { x: args[2], y: args[3] },
              { x: args[4], y: args[5] },
            ];
        s +=
          fmt(pts[0].x - cur.x) +
          ' ' +
          fmt(pts[0].y - cur.y) +
          ' ' +
          fmt(pts[1].x - cur.x) +
          ' ' +
          fmt(pts[1].y - cur.y) +
          ' ' +
          fmt(pts[2].x - cur.x) +
          ' ' +
          fmt(pts[2].y - cur.y);
        cur = pts[2];
        break;
      }
      case 's': {
        const pts = rel
          ? [
              { x: cur.x + args[0], y: cur.y + args[1] },
              { x: cur.x + args[2], y: cur.y + args[3] },
            ]
          : [
              { x: args[0], y: args[1] },
              { x: args[2], y: args[3] },
            ];
        s +=
          fmt(pts[0].x - cur.x) +
          ' ' +
          fmt(pts[0].y - cur.y) +
          ' ' +
          fmt(pts[1].x - cur.x) +
          ' ' +
          fmt(pts[1].y - cur.y);
        cur = pts[1];
        break;
      }
      case 'q': {
        const pts = rel
          ? [
              { x: cur.x + args[0], y: cur.y + args[1] },
              { x: cur.x + args[2], y: cur.y + args[3] },
            ]
          : [
              { x: args[0], y: args[1] },
              { x: args[2], y: args[3] },
            ];
        s +=
          fmt(pts[0].x - cur.x) +
          ' ' +
          fmt(pts[0].y - cur.y) +
          ' ' +
          fmt(pts[1].x - cur.x) +
          ' ' +
          fmt(pts[1].y - cur.y);
        cur = pts[1];
        break;
      }
      case 't': {
        const pt = rel
          ? { x: cur.x + args[0], y: cur.y + args[1] }
          : { x: args[0], y: args[1] };
        s += fmt(pt.x - cur.x) + ' ' + fmt(pt.y - cur.y);
        cur = pt;
        break;
      }
      case 'a': {
        // rx ry rot largeArc sweep x y —— 仅终点转相对，其余原样保留
        let ex, ey;
        if (rel) {
          ex = cur.x + args[5];
          ey = cur.y + args[6];
          s +=
            fmt(args[0]) +
            ' ' +
            fmt(args[1]) +
            ' ' +
            fmt(args[2]) +
            ' ' +
            fmt(args[3]) +
            ' ' +
            fmt(args[4]) +
            ' ' +
            fmt(args[5]) +
            ' ' +
            fmt(args[6]);
        } else {
          ex = args[5];
          ey = args[6];
          s +=
            fmt(args[0]) +
            ' ' +
            fmt(args[1]) +
            ' ' +
            fmt(args[2]) +
            ' ' +
            fmt(args[3]) +
            ' ' +
            fmt(args[4]) +
            ' ' +
            fmt(ex - cur.x) +
            ' ' +
            fmt(ey - cur.y);
        }
        cur = { x: ex, y: ey };
        break;
      }
      case 'z': {
        cur = { x: start.x, y: start.y };
        break;
      }
      default:
        break;
    }
    out += s + ' ';
  }

  return out.trim();
}

/* --------------------------------------------------------------------------
 * parseTransform - 解析 transform 属性
 * ------------------------------------------------------------------------ */

/** 3x3 仿射矩阵： | a c e |  用 {a,b,c,d,e,f} 表示 */
/**              | b d f | */
/**              | 0 0 1 | */

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** 矩阵相乘 m1 * m2 */
function multiply(m1, m2) {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

/** 构造 translate 矩阵 */
function matrixTranslate(tx, ty) {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty === undefined ? 0 : ty };
}

/** 构造 scale 矩阵 */
function matrixScale(sx, sy) {
  return { a: sx, b: 0, c: 0, d: sy === undefined ? sx : sy, e: 0, f: 0 };
}

/** 构造 rotate 矩阵（可带中心点） */
function matrixRotate(deg, cx, cy) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const r = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
  if (cx === undefined && cy === undefined) return r;
  const cxc = cx || 0;
  const cyc = cy || 0;
  return multiply(multiply(matrixTranslate(cxc, cyc), r), matrixTranslate(-cxc, -cyc));
}

/** 构造 skewX 矩阵 */
function matrixSkewX(deg) {
  return { a: 1, b: 0, c: Math.tan((deg * Math.PI) / 180), d: 1, e: 0, f: 0 };
}

/** 构造 skewY 矩阵 */
function matrixSkewY(deg) {
  return { a: 1, b: Math.tan((deg * Math.PI) / 180), c: 0, d: 1, e: 0, f: 0 };
}

/**
 * 解析 SVG transform 属性字符串，例如：
 *   "translate(10 20) rotate(45) scale(1.5) skewX(10)"
 *
 * @param {string} transformStr transform 属性字符串
 * @returns {{
 *   operations: Array<{type:string, args:number[]}>,
 *   matrix: {a:number,b:number,c:number,d:number,e:number,f:number}
 * }}
 */
function parseTransform(transformStr) {
  if (typeof transformStr !== 'string' || transformStr.trim() === '') {
    return { operations: [], matrix: { ...IDENTITY } };
  }

  const operations = [];
  let matrix = { ...IDENTITY };

  // 匹配 type(args)
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(transformStr)) !== null) {
    const type = match[1];
    // 同时兼容逗号与空白分隔
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .filter((s) => s !== '')
      .map(Number);

    operations.push({ type, args });

    let m;
    switch (type) {
      case 'matrix':
        m = { a: args[0], b: args[1], c: args[2], d: args[3], e: args[4], f: args[5] };
        break;
      case 'translate':
        m = matrixTranslate(args[0], args[1]);
        break;
      case 'scale':
        m = matrixScale(args[0], args[1]);
        break;
      case 'rotate':
        m = matrixRotate(args[0], args[1], args[2]);
        break;
      case 'skewX':
        m = matrixSkewX(args[0]);
        break;
      case 'skewY':
        m = matrixSkewY(args[0]);
        break;
      default:
        m = { ...IDENTITY };
    }
    // SVG 中 transform 列表从左到右应用，等价于矩阵依次左乘
    matrix = multiply(m, matrix);
  }

  return { operations, matrix };
}

/**
 * 用合成矩阵变换一个点 {x, y}。
 * @param {{a,b,c,d,e,f}} matrix parseTransform 返回的 matrix
 * @param {{x:number,y:number}} point 待变换的点
 * @returns {{x:number,y:number}}
 */
function applyToPoint(matrix, point) {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

/* --------------------------------------------------------------------------
 * 数值格式化辅助
 * ------------------------------------------------------------------------ */

/** 将数值四舍五入到指定小数位 */
function roundTo(n, digits) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** 将数值格式化为字符串：去除尾零与多余小数点，-0 视作 0 */
function fmt(n) {
  const v = roundTo(n, PRECISION);
  const s = Object.is(v, -0) ? 0 : v;
  let str = String(s);
  // 处理 "1.20" -> "1.2"，"3.00" -> "3"
  if (str.indexOf('.') !== -1) {
    str = str.replace(/0+$/, '').replace(/\.$/, '');
  }
  return str;
}

/* --------------------------------------------------------------------------
 * 导出
 * ------------------------------------------------------------------------ */

const svgUtils = {
  parsePath,
  pathLength,
  morphPath,
  optimizePath,
  convertToRelative,
  parseTransform,
  applyToPoint,
  // 内部几何工具一并导出，便于二次开发
  geometry: {
    dist,
    cubicPoint,
    quadPoint,
    multiply,
    matrixTranslate,
    matrixScale,
    matrixRotate,
    matrixSkewX,
    matrixSkewY,
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = svgUtils;
}
if (typeof window !== 'undefined') {
  window.svgUtils = svgUtils;
}
