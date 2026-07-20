const api = require('../../utils/api');
const share = require('../../utils/share');

const STATUS_WAITING = 0;
const STATUS_PLAYING = 1;
const STATUS_FINISHED = 2;

function statusText(s) {
  return s === STATUS_PLAYING ? '进行中' : (s === STATUS_FINISHED ? '已结束' : '待开始');
}

Page({
  onShow() {
    share.enableShareMenu();
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });
    this.loadRooms();
  },

  onLoad(query) {
    this.setData({ activeTab: (query && query.tab) === 'history' ? 'history' : 'progress' });
  },

  data: {
    activeTab: 'progress',
    loading: false,
    progressList: [],
    historyList: []
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  loadRooms() {
    const openid = api.getOpenid();
    if (!openid) {
      this.setData({ progressList: [], historyList: [] });
      return;
    }
    const that = this;
    this.setData({ loading: true });
    api.getMyRooms(openid).then(function (list) {
      const progress = [];
      const history = [];
      (list || []).forEach(function (r) {
        const item = {
          roomId: r.roomId,
          title: r.title || '麻将房',
          statusText: statusText(r.status),
          isHost: r.isHost,
          memberCount: r.memberCount,
          finished: r.status === STATUS_FINISHED
        };
        if (r.status === STATUS_FINISHED) history.push(item);
        else progress.push(item);
      });
      that.setData({ progressList: progress, historyList: history, loading: false });
    }).catch(function () {
      that.setData({ loading: false });
    });
  },

  openRoom(e) {
    const ds = e.currentTarget.dataset;
    const url = ds.finished
      ? '/pages/room-result/index?roomId=' + ds.roomId
      : '/pages/room-board/index?roomId=' + ds.roomId;
    wx.navigateTo({ url: url });
  },

  goBack() {
    wx.switchTab({ url: '/pages/rules/index' });
  },

  onShareAppMessage() {
    return share.appMessage({ title: '麻将计分器：多人记账' });
  }
});
