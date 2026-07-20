const api = require('../../utils/api');
const share = require('../../utils/share');

Page({
  data: {
    roomId: '',
    nickname: '',
    error: '',
    needLogin: false,
    joining: false,
    joined: false
  },

  onLoad(query) {
    share.enableShareMenu();
    let roomId = query.roomId;
    if (!roomId && query.scene) {
      // 扫码进入：scene 为编码后的 "roomId=XXX"
      const decoded = decodeURIComponent(query.scene);
      const m = decoded.match(/roomId=([^&]+)/);
      if (m) roomId = m[1];
    }
    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    if (!roomId) {
      this.setData({ error: '房间号缺失，请从分享链接或扫码进入' });
      return;
    }
    this.setData({ roomId: roomId, nickname: user.nickname || '' });
    this.tryJoinIfReady();
  },

  onShow() {
    // 登录返回后重试
    if (!this.data.joined && this.data.roomId) {
      this.tryJoinIfReady();
    }
  },

  tryJoinIfReady() {
    if (this.data.joined) return;
    const openid = api.getOpenid();
    if (!openid) {
      this.setData({ needLogin: true });
      return;
    }
    this.setData({ needLogin: false });
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/scoring-setup/index' });
  },

  join() {
    if (this.data.joining || this.data.joined) return;
    const openid = api.getOpenid();
    if (!openid) {
      this.setData({ needLogin: true });
      return;
    }
    const app = getApp();
    const user = (app && app.globalData && app.globalData.userInfo) || {};
    const nickname = (this.data.nickname || '').trim() || '玩家';
    const that = this;
    this.setData({ joining: true });
    api.joinRoom({
      roomId: that.data.roomId,
      openid: openid,
      nickname: nickname,
      avatarUrl: user.avatarUrl || ''
    }).then(function (res) {
      api.saveRoomToken(res.roomId, openid, res.accessToken);
      that.setData({ joined: true, joining: false });
      wx.redirectTo({ url: '/pages/room-board/index?roomId=' + res.roomId });
    }).catch(function (err) {
      that.setData({ joining: false });
      wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' });
    });
  },

  onShareAppMessage() {
    const roomId = this.data.roomId;
    return share.appMessage({
      title: '麻将计分器：朋友聚会记分工具',
      path: '/pages/room-join/index?roomId=' + roomId
    });
  }
});
