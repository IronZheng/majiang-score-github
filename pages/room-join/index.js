const api = require('../../utils/api');
const share = require('../../utils/share');

Page({
  data: {
    roomId: '',
    nickname: '',
    avatarUrl: '',
    initial: '?',
    error: '',
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
    this.setData({
      roomId: roomId,
      nickname: user.nickName || user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      initial: ((user.nickName || user.nickname || '?').charAt(0))
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/rules/index' });
  },

  join() {
    if (this.data.joining || this.data.joined) return;
    const openid = api.getOpenid();
    if (!openid) {
      wx.showToast({ title: '正在获取登录信息，请稍后重试', icon: 'none' });
      return;
    }
    // 直接进入：昵称/头像可选，缺省时给默认身份
    const nickname = (this.data.nickname || '').trim() || '牌友';
    const avatarUrl = this.data.avatarUrl || '';
    // 记住资料，方便下次
    const app = getApp();
    const user = app.globalData.userInfo || {};
    user.nickname = nickname;
    user.avatarUrl = avatarUrl;
    app.globalData.userInfo = user;
    try {
      const cached = wx.getStorageSync('mj_user') || {};
      cached.nickname = nickname;
      cached.avatarUrl = avatarUrl;
      cached.openid = cached.openid || openid;
      wx.setStorageSync('mj_user', cached);
    } catch (e) {}

    const that = this;
    this.setData({ joining: true });
    api.joinRoom({
      roomId: that.data.roomId,
      openid: openid,
      nickname: nickname,
      avatarUrl: avatarUrl
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
