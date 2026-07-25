const api = require('../../utils/api');
const share = require('../../utils/share');

const STATUS_WAITING = 0;
const STATUS_PLAYING = 1;
const STATUS_FINISHED = 2;

function statusText(s) {
  return s === STATUS_PLAYING ? '进行中' : (s === STATUS_FINISHED ? '已结束' : '待开始');
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
    const MIN_SPIN = 800; // 与 wxss 旋转动画 0.8s 对齐，保证至少转满一圈
    const start = Date.now();
    this.setData({ loading: true });
    const finish = function (patch) {
      const elapsed = Date.now() - start;
      const rest = MIN_SPIN - elapsed;
      if (rest > 0) setTimeout(function () { that.setData(patch); }, rest);
      else that.setData(patch);
    };
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
          finished: r.status === STATUS_FINISHED,
          dateText: roomDateText(r.createdAt)
        };
        if (r.status === STATUS_FINISHED) history.push(item);
        else if (r.status === STATUS_PLAYING) progress.push(item);
        // STATUS_WAITING（待开始）：不列入任何 tab，退出即废弃
      });
      finish({ progressList: progress, historyList: history, loading: false });
    }).catch(function () {
      finish({ loading: false });
    });
  },

  openRoom(e) {
    const ds = e.currentTarget.dataset;
    const url = ds.finished
      ? '/pages/room-result/index?roomId=' + ds.roomId
      : '/pages/room-board/index?roomId=' + ds.roomId;
    wx.navigateTo({
      url: url,
      fail: function () {
        // navigateTo 失败（多为页面栈过深超过 10 层）时兜底：直接重定向进入，避免“点击无反应”
        wx.redirectTo({
          url: url,
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

  goBack() {
    wx.switchTab({ url: '/pages/rules/index' });
  },

  onShareAppMessage() {
    return share.appMessage({ title: '麻将计分器：多人记账' });
  }
});
