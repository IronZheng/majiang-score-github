const api = require('../../utils/api');

Page({
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  goChallenge() {
    wx.navigateTo({ url: '/pages/challenge/index' });
  },

  goLeaderboard() {
    wx.navigateTo({ url: '/pages/leaderboard/index' });
  }
});
