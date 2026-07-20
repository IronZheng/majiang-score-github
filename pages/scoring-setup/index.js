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
    // 多人（房间）配置 —— 原 room-create 逻辑整合到本页
    title: '',
    capacity: 4,
    capacityOptions: [2, 3, 4, 5, 6, 7, 8],
    tableFeeEnabled: false,
    tableFeeScore: 0,
    creating: false,
    roomId: '',
    inviteVisible: false,
    qrcode: '',
    qrcodeLoading: false
  },

  dismissAddMyGuide() {
    wx.setStorageSync(ADD_MY_GUIDE_DISMISSED_KEY, true);
    this.setData({ showAddMyGuide: false });
  },

  // ===================== 多人记账：房间配置 =====================
  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },
  setCapacity(e) {
    this.setData({ capacity: Number(e.currentTarget.dataset.cap) });
  },
  onFeeChange(e) {
    this.setData({ tableFeeEnabled: (e.detail.value || []).includes('enabled') });
  },
  onFeeScoreInput(e) {
    const v = Number(e.detail.value);
    this.setData({ tableFeeScore: isNaN(v) ? 0 : v });
  },

  // 创建多人房间（原 room-create 的 create 逻辑）
  createRoom() {
    if (this.data.creating) return;
    const openid = api.getOpenid();
    if (!openid) {
      wx.showToast({ title: '请先登录后再创建房间', icon: 'none' });
      setTimeout(() => wx.navigateTo({ url: '/pages/login/index' }), 800);
      return;
    }
    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    const that = this;
    this.setData({ creating: true });
    api.createRoom({
      openid: openid,
      nickname: user.nickname || '房主',
      avatarUrl: user.avatarUrl || '',
      title: (that.data.title || '').trim(),
      tableFeeEnabled: that.data.tableFeeEnabled ? 1 : 0,
      tableFeeScore: that.data.tableFeeScore,
      playerCapacity: that.data.capacity
    }).then(function (res) {
      api.saveRoomToken(res.roomId, openid, res.accessToken);
      that.setData({ roomId: res.roomId, creating: false, inviteVisible: true });
      that.loadQrcode(res.roomId);
    }).catch(function (err) {
      that.setData({ creating: false });
      wx.showToast({ title: (err && err.message) || '创建失败', icon: 'none' });
    });
  },

  loadQrcode(roomId) {
    const that = this;
    this.setData({ qrcodeLoading: true });
    api.getRoomQrcode(roomId).then(function (res) {
      that.setData({ qrcode: res.imageBase64, qrcodeLoading: false });
    }).catch(function () {
      that.setData({ qrcodeLoading: false });
    });
  },

  toggleInvite() {
    this.setData({ inviteVisible: !this.data.inviteVisible });
  },
  enterBoard() {
    wx.redirectTo({ url: '/pages/room-board/index?roomId=' + this.data.roomId });
  },
  copyRoomId() {
    wx.setClipboardData({ data: this.data.roomId });
  },

  // ===================== 单人记账：逻辑不变，走本地计分 =====================
  startSingle() {
    const seed = defaultProfiles.getLocalProfileSeed();
    const players = createPlayers(this.data.capacity, seed).map((p, i) => {
      const profile = defaultProfiles.createPlayerProfile(seed, i);
      return {
        ...p,
        name: profile.name,
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
    const roomId = this.data.roomId;
    if (roomId) {
      return share.appMessage({
        title: '麻将开局啦，房间号 ' + roomId + '，快来加入！',
        path: '/pages/room-join/index?roomId=' + roomId
      });
    }
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
