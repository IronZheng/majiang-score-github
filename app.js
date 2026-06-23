const auth = require('./utils/auth');
const track = require('./utils/track');

// 包装全局 Page，自动为每个页面注入行为追踪
(function wrapPage() {
  var _Page = Page;
  Page = function (options) {
    var _onShow = options.onShow;
    options.onShow = function () {
      try {
        track.trackPageView('/' + this.route);
      } catch (e) {
        // 静默失败，不影响页面正常逻辑
      }
      if (_onShow) {
        _onShow.call(this);
      }
    };
    return _Page(options);
  };
})();

App({
  globalData: {
    userInfo: null,
    loggedIn: false
  },

  onLaunch() {
    // 1. 初始化云开发
    wx.cloud.init({
      env: 'cloud1-d9gunt71q5391b5eb',
      traceUser: false
    });

    // 2. 从缓存恢复登录状态
    auth.restoreLogin();

    // 3. 如果未登录，静默获取 openid（不上报到用户信息，仅记录 openid 用于行为追踪）
    if (!this.globalData.loggedIn) {
      this.fetchOpenidSilently();
    }
  },

  /**
   * 静默获取 openid（不触发 UI 登录流程）
   */
  fetchOpenidSilently() {
    var that = this;
    wx.cloud.callFunction({
      name: 'login',
      data: { phoneCode: '', nickname: '', avatarUrl: '' }
    }).then(function (res) {
      var result = res.result || {};
      if (result.openid) {
        var app = getApp();
        app.globalData.userInfo = app.globalData.userInfo || {};
        app.globalData.userInfo.openid = result.openid;
        try {
          var cached = wx.getStorageSync('mj_user') || {};
          cached.openid = result.openid;
          wx.setStorageSync('mj_user', cached);
        } catch (e) {}
        console.log('[app] 静默获取 openid 成功:', result.openid);
        // 补发等待队列中排队的上报
        track.flushPending();
      }
    }).catch(function (err) {
      console.warn('[app] 静默获取 openid 失败:', err);
      // 失败了也清空队列，避免内存积压
      track.flushPending();
    });
  },

  /**
   * 登录（委托给 auth 模块）
   */
  login(phoneCode, nickName, avatarUrl) {
    return auth.login(phoneCode, nickName, avatarUrl);
  },

  /**
   * 退出登录
   */
  logout() {
    auth.logout();
  },

  /**
   * 检查登录状态
   */
  isLoggedIn() {
    return this.globalData.loggedIn;
  }
});
