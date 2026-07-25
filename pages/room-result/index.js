const api = require('../../utils/api');
const share = require('../../utils/share');

const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function cnRound(n) {
  if (n >= 1 && n <= 10) return CN_NUM[n];
  return String(n);
}

Page({
  data: {
    roomId: '',
    title: '',
    ranking: [],
    bestName: '',
    bestScore: 0,
    tableFeeEnabled: false,
    tableFeeScore: 0,
    players: [],
    matrixRows: [],
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

      // 每回合详情矩阵：列=玩家（座位序），行=每一回合
      const players = (state.players || []).map(function (p) {
        return {
          openid: p.openid,
          nickname: p.nickname,
          avatarUrl: p.avatarUrl,
          initial: (p.nickname || '?').charAt(0),
          isHost: p.isHost,
          isSelf: p.openid === api.getOpenid()
        };
      });
      const rawEvents = (state.events && state.events.length) ? state.events : (state.feed || []);
      const scoreEvents = rawEvents.filter(function (e) { return e.openid !== '__FEE__'; });
      let maxRound = 0;
      scoreEvents.forEach(function (e) { if (e.round > maxRound) maxRound = e.round; });
      const deltaMap = {};
      scoreEvents.forEach(function (e) {
        if (!deltaMap[e.openid]) deltaMap[e.openid] = {};
        deltaMap[e.openid][e.round] = (deltaMap[e.openid][e.round] || 0) + e.delta;
      });
      // 每回合台费（独立计项，不计入玩家总分）
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
        matrixRows.push({
          roundLabel: '第' + cnRound(r) + '回',
          cells: cells,
          feeCell: {
            delta: f,
            deltaText: (f > 0 ? '+' : '') + f,
            positive: f > 0,
            negative: f < 0,
            zero: f === 0
          }
        });
      }

      // 累计行：每个玩家所有回合 delta 之和 + 总台费
      const totalCells = players.map(function (p) {
        const dm = deltaMap[p.openid] || {};
        let total = 0;
        for (let r = 1; r <= maxRound; r++) {
          total += (dm[r] !== undefined) ? dm[r] : 0;
        }
        return {
          delta: total,
          deltaText: (total > 0 ? '+' : '') + total,
          positive: total > 0,
          negative: total < 0,
          zero: total === 0
        };
      });
      let totalFee = 0;
      for (let r = 1; r <= maxRound; r++) totalFee += (feeByRound[r] || 0);
      matrixRows.push({
        roundLabel: '累计',
        isTotal: true,
        cells: totalCells,
        feeCell: {
          delta: totalFee,
          deltaText: (totalFee > 0 ? '+' : '') + totalFee,
          positive: totalFee > 0,
          negative: totalFee < 0,
          zero: totalFee === 0
        }
      });

      that.setData({
        title: state.title,
        ranking: ranking,
        bestName: winner ? winner.nickname : '',
        bestScore: winner ? winner.totalScore : 0,
        tableFeeEnabled: state.tableFeeEnabled,
        tableFeeScore: state.tableFeeScore,
        players: players,
        matrixRows: matrixRows
      });
    }).catch(function (err) {
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    });
  },

  backHome() {
    wx.switchTab({ url: '/pages/rules/index' });
  },

  onShareAppMessage() {
    const roomId = this.data.roomId;
    const name = this.data.bestName || '有人';
    return share.appMessage({
      title: '麻将战报：' + name + ' 赢得本局！房间 ' + roomId,
      path: '/pages/room-result/index?roomId=' + roomId
    });
  }
});
