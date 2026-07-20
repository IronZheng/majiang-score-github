const api = require('../../utils/api');
const share = require('../../utils/share');

const STATUS_WAITING = 0;
const STATUS_PLAYING = 1;
const STATUS_FINISHED = 2;
const POLL_INTERVAL = 2500;

function formatTime(at) {
  if (!at) return '';
  const d = new Date(at);
  const hh = ('0' + d.getHours()).slice(-2);
  const mm = ('0' + d.getMinutes()).slice(-2);
  return hh + ':' + mm;
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
    players: [],
    ranking: [],
    feed: [],
    selectedTarget: '',
    selectedNickname: '',
    scoreInput: '',
    scoringRound: 1,
    displaySum: 0,
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
    this.setData({ roomId: query.roomId, openid: openid, selectedTarget: openid });
    this.loadQrcode();
  },

  onShow() {
    if (this.data.roomId) this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
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
      const players = (state.players || []).map(function (p) {
        return {
          openid: p.openid,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          totalScore: p.totalScore,
          isHost: p.isHost,
          initial: (p.nickname || '?').charAt(0),
          isSelf: p.openid === selfOpenid
        };
      });
      const ranking = players.slice().sort(function (a, b) {
        return b.totalScore - a.totalScore;
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

      // 当前圈：本地 scoringRound 跟随后端最新圈号，但不回退
      let scoringRound = that.data.scoringRound;
      if (state.currentRound > scoringRound) scoringRound = state.currentRound;
      else if (scoringRound < 1) scoringRound = Math.max(1, state.currentRound);
      const advanced = scoringRound > state.currentRound; // 已本地开新圈
      const displaySum = advanced ? 0 : state.currentRoundSum;

      // 选中目标：默认自己；若已不在房间则选第一个成员
      let selectedTarget = that.data.selectedTarget;
      let stillIn = players.some(function (p) { return p.openid === selectedTarget; });
      if (!stillIn) {
        const selfIn = players.some(function (p) { return p.openid === selfOpenid; });
        selectedTarget = selfIn ? selfOpenid : (players.length ? players[0].openid : '');
      }
      let selectedNickname = '';
      players.forEach(function (p) { if (p.openid === selectedTarget) selectedNickname = p.nickname; });

      that.setData({
        status: status,
        statusText: statusText,
        title: state.title,
        tableFeeEnabled: state.tableFeeEnabled,
        tableFeeScore: state.tableFeeScore,
        players: players,
        ranking: ranking,
        feed: feed,
        isHost: state.hostOpenid === selfOpenid,
        scoringRound: scoringRound,
        displaySum: displaySum,
        sumOk: displaySum === 0,
        selectedTarget: selectedTarget,
        selectedNickname: selectedNickname
      });

      if (status === STATUS_FINISHED && !that.data._navigated) {
        that.setData({ _navigated: true });
        that.stopPolling();
        wx.redirectTo({ url: '/pages/room-result/index?roomId=' + that.data.roomId });
      }
    }).catch(function (err) {
      if (!that.data._navigated) {
        wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
      }
    });
  },

  selectTarget(e) {
    const openid = e.currentTarget.dataset.openid;
    let nickname = '';
    this.data.players.forEach(function (p) { if (p.openid === openid) nickname = p.nickname; });
    this.setData({ selectedTarget: openid, selectedNickname: nickname });
  },

  onScoreInput(e) {
    this.setData({ scoreInput: e.detail.value });
  },

  submit(delta) {
    const mag = Number(this.data.scoreInput);
    if (!mag || mag <= 0) {
      wx.showToast({ title: '请输入分数', icon: 'none' });
      return;
    }
    if (!this.data.selectedTarget) {
      wx.showToast({ title: '请选择计分玩家', icon: 'none' });
      return;
    }
    if (this.data.status !== STATUS_PLAYING) {
      wx.showToast({ title: '房间未开始计分', icon: 'none' });
      return;
    }
    const that = this;
    const round = this.data.scoringRound;
    const note = '';
    api.submitRoomScore(this.data.roomId, round, delta, note, this.data.selectedTarget).then(function () {
      that.setData({ scoreInput: '' });
      that.pollState();
    }).catch(function (err) {
      wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
    });
  },

  submitWin() {
    this.submit(Number(this.data.scoreInput));
  },

  submitLose() {
    const mag = Number(this.data.scoreInput);
    if (!mag || mag <= 0) {
      wx.showToast({ title: '请输入分数', icon: 'none' });
      return;
    }
    this.submit(-mag);
  },

  nextCircle() {
    if (this.data.status !== STATUS_PLAYING) {
      wx.showToast({ title: '房间未开始计分', icon: 'none' });
      return;
    }
    const that = this;
    const proceed = function () {
      const newRound = Math.max(that.data.scoringRound, that.data.status === STATUS_PLAYING ? that.data.scoringRound : 1) + 1;
      that.setData({ scoringRound: newRound, scoreInput: '', displaySum: 0, sumOk: true });
      wx.showToast({ title: '进入第' + newRound + '圈', icon: 'none' });
    };
    if (!that.data.sumOk) {
      wx.showModal({
        title: '本圈合计不为 0',
        content: '上一圈合计为 ' + that.data.displaySum + '（应为 0），确定开始下一圈？',
        success: function (res) { if (res.confirm) proceed(); }
      });
    } else {
      proceed();
    }
  },

  startGame() {
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
    wx.showModal({
      title: '离开房间',
      content: '确定要离开该房间吗？',
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
