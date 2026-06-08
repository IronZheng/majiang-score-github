const share = require('../../utils/share');
const rules = require('../../utils/rules-data.js');

Page({
  data: { rules },
  onShow() {
    share.enableShareMenu();

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });
  },
  openRule(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/rules-detail/index?id=${id}` });
  },
  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：玩法说明'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：玩法说明'
    });
  }
});
