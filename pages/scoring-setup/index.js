const { saveCurrentGame } = require('../../utils/storage');

function createPlayers(count) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${Date.now()}_${i}`,
    name: `玩家${i + 1}`,
    score: 0,
    avatar: '/assets/avatar.png'
  }));
}

Page({
  data: {
    presetCounts: [2, 3, 4],
    playerCount: 4,
    players: createPlayers(4)
  },
  syncPlayers(count) {
    const players = this.data.players.slice(0, count);
    while (players.length < count) {
      players.push({
        id: `${Date.now()}_${players.length}`,
        name: `玩家${players.length + 1}`,
        score: 0,
        avatar: '/assets/avatar.png'
      });
    }
    this.setData({ playerCount: count, players });
  },
  setPresetCount(e) { this.syncPlayers(Number(e.currentTarget.dataset.count)); },
  increaseCount() { this.syncPlayers(this.data.playerCount + 1); },
  decreaseCount() { this.syncPlayers(Math.max(2, this.data.playerCount - 1)); },
  onNameChange(e) {
    const { index } = e.currentTarget.dataset;
    const players = this.data.players.slice();
    players[index].name = e.detail.value || `玩家${Number(index) + 1}`;
    this.setData({ players });
  },
  startGame() {
    const game = {
      players: this.data.players.map((p) => ({ ...p, score: 0 })),
      rounds: [],
      createdAt: Date.now()
    };
    saveCurrentGame(game);
    wx.navigateTo({ url: '/pages/score-board/index' });
  }
});
