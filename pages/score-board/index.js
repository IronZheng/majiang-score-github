const { getCurrentGame, saveCurrentGame, addHistory, clearCurrentGame } = require('../../utils/storage');

Page({
  data: { game: null, activeIndex: 0, customDelta: '', avatars: ['😀', '😎', '🀄', '🐯', '🐼', '🦊', '🐬', '🦁'] },
  onShow() {
    const game = getCurrentGame();
    if (!game) return wx.navigateBack();
    if (!game.currentRound) game.currentRound = 1;
    this.setData({ game });
  },
  selectPlayer(e) { this.setData({ activeIndex: Number(e.currentTarget.dataset.index) }); },
  onCustomInput(e) { this.setData({ customDelta: e.detail.value }); },
  applyDelta(e) { this.applyScore(Number(e.currentTarget.dataset.delta)); },
  applyCustom() { this.applyScore(Number(this.data.customDelta || 0)); },
  applyScore(delta) {
    if (!delta) return;
    const game = this.data.game;
    const p = game.players[this.data.activeIndex];
    p.score += delta;
    game.rounds.push({ playerId: p.id, playerName: p.name, delta, round: game.currentRound, at: Date.now() });
    saveCurrentGame(game);
    this.setData({ game, customDelta: '' });
  },
  nextRound() {
    const game = this.data.game;
    game.currentRound += 1;
    saveCurrentGame(game);
    this.setData({ game });
    wx.showToast({ title: `进入第${game.currentRound}回合`, icon: 'none' });
  },
  endGame() {
    const game = this.data.game;
    const ranking = game.players.slice().sort((a, b) => b.score - a.score);
    const record = { id: `${Date.now()}`, finishedAt: Date.now(), players: game.players, ranking, rounds: game.rounds, totalRounds: game.currentRound };
    addHistory(record);
    clearCurrentGame();
    wx.navigateTo({ url: `/pages/result/index?id=${record.id}` });
  }
});
