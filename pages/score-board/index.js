const { getCurrentGame, saveCurrentGame, addHistory, clearCurrentGame, genClientId, mergeServerRecords } = require('../../utils/storage');
const api = require('../../utils/api');
const share = require('../../utils/share');
const playerAvatars = require('../../utils/player-avatars');

Page({
  data: {
    game: null,
    activeIndex: 0,
    customDelta: '',
    customSign: 1,
    roundList: [],
    avatars: playerAvatars,
    plusDeltas: [1, 2, 3, 4, 5, 8, 10, 20],
    minusDeltas: [-1, -2, -3, -4, -5, -8, -10, -20],
    tableFeePlusDeltas: [1, 2, 3, 4, 5, 10],
    tableFeeMinusDeltas: [-1, -2, -3, -4, -5, -10],
    undoStack: []
  },
  onShow() {
    share.enableShareMenu();

    const game = getCurrentGame();
    if (!game) return wx.navigateBack();
    if (!game.currentRound) game.currentRound = 1;
    if (!game.tableFee) game.tableFee = { enabled: false, score: 0, records: [] };
    game.tableFee = {
      enabled: Boolean(game.tableFee.enabled),
      score: Number(game.tableFee.score) || 0,
      records: Array.isArray(game.tableFee.records) ? game.tableFee.records : []
    };
    this.refreshView(game);
  },
  refreshView(game) {
    const map = {};
    (game.rounds || []).forEach((r) => {
      if (!map[r.round]) map[r.round] = [];
      map[r.round].push(r);
    });
    const roundList = Object.keys(map).map((round) => ({ round: Number(round), scores: map[round] })).sort((a, b) => b.round - a.round);
    this.setData({ game, roundList });
  },
  selectPlayer(e) { this.setData({ activeIndex: Number(e.currentTarget.dataset.index) }); },
  onCustomInput(e) {
    const value = String(e.detail.value || '').replace(/\D/g, '');
    this.setData({ customDelta: value });
  },
  switchCustomSign(e) {
    const sign = Number(e.currentTarget.dataset.sign) === -1 ? -1 : 1;
    this.setData({ customSign: sign });
  },
  applyDelta(e) { this.applyScore(Number(e.currentTarget.dataset.delta)); },
  applyTableFeeDelta(e) { this.applyTableFeeScore(Number(e.currentTarget.dataset.delta)); },
  applyCustom() {
    const raw = String(this.data.customDelta || '').trim();
    if (!/^\d+$/.test(raw) || Number(raw) === 0) {
      wx.showToast({ title: '请输入有效分值', icon: 'none' });
      return;
    }
    this.applyScore(Number(raw) * this.data.customSign);
  },
  applyScore(delta) {
    if (!delta) return;
    const game = this.data.game;
    const p = game.players[this.data.activeIndex];
    p.score += delta;
    game.rounds.push({ playerId: p.id, playerName: p.name, playerAvatar: p.avatarUrl, delta, round: game.currentRound, at: Date.now() });
    // 撤销栈：记录操作类型、玩家index、分值
    const undoStack = this.data.undoStack;
    undoStack.push({ type: 'player', index: this.data.activeIndex, delta, round: game.currentRound });
    if (undoStack.length > 30) undoStack.shift();
    saveCurrentGame(game);
    this.setData({ customDelta: '', undoStack });
    this.refreshView(game);
    wx.vibrateShort({ type: 'medium' });
    wx.showToast({
      title: delta > 0 ? '加分成功' : '减分成功',
      icon: 'success',
      duration: 900
    });
  },
  applyTableFeeScore(delta) {
    if (!delta) return;
    const game = this.data.game;
    if (!game.tableFee || !game.tableFee.enabled) return;
    game.tableFee.score = (Number(game.tableFee.score) || 0) + delta;
    if (!Array.isArray(game.tableFee.records)) game.tableFee.records = [];
    game.tableFee.records.push({ delta, round: game.currentRound, at: Date.now() });
    const undoStack = this.data.undoStack;
    undoStack.push({ type: 'tableFee', delta, round: game.currentRound });
    if (undoStack.length > 30) undoStack.shift();
    saveCurrentGame(game);
    this.setData({ undoStack });
    this.refreshView(game);
    wx.vibrateShort({ type: 'medium' });
    wx.showToast({
      title: delta > 0 ? '台费加分成功' : '台费减分成功',
      icon: 'success',
      duration: 900
    });
  },
  nextRound() {
    const game = this.data.game;
    const curRound = game.currentRound;
    const hasPlayerScore = (game.rounds || []).some((r) => r.round === curRound);
    const hasTableFee = game.tableFee && Array.isArray(game.tableFee.records)
      ? game.tableFee.records.some((r) => r.round === curRound)
      : false;
    if (!hasPlayerScore && !hasTableFee) {
      wx.showToast({ title: '本回合还没有计分', icon: 'none' });
      return;
    }
    game.currentRound += 1;
    saveCurrentGame(game);
    this.refreshView(game);
    wx.vibrateShort({ type: 'heavy' });
    wx.showToast({ title: `进入第${game.currentRound}回合`, icon: 'none' });
  },
  undoLast() {
    const undoStack = this.data.undoStack;
    if (!undoStack.length) {
      wx.showToast({ title: '没有可撤销的操作', icon: 'none' });
      return;
    }
    const game = this.data.game;
    const action = undoStack.pop();
    if (action.type === 'player') {
      const p = game.players[action.index];
      p.score -= action.delta;
      // 移除对应的 rounds 记录（从后往前找最近的匹配）
      for (let i = game.rounds.length - 1; i >= 0; i--) {
        const r = game.rounds[i];
        if (r.playerId === p.id && r.delta === action.delta && r.round === action.round) {
          game.rounds.splice(i, 1);
          break;
        }
      }
    } else if (action.type === 'tableFee') {
      game.tableFee.score = (Number(game.tableFee.score) || 0) - action.delta;
      // 移除对应的台费记录
      const records = game.tableFee.records;
      for (let i = records.length - 1; i >= 0; i--) {
        if (records[i].delta === action.delta && records[i].round === action.round) {
          records.splice(i, 1);
          break;
        }
      }
    }
    saveCurrentGame(game);
    this.setData({ undoStack });
    this.refreshView(game);
    wx.vibrateShort({ type: 'medium' });
    wx.showToast({ title: '已撤销', icon: 'success', duration: 900 });
  },
  resetGame() {
    wx.showModal({
      title: '确认重置',
      content: '重置后将清空当前所有回合记录，确定继续吗？',
      confirmColor: '#d4a900',
      success: (res) => {
        if (!res.confirm) return;
        const game = this.data.game;
        game.players = game.players.map((p) => ({ ...p, score: 0 }));
        game.rounds = [];
        if (game.tableFee) {
          game.tableFee.score = 0;
          game.tableFee.records = [];
        }
        game.currentRound = 1;
        saveCurrentGame(game);
        this.setData({ activeIndex: 0, customDelta: '', undoStack: [] });
        this.refreshView(game);
        wx.vibrateShort({ type: 'heavy' });
      }
    });
  },
  endGame() {
    const game = this.data.game;
    const ranking = game.players.slice().sort((a, b) => b.score - a.score);
    const record = {
      id: genClientId(),
      finishedAt: Date.now(),
      players: game.players,
      ranking,
      rounds: game.rounds,
      totalRounds: game.currentRound,
      tableFee: game.tableFee || { enabled: false, score: 0, records: [] }
    };
    // 本地先写（即时 UI + 冗余兜底），再异步同步服务器
    addHistory(record);
    clearCurrentGame();
    this.syncRecord(record);
    wx.navigateTo({ url: `/pages/result/index?id=${record.id}` });
  },
  syncRecord(record) {
    const openid = api.getOpenid();
    if (!openid) return;
    api.syncScoreRecords(openid, [record])
      .then((serverList) => {
        if (Array.isArray(serverList)) mergeServerRecords(serverList);
      })
      .catch((err) => {
        // 同步失败不影响本地展示（本地已留存），仅打印告警
        console.warn('[score-board] 计分记录同步服务器失败:', err);
      });
  },
  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：正在记录这一局得分'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：正在记录这一局得分'
    });
  }
});
