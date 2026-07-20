const api = require('../../utils/api');
const share = require('../../utils/share');

Page({
  data: {
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

  onLoad() {
    share.enableShareMenu();
  },

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

  create() {
    if (this.data.creating) return;
    const openid = api.getOpenid();
    if (!openid) {
      wx.showToast({ title: '请先登录', icon: 'none' });
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

  onShareAppMessage() {
    const roomId = this.data.roomId;
    return share.appMessage({
      title: '麻将开局啦，房间号 ' + roomId + '，快来加入！',
      path: '/pages/room-join/index?roomId=' + roomId
    });
  }
});
