const { saveCurrentGame } = require('../../utils/storage');
const share = require('../../utils/share');
const api = require('../../utils/api');
const playerAvatars = require('../../utils/player-avatars');
const defaultProfiles = require('../../utils/default-profiles');

const ADD_MY_GUIDE_DISMISSED_KEY = 'mj_add_my_guide_dismissed_v1';

function createPlayer(index, seed) {
  const profile = defaultProfiles.createPlayerProfile(seed, index);
  return {
    id: `${Date.now()}_${index}`,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    defaultProfileKey: profile.defaultProfileKey,
    score: 0
  };
}

function createPlayers(count, seed) {
  return Array.from({ length: count }).map((_, i) => createPlayer(i, seed));
}

Page({
  onShow() {
    share.enableShareMenu();

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });

    this.setData({
      showAddMyGuide: !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY)
    });
  },
  data: {
    showAddMyGuide: false,
    presetCounts: [2, 3, 4],
    playerCount: 4,
    setupSeed: defaultProfiles.getLocalProfileSeed(),
    players: createPlayers(4, defaultProfiles.getLocalProfileSeed()),
    avatars: playerAvatars,
    tableFeeEnabled: false
  },
  dismissAddMyGuide() {
    wx.setStorageSync(ADD_MY_GUIDE_DISMISSED_KEY, true);
    this.setData({ showAddMyGuide: false });
  },
  syncPlayers(count) {
    const players = this.data.players.slice(0, count);
    while (players.length < count) players.push(createPlayer(players.length, this.data.setupSeed));
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
  clearName(e) {
    const index = Number(e.currentTarget.dataset.index);
    const players = this.data.players.slice();
    players[index].name = '';
    this.setData({ players });
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
    players[index].name = name || defaultProfiles.createPlayerProfile(this.data.setupSeed, Number(index)).name;
    this.setData({ players });
  },
  onTableFeeChange(e) {
    this.setData({ tableFeeEnabled: (e.detail.value || []).includes('enabled') });
  },
  startGame() {
    const players = this.data.players.map((p, i) => {
      const profile = defaultProfiles.createPlayerProfile(this.data.setupSeed, i);
      return {
        ...p,
        name: (p.name || '').trim() || profile.name,
        avatarUrl: p.avatarUrl || profile.avatarUrl || playerAvatars[i % playerAvatars.length],
        score: 0
      };
    });
    saveCurrentGame({
      players,
      rounds: [],
      currentRound: 1,
      createdAt: Date.now(),
      tableFee: {
        enabled: Boolean(this.data.tableFeeEnabled),
        score: 0,
        records: []
      }
    });
    wx.navigateTo({ url: '/pages/score-board/index' });
  },
  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：开局就能记分'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：开局就能记分'
    });
  }
});
