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
    capacity: 4,
    tableFeeEnabled: false,
    tableFeeScore: 0,
    players: [],
    ranking: [],
    feed: [],
    selfOpenid: '',
    scoreInput: '',
    roundInput: '1',
    noteInput: '',
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
      const feed = (state.feed || []).map(function (f) {
        return {
          nickname: f.nickname,
          deltaText: (f.delta > 0 ? '+' : '') + f.delta,
          deltaPositive: f.delta >= 0,
          roundText: '第' + f.round + '手',
          timeText: formatTime(f.at)
        };
      });
      const ranking = (state.ranking || []).map(function (p) {
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
      that.setData({
        status: status,
        statusText: statusText,
        title: state.title,
        capacity: state.capacity,
        tableFeeEnabled: state.tableFeeEnabled,
        tableFeeScore: state.tableFeeScore,
        players: state.players || [],
        ranking: ranking,
        feed: feed,
        selfOpenid: selfOpenid,
        isHost: state.hostOpenid === selfOpenid
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

  onScoreInput(e) {
    this.setData({ scoreInput: e.detail.value });
  },

  onRoundInput(e) {
    this.setData({ roundInput: e.detail.value });
  },

  onNoteInput(e) {
    this.setData({ noteInput: e.detail.value });
  },

  submit(delta) {
    const mag = Number(this.data.scoreInput);
    if (!mag || mag <= 0) {
      wx.showToast({ title: '请输入本手分数', icon: 'none' });
      return;
    }
    const that = this;
    const round = Number(this.data.roundInput) || 1;
    const note = (this.data.noteInput || '').trim();
    api.submitRoomScore(this.data.roomId, round, delta, note).then(function () {
      that.setData({
        scoreInput: '',
        noteInput: '',
        roundInput: String(round + 1)
      });
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
      wx.showToast({ title: '请输入本手分数', icon: 'none' });
      return;
    }
    this.submit(-mag);
  },

  undo() {
    const that = this;
    api.undoRoomScore(this.data.roomId).then(function () {
      that.pollState();
    }).catch(function (err) {
      wx.showToast({ title: (err && err.message) || '撤销失败', icon: 'none' });
    });
  },

  startGame() {
    const that = this;
    wx.showModal({
      title: '开始游戏',
      content: '开始后即可记录每一手得分',
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
          wx.switchTab({ url: '/pages/scoring-setup/index' });
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
