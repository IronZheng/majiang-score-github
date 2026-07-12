const api = require('../../utils/api');

Page({
  data: {
    loading: true,
    top: [],
    me: null,
    myRank: null,
    meInTop: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load();
    var that = this;
    setTimeout(function () { wx.stopPullDownRefresh(); }, 300);
  },

  load() {
    var that = this;
    this.setData({ loading: true });
    api.getLeaderboard().then(function (res) {
      var top = (res.top || []).map(function (it) {
        return Object.assign({}, it, { initial: (it.nickname || '玩').charAt(0) });
      });
      var me = res.me
        ? Object.assign({}, res.me, { initial: (res.me.nickname || '玩').charAt(0) })
        : null;
      // 若“我”已出现在榜单前50，则不另显示独立“我的”卡片，避免重复
      var meInTop = !!(me && top.some(function (t) { return t.openid === me.openid; }));
      that.setData({
        loading: false,
        top: top,
        me: me,
        myRank: res.myRank || null,
        meInTop: meInTop
      });
    }).catch(function (err) {
      that.setData({ loading: false });
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    });
  },

  refresh() {
    this.load();
  },

  goChallenge() {
    wx.navigateTo({ url: '/pages/challenge/index' });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
