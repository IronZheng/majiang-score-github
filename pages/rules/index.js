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

    // 立即用当前（默认/缓存）资料渲染，保证进入页面不白屏
    this.renderIdentity();
    // 第一步拿 openid -> 读服务端资料；数据回来后再次渲染，确保头像/昵称实时同步
    const app = getApp();
    if (app && app.ensureProfile) {
      app.ensureProfile().then(() => {
        this.renderIdentity();
      });
    }
    this.loadProgressRooms();
  },

  // 统一渲染顶部身份条：优先用「我的」页实时写入 globalData 的资料，回退本地缓存
  renderIdentity() {
    const app = getApp();
    const live = (app && app.globalData && app.globalData.userInfo) || null;
    const cached = userUtil.ensureUser();
    const src = (live && (live.avatarCustomized || live.nickNameCustomized)) ? live : cached;
    // 昵称字段统一为 nickName
    const nickname = src.nickName || src.nickname || '';
    this.setData({
      nickname: nickname,
      avatarUrl: src.avatarUrl || '',
      avatarInitial: (nickname || '?').charAt(0),
      showAddMyGuide: !wx.getStorageSync(ADD_MY_GUIDE_DISMISSED_KEY)
    });
  },

  // 拉取进行中的房间，直接列表展示
  loadProgressRooms() {
    const openid = api.getOpenid();
    if (!openid) {
      // openid 可能仍在静默获取中（清缓存后首次进入尤为常见）：
      // 等其就绪后再加载，避免进入页面时列表空白、且之后不再刷新
      const app = getApp();
      if (app && app.ensureOpenid) {
        this.setData({ loading: true });
        app.ensureOpenid().then((id) => {
          if (id) this.loadProgressRooms();
          else this.setData({ progressList: [], loading: false });
        });
      } else {
        this.setData({ progressList: [], loading: false });
      }
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
    const that = this;
    const openid = api.getOpenid();
    if (!openid) {
      // openid 可能还在静默获取中：等待其就绪后再创建，避免直接报「请先授权」
      wx.showLoading({ title: '准备中...' });
      getApp().ensureOpenid().then(function (id) {
        wx.hideLoading();
        if (!id) {
          wx.showToast({ title: '请先授权后重试', icon: 'none' });
          return;
        }
        that._doCreateRoom(id);
      });
      return;
    }
    this._doCreateRoom(openid);
  },

  _doCreateRoom(openid) {
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

  // 顶部身份条：点击跳转到「我的」页（设置头像/昵称）
  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
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
