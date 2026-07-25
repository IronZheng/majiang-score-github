const share = require('../../utils/share');
const api = require('../../utils/api');
const userUtil = require('../../utils/user');

const ADD_MY_GUIDE_DISMISSED_KEY = 'mj_add_my_guide_dismissed_v1';

const STATUS_FINISHED = 2;

function statusText(s) {
  return s === 1 ? '进行中' : (s === STATUS_FINISHED ? '已结束' : '待开始');
}

// 房间日期文本：今天/昨天/MM-DD HH:mm
function roomDateText(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = function (n) { return (n < 10 ? '0' : '') + n; };
  const startOf = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const diffDay = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDay === 0) return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (diffDay === 1) return '昨天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  return (d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

Page({
  onShow() {
    share.enableShareMenu();
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 0 });

    // 与「我的」页共用同一份资料：优先读缓存，缺失则生成默认资料，无需先进入「我的」页
    const user = userUtil.ensureUser();
    // 昵称字段统一为 nickName
    const nickname = user.nickName || user.nickname || '';
    this.setData({
      nickname: nickname,
      avatarUrl: user.avatarUrl || '',
      avatarInitial: (nickname || '?').charAt(0),
      showAddMyGuide: !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY)
    });
    this.loadProgressRooms();
  },

  // 拉取进行中的房间，直接列表展示
  loadProgressRooms() {
    const openid = api.getOpenid();
    if (!openid) {
      this.setData({ progressList: [], loading: false });
      return;
    }
    const that = this;
    this.setData({ loading: true });
    api.getMyRooms(openid).then(function (list) {
      const progress = [];
      (list || []).forEach(function (r) {
        if (r.status !== 1) return; // 仅展示"进行中"，待开始/已结束均不列入（待开始退出即废弃）
        progress.push({
          roomId: r.roomId,
          title: r.title || '麻将房',
          statusText: statusText(r.status),
          isHost: r.isHost,
          memberCount: r.memberCount,
          dateText: roomDateText(r.createdAt)
        });
      });
      that.setData({ progressList: progress, loading: false });
    }).catch(function () {
      that.setData({ progressList: [], loading: false });
    });
  },

  data: {
    nickname: '',
    avatarUrl: '',
    avatarInitial: '?',
    showAddMyGuide: false,
    loading: false,
    progressList: [],
    showCreate: false,
    tableFeeEnabled: false,
    creating: false
  },

  dismissAddMyGuide() {
    wx.setStorageSync(ADD_MY_GUIDE_DISMISSED_KEY, true);
    this.setData({ showAddMyGuide: false });
  },

  // ===================== 三个入口 =====================
  openCreate() {
    this.setData({ showCreate: true, tableFeeEnabled: false });
  },
  closeCreate() {
    this.setData({ showCreate: false });
  },
  onFeeChange(e) {
    this.setData({ tableFeeEnabled: (e.detail.value || []).includes('enabled') });
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
      title: '',
      playerCapacity: 20,
      tableFeeEnabled: that.data.tableFeeEnabled ? 1 : 0,
      tableFeeScore: 0
    }).then(function (res) {
      api.saveRoomToken(res.roomId, openid, res.accessToken);
      that.setData({ creating: false, showCreate: false });
      wx.redirectTo({ url: '/pages/room-board/index?roomId=' + res.roomId });
    }).catch(function (err) {
      that.setData({ creating: false });
      wx.showToast({ title: (err && err.message) || '创建失败', icon: 'none' });
    });
  },

  openProgressRoom(e) {
    const roomId = e.currentTarget.dataset.roomId;
    if (!roomId) return;
    wx.navigateTo({
      url: '/pages/room-board/index?roomId=' + roomId,
      fail: function () {
        // navigateTo 失败（多为页面栈过深超过 10 层）时兜底：直接重定向进入，避免“点击无反应”
        wx.redirectTo({
          url: '/pages/room-board/index?roomId=' + roomId,
          fail: function (e2) {
            wx.showToast({
              title: '进入房间失败：' + ((e2 && e2.errMsg) || '未知错误'),
              icon: 'none'
            });
          }
        });
      }
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
