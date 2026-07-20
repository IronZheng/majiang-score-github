const share = require('../../utils/share');
const api = require('../../utils/api');

const ADD_MY_GUIDE_DISMISSED_KEY = 'mj_add_my_guide_dismissed_v1';

Page({
  onShow() {
    share.enableShareMenu();
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });

    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    const needAuth = !user.avatarUrl || !user.nickname;
    this.setData({
      needAuth: needAuth,
      nickname: user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      showAddMyGuide: !needAuth && !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY)
    });
  },

  data: {
    needAuth: true,
    nickname: '',
    avatarUrl: '',
    showAddMyGuide: false,
    showCreate: false,
    createTitle: '',
    tableFeeEnabled: false,
    tableFeeScore: 0,
    creating: false
  },

  dismissAddMyGuide() {
    wx.setStorageSync(ADD_MY_GUIDE_DISMISSED_KEY, true);
    this.setData({ showAddMyGuide: false });
  },

  // ===================== 授权头像 + 昵称 =====================
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl || '';
    this.setData({ avatarUrl: avatarUrl });
  },
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },
  confirmAuth() {
    const nickname = (this.data.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    if (!this.data.avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' });
      return;
    }
    const app = getApp();
    const user = app.globalData.userInfo || {};
    user.nickname = nickname;
    user.avatarUrl = this.data.avatarUrl;
    app.globalData.userInfo = user;
    try {
      const cached = wx.getStorageSync('mj_user') || {};
      cached.nickname = nickname;
      cached.avatarUrl = this.data.avatarUrl;
      cached.openid = cached.openid || user.openid;
      wx.setStorageSync('mj_user', cached);
    } catch (e) {}
    this.setData({ needAuth: false, showAddMyGuide: !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY) });
  },

  // ===================== 三个入口 =====================
  openCreate() {
    this.setData({ showCreate: true, createTitle: '', tableFeeEnabled: false, tableFeeScore: 0 });
  },
  closeCreate() {
    this.setData({ showCreate: false });
  },
  onTitleInput(e) {
    this.setData({ createTitle: e.detail.value });
  },
  onFeeChange(e) {
    this.setData({ tableFeeEnabled: (e.detail.value || []).includes('enabled') });
  },
  onFeeScoreInput(e) {
    const v = Number(e.detail.value);
    this.setData({ tableFeeScore: isNaN(v) ? 0 : v });
  },
  createRoom() {
    if (this.data.creating) return;
    const openid = api.getOpenid();
    if (!openid) {
      wx.showToast({ title: '请先授权', icon: 'none' });
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
      title: (that.data.createTitle || '').trim(),
      tableFeeEnabled: that.data.tableFeeEnabled ? 1 : 0,
      tableFeeScore: that.data.tableFeeScore
    }).then(function (res) {
      api.saveRoomToken(res.roomId, openid, res.accessToken);
      that.setData({ creating: false, showCreate: false });
      wx.redirectTo({ url: '/pages/room-board/index?roomId=' + res.roomId });
    }).catch(function (err) {
      that.setData({ creating: false });
      wx.showToast({ title: (err && err.message) || '创建失败', icon: 'none' });
    });
  },

  goInProgress() {
    wx.navigateTo({ url: '/pages/room-list/index?tab=progress' });
  },
  goHistory() {
    wx.navigateTo({ url: '/pages/room-list/index?tab=history' });
  },

  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：多人记账，扫码一起计分'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：多人记账，扫码一起计分'
    });
  }
});
