const { getCurrentGame, saveCurrentGame, addHistory, clearCurrentGame } = require('../../utils/storage');
const share = require('../../utils/share');

Page({
  data: { game: null, activeIndex: 0, customDelta: '', roundList: [], avatars: ['😀', '😎', '🀄', '🐯', '🐼', '🦊', '🐬', '🦁'] },
  onShow() {
    share.enableShareMenu();

    const game = getCurrentGame();
    if (!game) return wx.navigateBack();
    if (!game.currentRound) game.currentRound = 1;
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
    const value = String(e.detail.value || '').replace(/[^\d-]/g, '');
    const normalized = value.startsWith('-')
      ? `-${value.slice(1).replace(/-/g, '')}`
      : value.replace(/-/g, '');
    this.setData({ customDelta: normalized });
  },
  applyDelta(e) { this.applyScore(Number(e.currentTarget.dataset.delta)); },
  applyCustom() {
    const raw = String(this.data.customDelta || '').trim();
    if (!/^-?\d+$/.test(raw)) {
      wx.showToast({ title: '请输入有效分值', icon: 'none' });
      return;
    }
    this.applyScore(Number(raw));
  },
  applyScore(delta) {
    if (!delta) return;
    const game = this.data.game;
    const p = game.players[this.data.activeIndex];
    p.score += delta;
    game.rounds.push({ playerId: p.id, playerName: p.name, delta, round: game.currentRound, at: Date.now() });
    saveCurrentGame(game);
    this.setData({ customDelta: '' });
    this.refreshView(game);
  },
  nextRound() {
    const game = this.data.game;
    game.currentRound += 1;
    saveCurrentGame(game);
    this.refreshView(game);
    wx.showToast({ title: `进入第${game.currentRound}回合`, icon: 'none' });
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
        game.currentRound = 1;
        saveCurrentGame(game);
        this.setData({ activeIndex: 0, customDelta: '' });
        this.refreshView(game);
      }
    });
  },
  endGame() {
    const game = this.data.game;
    const ranking = game.players.slice().sort((a, b) => b.score - a.score);
    const record = { id: `${Date.now()}`, finishedAt: Date.now(), players: game.players, ranking, rounds: game.rounds, totalRounds: game.currentRound };
    addHistory(record);
    clearCurrentGame();
    wx.navigateTo({ url: `/pages/result/index?id=${record.id}` });
  },
  onShareAppMessage() {
    return share.appMessage({
      title: '我正在用麻将计分器记分'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器，聚会计分更省心'
    });
  }
});
