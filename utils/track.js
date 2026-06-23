var API_BASE = 'https://www.nextrift.top';
var pendingQueue = [];

/**
 * 获取当前用户的 openid
 */
function getUserId() {
  try {
    var app = getApp();
    if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
      return app.globalData.userInfo.openid;
    }
    var cached = wx.getStorageSync('mj_user');
    if (cached && cached.openid) {
      return cached.openid;
    }
  } catch (e) {
    // 静默
  }
  return '';
}

/**
 * 发送一条行为上报
 */
function doTrack(path) {
  wx.request({
    url: API_BASE + '/api/miniapp/track',
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: {
      path: path,
      code: 'majiang',
      userId: getUserId()
    },
    success: function () {},
    fail: function (err) {
      console.warn('[Track] 上报失败:', err);
    }
  });
}

/**
 * 上报小程序页面访问行为
 * 如果 openid 还没拿到，先排队，等拿到后自动补发
 */
function trackPageView(path) {
  if (getUserId()) {
    doTrack(path);
  } else {
    pendingQueue.push(path);
  }
}

/**
 * openid 就绪后，补发队列中等待的上报
 */
function flushPending() {
  if (pendingQueue.length > 0 && getUserId()) {
    var queue = pendingQueue.slice();
    pendingQueue = [];
    for (var i = 0; i < queue.length; i++) {
      doTrack(queue[i]);
    }
  }
}

module.exports = {
  trackPageView: trackPageView,
  flushPending: flushPending
};
