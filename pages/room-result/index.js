const api = require('../../utils/api');
const share = require('../../utils/share');

Page({
  data: {
    roomId: '',
    title: '',
    ranking: [],
    bestName: '',
    bestScore: 0,
    tableFeeEnabled: false,
    tableFeeScore: 0,
    error: ''
  },

  onLoad(query) {
    share.enableShareMenu();
    if (!query.roomId) {
      this.setData({ error: '房间号缺失' });
      return;
    }
    this.setData({ roomId: query.roomId });
    this.loadResult();
  },

  loadResult() {
    const that = this;
    api.getRoomState(this.data.roomId).then(function (state) {
      const list = state.ranking || [];
      const top = list.length ? list[0].totalScore : 0;
      const ranking = list.map(function (p, i) {
        return {
          openid: p.openid,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          totalScore: p.totalScore,
          isHost: p.isHost,
          initial: (p.nickname || '?').charAt(0),
          isSelf: p.openid === api.getOpenid(),
          diff: top - p.totalScore,
          medal: i < 3 ? ('medal-' + (i + 1)) : ''
        };
      });
      const winner = ranking.length ? ranking[0] : null;
      that.setData({
        title: state.title,
        ranking: ranking,
        bestName: winner ? winner.nickname : '',
        bestScore: winner ? winner.totalScore : 0,
        tableFeeEnabled: state.tableFeeEnabled,
        tableFeeScore: state.tableFeeScore
      });
    }).catch(function (err) {
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    });
  },

  backHome() {
    wx.reLaunch({ url: '/pages/scoring-setup/index' });
  },

  onShareAppMessage() {
    const roomId = this.data.roomId;
    const name = this.data.bestName || '有人';
    return share.appMessage({
      title: '麻将战报：' + name + ' 赢得本局！房间 ' + roomId,
      path: '/pages/room-join/index?roomId=' + roomId
    });
  }
});
