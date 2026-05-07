const { saveCurrentGame } = require('../../utils/storage');

function createPlayers(count) {
  return Array.from({ length: count }).map((_, i) => ({ id: `${Date.now()}_${i}`, name: `玩家${i + 1}`, score: 0 }));
}

Page({
  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });
  },
  data: { presetCounts: [2, 3, 4], playerCount: 4, players: createPlayers(4), avatars: ['😀', '😎', '🀄', '🐯', '🐼', '🦊', '🐬', '🦁'] },
  syncPlayers(count) {
    const players = this.data.players.slice(0, count);
    while (players.length < count) players.push({ id: `${Date.now()}_${players.length}`, name: `玩家${players.length + 1}`, score: 0 });
    this.setData({ playerCount: players.length, players });
  },
  setPresetCount(e) { this.syncPlayers(Number(e.currentTarget.dataset.count)); },
  addPlayer() { this.syncPlayers(this.data.playerCount + 1); },
  removePlayer(e) {
    const index = Number(e.currentTarget.dataset.index);
    const players = this.data.players.slice();
    if (players.length <= 2) return wx.showToast({ title: '至少保留2名玩家', icon: 'none' });
    players.splice(index, 1);
    this.setData({ players, playerCount: players.length });
  },
  onNameChange(e) {
    const { index } = e.currentTarget.dataset;
    const players = this.data.players.slice();
    players[index].name = e.detail.value;
    this.setData({ players });
  },
  onNameBlur(e) {
    const { index } = e.currentTarget.dataset;
    const players = this.data.players.slice();
    const name = (players[index].name || '').trim();
    players[index].name = name || `玩家${Number(index) + 1}`;
    this.setData({ players });
  },
  startGame() {
    const players = this.data.players.map((p, i) => ({ ...p, name: (p.name || '').trim() || `玩家${i + 1}`, score: 0 }));
    saveCurrentGame({ players, rounds: [], currentRound: 1, createdAt: Date.now() });
    wx.navigateTo({ url: '/pages/score-board/index' });
  }
});
