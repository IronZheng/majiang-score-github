const api = require('../../utils/api');

const SEAT_OPTIONS = [
  { value: 0, name: '东', pos: 'right' },
  { value: 1, name: '南', pos: 'bottom' },
  { value: 2, name: '西', pos: 'left' },
  { value: 3, name: '北', pos: 'top' }
];

function fmtPct(v) {
  const n = Number(v || 0);
  return (Math.round(n * 10) / 10) + '%';
}

function fmtMoney(v) {
  const n = Number(v || 0);
  return (Math.round(n * 100) / 100).toString();
}

function todayStr() {
  const d = new Date();
  const p = function (x) { return (x < 10 ? '0' : '') + x; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function emptyForm() {
  return { winAmount: '', winSign: 1, baseScore: '', fee: '', duration: 1, date: todayStr(), seat: 0, note: '' };
}

Page({
  data: {
    stats: { totalGames: 0, winRateText: '0%', avgScoreText: '0' },
    seatDisplay: {
      top: { seatName: '北', games: 0, winRateText: '0%', avgScoreText: '0' },
      bottom: { seatName: '南', games: 0, winRateText: '0%', avgScoreText: '0' },
      left: { seatName: '西', games: 0, winRateText: '0%', avgScoreText: '0' },
      right: { seatName: '东', games: 0, winRateText: '0%', avgScoreText: '0' }
    },
    records: [],
    seatOptions: SEAT_OPTIONS,
    durationOptions: DURATION_OPTIONS,
    showInput: false,
    form: emptyForm(),
    submitting: false
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });
    this.loadData();
  },

  loadData() {
    const that = this;
    api.getUserRecordStats().then(function (stats) {
      if (!stats) return;
      const bySeat = {};
      (stats.seatStats || []).forEach(function (s) {
        bySeat[s.seat] = s;
      });
      let bestSeat = -1, bestRate = -1;
      [0, 1, 2, 3].forEach(function (seat) {
        const s = bySeat[seat];
        if (s && s.games > 0 && s.winRate > bestRate) {
          bestRate = s.winRate;
          bestSeat = seat;
        }
      });
      const build = function (seat) {
        const s = bySeat[seat] || { seatName: SEAT_OPTIONS[seat].name, games: 0, winRate: 0, avgScore: 0 };
        const sa = Number(s.avgScore) || 0;
        return {
          seatName: s.seatName,
          games: s.games || 0,
          winRate: Math.round(s.winRate || 0),
          winRateText: fmtPct(s.winRate),
          avgScoreText: fmtMoney(s.avgScore),
          avgClass: sa > 0 ? 'win' : (sa < 0 ? 'lose' : 'flat'),
          best: seat === bestSeat
        };
      };
      const avg = Number(stats.avgScore) || 0;
      that.setData({
        stats: {
          totalGames: stats.totalGames || 0,
          winRateText: fmtPct(stats.winRate),
          avgScoreText: fmtMoney(stats.avgScore),
          avgClass: avg > 0 ? 'win' : (avg < 0 ? 'lose' : 'flat')
        },
        seatDisplay: {
          top: build(3),
          bottom: build(1),
          left: build(2),
          right: build(0)
        }
      });
    }).catch(function () {});

    api.listUserRecords().then(function (list) {
      const records = (list || []).map(function (r) {
        const w = Number(r.winAmount || 0);
        return {
          id: r.id,
          seatName: r.seatName,
          date: r.recordDate,
          winAmountText: (w > 0 ? '+' : '') + fmtMoney(r.winAmount),
          winClass: w > 0 ? 'win' : (w < 0 ? 'lose' : 'flat'),
          baseScoreText: fmtMoney(r.baseScore),
          feeText: fmtMoney(r.fee),
          durationText: Math.max(1, Math.round((r.duration || 0) / 60)) + '小时',
          note: r.note || ''
        };
      });
      that.setData({ records: records });
    }).catch(function () {});
  },

  // ===================== 录入面板 =====================
  openInput() {
    this.setData({ showInput: true, form: emptyForm() });
  },

  closeInput() {
    this.setData({ showInput: false });
  },

  noop() {},

  onWinInput(e) {
    // 只允许数字与小数点（负号由正负按钮控制）
    let v = (e.detail.value || '').replace(/[^\d.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) {
      v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
    }
    this.setData({ 'form.winAmount': v });
  },

  toggleWinSign() {
    this.setData({ 'form.winSign': this.data.form.winSign > 0 ? -1 : 1 });
  },
  onBaseInput(e) { this.setData({ 'form.baseScore': e.detail.value }); },
  onFeeInput(e) { this.setData({ 'form.fee': e.detail.value }); },
  onDurationChange(e) {
    this.setData({ 'form.duration': DURATION_OPTIONS[Number(e.detail.value)] });
  },
  onNoteInput(e) { this.setData({ 'form.note': e.detail.value }); },

  onDateChange(e) {
    this.setData({ 'form.date': e.detail.value });
  },

  selectSeat(e) {
    this.setData({ 'form.seat': Number(e.currentTarget.dataset.seat) });
  },

  onSubmit() {
    const f = this.data.form;
    if (f.winAmount === '' || f.winAmount === null || f.winAmount === undefined) {
      wx.showToast({ title: '请输入输赢金额', icon: 'none' });
      return;
    }
    const payload = {
      openid: api.getOpenid(),
      seat: f.seat,
      winAmount: (Number(f.winAmount) || 0) * f.winSign,
      baseScore: f.baseScore ? Number(f.baseScore) : 0,
      fee: f.fee ? Number(f.fee) : 0,
      duration: (Number(f.duration) || 1) * 60,
      recordDate: f.date || todayStr(),
      note: f.note || ''
    };
    const that = this;
    this.setData({ submitting: true });
    api.saveUserRecord(payload).then(function () {
      that.setData({ showInput: false, submitting: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      that.loadData();
    }).catch(function (err) {
      that.setData({ submitting: false });
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
    });
  }
});
