// 两枚骰子：点击后以物理方式弹出 —— 重力 + 撞边反弹 + 能量衰减，
// 最后吸回原框。回框只位移，立方体角度保持，点数不复位。
//
// 先在内存里以 1ms 步长跑完整段物理，再采样为关键帧交给 CSS 平滑驱动。
const FACE_ANGLE = {
  1: { rx: 0,   ry: 0 },
  2: { rx: -90, ry: 0 },
  3: { rx: 90,  ry: 0 },
  4: { rx: 0,   ry: -90 },
  5: { rx: 0,   ry: 90 },
  6: { rx: 0,   ry: 180 },
};

const CUBE = 52;        // 立方体边长(px)，与 wxss 一致
const SEG_MS = 240;     // 每段动画时长（节奏快）
const SEGMENTS = 7;     // 关键帧段数（物理总时长 = SEGMENTS*SEG_MS）
const HOMING_MS = 340;  // 最后回框段时长

// 物理参数：水平桌面滚动，无重力；快速弹远、边滚边衰减
const RESTITUTION = 0.78;   // 撞边回弹系数（保持弹性）
const WALL_FRICTION = 0.96; // 撞边时切向衰减小（保持滚动）
const AIR_DRAG = 0.9995;    // 线速度滚动摩擦（极小，滚得远、慢慢停）
const ANG_DRAG = 0.999;     // 角速度滚动摩擦（翻滚逐渐变慢）
const HOMING_TIME = 1.1;    // 秒，弹射滚动足够久后平滑回框

// 单枚骰子的物理轨迹（px 秒单位），返回关键帧数组
function simulate(start, vw, vh, value) {
  const hx = start.x;
  const hy = start.y;
  const rad = CUBE / 2;
  const minX = rad;
  const maxX = vw - rad;
  const minY = rad + 8;          // 顶部留点状态栏余量
  const maxY = vh - rad - 8;

  let x = hx;
  let y = hy;
  let vx = start.vx;
  let vy = start.vy;

  // 角速度（度/秒）：弹得快、滚得快，边飞边滚
  let ax = 1000 + Math.random() * 700;
  let ay = 1000 + Math.random() * 700;
  if (start.vx < 0) ax = -ax;
  if (Math.random() < 0.5) ay = -ay;
  let angX = 0;
  let angY = 0;

  const dt = 0.001;
  const total = SEGMENTS * (SEG_MS / 1000);
  const sampleEvery = SEG_MS / 1000;
  let nextSample = 0;
  const frames = [];

  // 起点帧
  frames.push({ tx: 0, ty: 0, rx: 0, ry: 0 });
  nextSample += sampleEvery;

  let t = 0;
  while (t < total) {
    const homing = t >= HOMING_TIME;
    if (!homing) {
      // 水平桌面：无重力，仅靠滚动摩擦让速度（和角速度）逐渐衰减
      vx *= AIR_DRAG;
      vy *= AIR_DRAG;
      ax *= ANG_DRAG;
      ay *= ANG_DRAG;
    } else {
      // 平滑回框：对原位置做弹簧 + 阻尼，速度自然收住、不停顿
      const k = 30;
      vx += ((hx - x) * k - vx * 9) * dt;
      vy += ((hy - y) * k - vy * 9) * dt;
      ax *= ANG_DRAG;
      ay *= ANG_DRAG;
    }

    x += vx * dt;
    y += vy * dt;

    // 碰撞：桌面四边反弹
    if (x < minX) { x = minX; vx = -vx * RESTITUTION; vy *= WALL_FRICTION; }
    else if (x > maxX) { x = maxX; vx = -vx * RESTITUTION; vy *= WALL_FRICTION; }
    if (y < minY) { y = minY; vy = -vy * RESTITUTION; vx *= WALL_FRICTION; }
    else if (y > maxY) { y = maxY; vy = -vy * RESTITUTION; vx *= WALL_FRICTION; }

    // 角速度积分 → 翻滚角
    angX += ax * dt;
    angY += ay * dt;

    t += dt;
    if (t + 1e-9 >= nextSample && frames.length <= SEGMENTS) {
      frames.push({
        tx: +(x - hx).toFixed(1),
        ty: +(y - hy).toFixed(1),
        rx: Math.round(angX),
        ry: Math.round(angY),
      });
      nextSample += sampleEvery;
    }
  }

  // 最后一帧：位移回到原框，角度对齐到目标点数（最近的等价角，突变最小）
  const canon = FACE_ANGLE[value];
  const snap = (cur, c) => {
    let n = Math.round((cur - c) / 360);
    return c + 360 * n;
  };
  const last = frames[frames.length - 1];
  last.tx = 0;
  last.ty = 0;
  last.rx = snap(last.rx, canon.rx);
  last.ry = snap(last.ry, canon.ry);
  return frames;
}

