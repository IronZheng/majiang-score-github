const { getHistory } = require('../../utils/storage');

Page({
  data: { userInfo: null, history: [] },
  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });

    const history = getHistory().map((item) => ({ ...item, finishedAtText: new Date(item.finishedAt).toLocaleString() }));
    this.setData({ history, userInfo: wx.getStorageSync('mj_user') || null });
  },
  openRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/result/index?id=${id}` });
  },
  login() {
    wx.getUserProfile({
      desc: '用于展示头像昵称',
      success: (res) => {
        wx.setStorageSync('mj_user', res.userInfo);
        this.setData({ userInfo: res.userInfo });
      }
    });
  }
});
