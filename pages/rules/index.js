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
    // 与「我的」页共用同一份资料：昵称字段为 nickName
    const nickname = user.nickName || user.nickname || '';
    this.setData({
      nickname: nickname,
      avatarUrl: user.avatarUrl || '',
      avatarInitial: (nickname || '?').charAt(0),
      showAddMyGuide: !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY)
    });
  },

  data: {
    nickname: '',
    avatarUrl: '',
    avatarInitial: '?',
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
    // 直接复用「我的」页同步过来的头像和昵称
    const nickname = (this.data.nickname || '').trim() || '房主';
    const avatarUrl = this.data.avatarUrl || '';
    const that = this;
    this.setData({ creating: true });
    api.createRoom({
      openid: openid,
      nickname: nickname,
      avatarUrl: avatarUrl,
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