Component({
  data: {
    d1: { rx: 0, ry: 0, tx: 0, ty: 0, moveDur: 0, spinDur: 0 },
    d2: { rx: 0, ry: 0, tx: 0, ty: 0, moveDur: 0, spinDur: 0 },
    total: 0,
    rolling: false,
    homing: false
  },

  lifetimes: {
    detached() { clearTimeout(this._timer); }
  },

  methods: {
    roll() {
      if (this.data.rolling) return;

      const v1 = 1 + Math.floor(Math.random() * 6);
      const v2 = 1 + Math.floor(Math.random() * 6);
      const total = v1 + v2;

      this.setData({ rolling: true, total: 0, homing: false });

      const q = wx.createSelectorQuery().in(this);
      q.selectAll('.mover').boundingClientRect();
      q.exec((res) => {
        const rects = res[0] || [];
        if (!rects[0] || !rects[1]) {
          this._rollInPlace(v1, v2, total);
          return;
        }
        const info = (wx.getWindowInfo && wx.getWindowInfo()) || { windowWidth: 375, windowHeight: 667 };
        this._begin(v1, v2, total, rects, info.windowWidth, info.windowHeight);
      });
    },

    _begin(v1, v2, total, rects, vw, vh) {
      const launch = (rect, other) => {
        const x = rect.left + CUBE / 2;
        const y = rect.top + CUBE / 2;
        // 桌面快速滚出：低平方向、初速大；两枚朝相反方向分开
        const speed = 1500 + Math.random() * 400;
        const ang = (Math.random() * 0.5 - 0.25);       // 接近水平的小偏角
        const dir = other < x ? 1 : -1;                 // 朝远离另一枚的方向
        const vx = Math.cos(ang) * speed * dir;
        const vy = Math.sin(ang) * speed;
        return { x, y, vx, vy };
      };

      const c1 = rects[0].left + CUBE / 2;
      const c2 = rects[1].left + CUBE / 2;
      const s1 = launch(rects[0], c2);
      const s2 = launch(rects[1], c1);

      this._plan = {
        frames1: simulate(s1, vw, vh, v1),
        frames2: simulate(s2, vw, vh, v2),
        v1: v1, v2: v2, total: total,
        step: 0,
      };

      wx.vibrateShort({ type: 'medium' });
      this._step();
    },

    _step() {
      const plan = this._plan;
      const i = plan.step;
      const f1 = plan.frames1[i];
      const f2 = plan.frames2[i];
      // 最后一段回框用稍长、更柔的时长，其余弹跳段干脆
      const isLast = i === SEGMENTS;
      const dur = (isLast ? HOMING_MS : SEG_MS) / 1000;

      this.setData({
        homing: isLast,
        d1: { rx: f1.rx, ry: f1.ry, tx: f1.tx, ty: f1.ty, moveDur: dur, spinDur: dur },
        d2: { rx: f2.rx, ry: f2.ry, tx: f2.tx, ty: f2.ty, moveDur: dur, spinDur: dur },
      });

      clearTimeout(this._timer);
      const wait = isLast ? HOMING_MS : SEG_MS;
      this._timer = setTimeout(() => {
        if (plan.step < SEGMENTS) {
          plan.step += 1;
          this._step();
        } else {
          this._finish();
        }
      }, wait + 20);
    },

    _finish() {
      const plan = this._plan;
      this.setData({
        rolling: false,
        homing: false,
        total: plan.total,
        d1: { rx: this.data.d1.rx, ry: this.data.d1.ry, tx: 0, ty: 0, moveDur: 0, spinDur: 0 },
        d2: { rx: this.data.d2.rx, ry: this.data.d2.ry, tx: 0, ty: 0, moveDur: 0, spinDur: 0 },
      });
      this.triggerEvent('rolled', { point: plan.total, dice: [plan.v1, plan.v2] });
      this._plan = null;
    },

    // 兜底：拿不到位置时原地翻滚
    _rollInPlace(v1, v2, total) {
      const c1 = FACE_ANGLE[v1];
      const c2 = FACE_ANGLE[v2];
      const n = (this._n = (this._n || 0) + SEGMENTS);
      const dur = (SEGMENTS * SEG_MS) / 1000;
      this.setData({
        d1: { rx: c1.rx + 360 * n, ry: c1.ry + 360 * n, tx: 0, ty: 0, moveDur: dur, spinDur: dur },
        d2: { rx: c2.rx + 360 * n, ry: c2.ry + 360 * n, tx: 0, ty: 0, moveDur: dur, spinDur: dur },
      });
      clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        this.setData({ rolling: false, total: total });
        this.triggerEvent('rolled', { point: total, dice: [v1, v2] });
      }, SEGMENTS * SEG_MS + 20);
    }
  }
});
