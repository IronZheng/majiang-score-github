const api = require('../../utils/api');
const share = require('../../utils/share');
const defaultProfiles = require('../../utils/default-profiles');

const STATUS_WAITING = 0;
const STATUS_PLAYING = 1;
const STATUS_FINISHED = 2;
const MAX_PLAYERS = 20;
const MIN_PLAYERS = 2;
const POLL_INTERVAL = 2500;

function formatTime(at) {
  if (!at) return '';
  const d = new Date(at);
  const hh = ('0' + d.getHours()).slice(-2);
  const mm = ('0' + d.getMinutes()).slice(-2);
  return hh + ':' + mm;
}

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cnRound(n) {
  if (n >= 1 && n <= 10) return CN_NUM[n];
  return String(n);
}

Page({
  data: {
    roomId: '',
    openid: '',
    isHost: false,
    status: STATUS_WAITING,
    statusText: '待开始',
    title: '',
    tableFeeEnabled: false,
    tableFeeScore: 0,
    tableFeeInput: '',
    players: [],
    feed: [],
    scoreRows: [],
    ranking: [],
    editingRound: 0,
    roundSum: 0,
    sumOk: true,
    loading: false,
    error: '',
    inviteVisible: false,
    qrcode: '',
    qrcodeLoading: false,
    _timer: null,
    _navigated: false
  },

  onLoad(query) {
    share.enableShareMenu();
    const openid = api.getOpenid();
    if (!query.roomId) {
      this.setData({ error: '房间号缺失' });
      return;
    }
    this.setData({ roomId: query.roomId, openid: openid });
    this.loadQrcode();
  },

  onShow() {
    if (this.data.roomId) this.startPolling();
  },

  onHide() {
    this.stopPolling();
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  },

  onUnload() {
    this.stopPolling();
    if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
  },

  startPolling() {
    if (this.data._timer) return;
    this.pollState();
    const that = this;
    const timer = setInterval(function () {
      that.pollState();
    }, POLL_INTERVAL);
    this.setData({ _timer: timer });
  },

  stopPolling() {
    if (this.data._timer) {
      clearInterval(this.data._timer);
      this.setData({ _timer: null });
    }
  },

  pollState() {
    const that = this;
    api.getRoomState(this.data.roomId).then(function (state) {
      const status = state.status;
      const statusText = status === STATUS_PLAYING ? '进行中' : (status === STATUS_FINISHED ? '已结束' : '待开始');
      const selfOpenid = that.data.openid;
      // 自己的头像/昵称以本地最新资料（globalData.userInfo）为准，
      // 这样在「我的」页更新后，房间内自己的头像昵称能第一时间刷新（无需重新加入）。
      const liveUser = getApp().globalData.userInfo || {};
      const players = (state.players || []).map(function (p) {
        const isSelf = p.openid === selfOpenid;
        const nickname = (isSelf && liveUser.nickName) ? liveUser.nickName : p.nickname;
        const avatarUrl = (isSelf && liveUser.avatarUrl) ? liveUser.avatarUrl : p.avatarUrl;
        return {
          openid: p.openid,
          nickname: nickname,
          avatarUrl: avatarUrl,
          totalScore: p.totalScore,
          isHost: p.isHost,
          initial: (nickname || '?').charAt(0),
          isSelf: isSelf
        };
      });
      // 保留当前各玩家本圈已输入的符号/数值与"是否被手动改过"标记
      const prev = {};
      (that.data.scoreRows || []).forEach(function (r) { prev[r.openid] = { sign: r.sign, value: r.value, touched: r.touched }; });
      const scoreRows = players.map(function (p) {
        const s = prev[p.openid] || { sign: 1, value: '', touched: false };
        return {
          openid: p.openid, nickname: p.nickname, avatarUrl: p.avatarUrl,
          initial: p.initial, isHost: p.isHost, isSelf: p.isSelf,
          totalScore: p.totalScore, sign: s.sign, value: s.value, touched: s.touched
        };
      });
      const feed = (state.feed || []).map(function (f) {
        return {
          nickname: f.nickname,
          deltaText: (f.delta > 0 ? '+' : '') + f.delta,
          deltaPositive: f.delta >= 0,
          roundText: '第' + f.round + '圈',
          timeText: formatTime(f.at)
        };
      });
      // 实时排名：按累计总分降序（同分则按昵称稳定排序），用于每轮结束后即时展示战况
      const playerCount = players.length;
      const ranking = players.slice().sort(function (a, b) {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return (a.nickname || '').localeCompare(b.nickname || '');
      }).map(function (p, i) {
        return {
          rank: i + 1,
          openid: p.openid,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          initial: p.initial,
          isSelf: p.isSelf,
          totalScore: p.totalScore,
          scorePositive: p.totalScore > 0,
          scoreNegative: p.totalScore < 0,
          scoreZero: p.totalScore === 0,
          isLeader: i === 0,
          isLast: i === playerCount - 1
        };
      });
      // 回合矩阵：列=玩家（与 players 顺序一致），行=每一回合；台费作为与玩家并列的独立列
      // 优先用后端 events（全量、未截断）；旧后端未部署 events 时回退到 feed（最近 30 条）保证可见。
      const rawEvents = (state.events && state.events.length) ? state.events : (state.feed || []);
      const scoreEvents = rawEvents.filter(function (e) { return e.openid !== '__FEE__'; });
      let maxRound = 0;
      scoreEvents.forEach(function (e) { if (e.round > maxRound) maxRound = e.round; });
      const deltaMap = {};
      scoreEvents.forEach(function (e) {
        if (!deltaMap[e.openid]) deltaMap[e.openid] = {};
        deltaMap[e.openid][e.round] = (deltaMap[e.openid][e.round] || 0) + e.delta;
      });
      const feeByRound = {};
      rawEvents.forEach(function (e) {
        if (e.openid === '__FEE__') feeByRound[e.round] = (feeByRound[e.round] || 0) + e.delta;
      });
      const matrixRows = [];
      for (let r = 1; r <= maxRound; r++) {
        const cells = players.map(function (p) {
          const dm = deltaMap[p.openid];
          const d = (dm && dm[r] !== undefined) ? dm[r] : 0;
          return {
            delta: d,
            deltaText: (d > 0 ? '+' : '') + d,
            positive: d > 0,
            negative: d < 0,
            zero: d === 0
          };
        });
        const f = feeByRound[r] || 0;
        const feeCell = {
          delta: f,
          deltaText: f > 0 ? '+' + f : '',
          positive: f > 0,
          negative: false,
          zero: f === 0
        };
        matrixRows.push({ roundLabel: '第' + cnRound(r) + '回', cells: cells, feeCell: feeCell });
      }
      // 当前编辑圈号：服务端当前圈 + 1（无事件则为 1）
      const srvRound = state.currentRound;
      const targetRound = srvRound >= 1 ? srvRound + 1 : 1;
      let editingRound = that.data.editingRound;
      if (editingRound < 1 || targetRound > editingRound) editingRound = targetRound;

      let sum = 0;
      scoreRows.forEach(function (r) {
        const v = Number(r.value) || 0;
        if (v) sum += r.sign * v;
      });

      that.setData({
        status: status,
        statusText: statusText,
        title: state.title,
        tableFeeEnabled: state.tableFeeEnabled,
        tableFeeScore: state.tableFeeScore,
        tableFeeInput: (that.data.tableFeeInput && that.data.tableFeeInput !== '') ? that.data.tableFeeInput : (state.tableFeeScore ? String(state.tableFeeScore) : ''),
        players: players,
        scoreRows: scoreRows,
        feed: feed,
        matrixRows: matrixRows,
        isHost: state.hostOpenid === selfOpenid,
        editingRound: editingRound,
        roundSum: sum,
        sumOk: sum === 0,
        ranking: ranking
      });

      if (status === STATUS_FINISHED && !that.data._navigated) {
        that.setData({ _navigated: true });
        that.stopPolling();
        wx.redirectTo({ url: '/pages/room-result/index?roomId=' + that.data.roomId });
      }
    }).catch(function (err) {
      if (!that.data._navigated) {
        const msg = (err && err.message) || '加载失败';
        // 房间不存在/已失效：整页明确提示（带房间号，便于区分是传错还是库里没有）
        if (msg.indexOf('不存在') >= 0 || msg.indexOf('失效') >= 0) {
          that.setData({
            error: msg + '（房间号：' + that.data.roomId + '）',
            status: STATUS_WAITING,
            scoreRows: []
          });
        } else {
          wx.showToast({ title: msg, icon: 'none' });
        }
      }
    });
  },

  // ===================== 按圈记分 =====================
  toggleSign(e) {
    const openid = e.currentTarget.dataset.openid;
    const rows = this.data.scoreRows.map(function (r) {
      if (r.openid === openid) return Object.assign({}, r, { sign: r.sign > 0 ? -1 : 1, auto: false, touched: true });
      return r;
    });
    this._applyRows(rows);
  },

  onRowInput(e) {
    const openid = e.currentTarget.dataset.openid;
    const val = e.detail.value;
    const rows = this.data.scoreRows.map(function (r) {
      if (r.openid === openid) return Object.assign({}, r, { value: val, auto: false, touched: true });
      return r;
    });
    this._applyRows(rows);
  },

  _applyRows(rows) {
    const feeEnabled = this.data.tableFeeEnabled;
    const fee = feeEnabled ? (Number(this.data.tableFeeInput) || 0) : 0;
    // 自动补齐：仅剩一个未填、且该行从未被手动改过时，按「玩家合计 + 台费 = 0」反推
    // 注意：开启台费时，最后一名由用户自行填写，不自动计算
    let emptyCount = 0;
    let emptyIdx = -1;
    rows.forEach(function (r, i) {
      if (r.value === '' || r.value === null) { emptyCount += 1; emptyIdx = i; }
    });
    // 任意一次输入都先作废上一次挂起的自动计算，避免覆盖用户正在输入的内容
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
    // 仅剩一名未填、且从未被手动改过时，延迟自动补齐（留出输入时间，例如要输入 10）
    if (emptyCount === 1 && rows[emptyIdx].touched !== true && !feeEnabled) {
      const that = this;
      this._autoTimer = setTimeout(function () {
        that._autoTimer = null;
        // 重新校验：用户若已在该行输入或新增其他空行，则取消自动补齐
        const cur = that.data.scoreRows;
        let cnt = 0;
        let idx = -1;
        cur.forEach(function (r, i) {
          if (r.value === '' || r.value === null) { cnt += 1; idx = i; }
        });
        if (cnt !== 1 || cur[idx].touched === true) return;
        let sumOthers = 0;
        cur.forEach(function (r) {
          if (r.value !== '' && r.value !== null) {
            const v = Number(r.value) || 0;
            if (v) sumOthers += r.sign * v;
          }
        });
        // 目标：sumOthers + 自动值 + 台费 = 0
        const complement = -(sumOthers + fee);
        const rounded = Math.round(complement * 100) / 100;
        const updated = cur.slice();
        updated[idx] = Object.assign({}, updated[idx], {
          sign: rounded >= 0 ? 1 : -1,
          value: String(Math.abs(rounded)),
          auto: true
        });
        let sum = 0;
        updated.forEach(function (r) {
          const v = Number(r.value) || 0;
          if (v) sum += r.sign * v;
        });
        const target = feeEnabled ? (sum + fee) : sum;
        that.setData({ scoreRows: updated, roundSum: sum, sumOk: target === 0 });
      }, 800);
      // 先立即回写用户输入，不附带自动值，保证输入响应即时且不被覆盖
      let sum = 0;
      rows.forEach(function (r) {
        const v = Number(r.value) || 0;
        if (v) sum += r.sign * v;
      });
      const target = feeEnabled ? (sum + fee) : sum;
      this.setData({ scoreRows: rows, roundSum: sum, sumOk: target === 0 });
      return;
    }
    let sum = 0;
    rows.forEach(function (r) {
      const v = Number(r.value) || 0;
      if (v) sum += r.sign * v;
    });
    // 台费开启时校验「玩家合计 + 台费 = 0」；否则校验「玩家合计 = 0」
    const target = feeEnabled ? (sum + fee) : sum;
    this.setData({ scoreRows: rows, roundSum: sum, sumOk: target === 0 });
  },

  onFeeInput(e) {
    const val = e.detail.value;
    this.setData({ tableFeeInput: val });
    const feeEnabled = this.data.tableFeeEnabled;
    const fee = feeEnabled ? (Number(val) || 0) : 0;
    let sum = 0;
    this.data.scoreRows.forEach(function (r) {
      const v = Number(r.value) || 0;
      if (v) sum += r.sign * v;
    });
    const target = feeEnabled ? (sum + fee) : sum;
    this.setData({ roundSum: sum, sumOk: target === 0 });
  },

  resetRound() {
    const rows = this.data.scoreRows.map(function (r) {
      return Object.assign({}, r, { sign: 1, value: '', auto: false, touched: false });
    });
    this._applyRows(rows);
  },

  confirmRound() {
    if (this.data.status !== STATUS_PLAYING) return;
    if (!this.data.sumOk) {
      wx.showToast({ title: '本圈玩家得分与台费合计需为 0', icon: 'none' });
      return;
    }
    const round = this.data.editingRound;
    const subs = [];
    this.data.scoreRows.forEach(function (r) {
      const v = Number(r.value) || 0;
      if (v !== 0) subs.push({ openid: r.openid, delta: r.sign * v });
    });
    if (subs.length === 0) {
      wx.showToast({ title: '请先输入分数', icon: 'none' });
      return;
    }
    const fee = Number(this.data.tableFeeInput) || 0;
    const that = this;
    const tasks = subs.map(function (s) {
      return api.submitRoomScore(that.data.roomId, round, s.delta, '', s.openid);
    });
    if (fee > 0) tasks.push(api.submitRoomFee(that.data.roomId, round, fee));
    wx.showLoading({ title: '保存中...' });
    Promise.all(tasks).then(function () {
      wx.hideLoading();
      const next = round + 1;
      const nextRows = that.data.scoreRows.map(function (r) { return Object.assign({}, r, { value: '', auto: false, touched: false }); });
      that.setData({ editingRound: next, scoreRows: nextRows });
      that.pollState();
      wx.showToast({ title: '第' + round + '圈已记录', icon: 'success' });
    }).catch(function (err) {
      wx.hideLoading();
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
    });
  },

  // 房主手动加人：弹出输入框自定义名字（上限 20）
  addPlayer() {
    if (this.data.players.length >= MAX_PLAYERS) {
      wx.showToast({ title: '最多 ' + MAX_PLAYERS + ' 人', icon: 'none' });
      return;
    }
    const that = this;
    wx.showModal({
      title: '添加玩家',
      editable: true,
      placeholderText: '输入玩家名字（留空随机）',
      success: function (res) {
        if (!res.confirm) return;
        const openid = 'test_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
        const profile = defaultProfiles.pickProfile(openid);
        const name = (res.content || '').trim();
        const nickname = name || profile.nickName;
        api.joinRoom({
          roomId: that.data.roomId,
          openid: openid,
          nickname: nickname,
          avatarUrl: profile.avatarUrl
        }).then(function (r) {
          api.saveRoomToken(r.roomId, openid, r.accessToken);
          that.pollState();
        }).catch(function (err) {
          wx.showToast({ title: (err && err.message) || '添加失败', icon: 'none' });
        });
      }
    });
  },

  startGame() {
    if (this.data.players.length < MIN_PLAYERS) {
      wx.showToast({ title: '至少需要 ' + MIN_PLAYERS + ' 名玩家', icon: 'none' });
      return;
    }
    const that = this;
    wx.showModal({
      title: '开始计分',
      content: '开始后所有人都可以记录分数',
      success: function (res) {
        if (!res.confirm) return;
        api.startRoom(that.data.roomId).then(function () {
          that.pollState();
        }).catch(function (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
        });
      }
    });
  },

  finishGame() {
    const that = this;
    wx.showModal({
      title: '结束游戏',
      content: '结束后将公布最终战绩，且不可再计分',
      success: function (res) {
        if (!res.confirm) return;
        api.finishRoom(that.data.roomId).then(function () {
          that.setData({ _navigated: true });
          that.stopPolling();
          wx.redirectTo({ url: '/pages/room-result/index?roomId=' + that.data.roomId });
        }).catch(function (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
        });
      }
    });
  },

  leave() {
    const that = this;
    const discard = this.data.status === STATUS_WAITING && this.data.isHost;
    wx.showModal({
      title: '离开房间',
      content: discard ? '该房间尚未开始计分，离开后将直接废弃，确定吗？' : '确定要离开该房间吗？',
      success: function (res) {
        if (!res.confirm) return;
        api.leaveRoom(that.data.roomId).then(function () {
          wx.switchTab({ url: '/pages/rules/index' });
        }).catch(function (err) {
          wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
        });
      }
    });
  },

  toggleInvite() {
    if (!this.data.inviteVisible && !this.data.qrcode && !this.data.qrcodeLoading) {
      this.loadQrcode();
    }
    this.setData({ inviteVisible: !this.data.inviteVisible });
  },

  loadQrcode() {
    const that = this;
    this.setData({ qrcodeLoading: true });
    api.getRoomQrcode(this.data.roomId).then(function (res) {
      that.setData({ qrcode: res.imageBase64, qrcodeLoading: false });
    }).catch(function () {
      that.setData({ qrcodeLoading: false });
    });
  },

  copyRoomId() {
    wx.setClipboardData({ data: this.data.roomId });
  },

  onShareAppMessage() {
    const roomId = this.data.roomId;
    return share.appMessage({
      title: '麻将开局啦，房间号 ' + roomId + '，快来加入！',
      path: '/pages/room-join/index?roomId=' + roomId
    });
  }
});
