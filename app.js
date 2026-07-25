const auth = require('./utils/auth');
const track = require('./utils/track');
const api = require('./utils/api');
const storage = require('./utils/storage');
const userUtil = require('./utils/user');

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

    // 2. 初始化用户资料到全局：读缓存，缺失则生成默认头像昵称，
    //    避免任何页面都必须先进入「我的」页才能显示头像
    try {
      userUtil.ensureUser();
    } catch (e) {
      console.warn('[app] 初始化用户资料失败:', e);
    }

    // 3. 从缓存恢复登录状态
    auth.restoreLogin();

    // 3. 如果未登录，静默获取 openid（不上报到用户信息，仅记录 openid 用于行为追踪）
    if (!this.globalData.loggedIn) {
      this.fetchOpenidSilently();
    } else {
      // 已登录用户同样拥有 openid，直接触发计分记录同步（本地 + 服务器融合）
      this.syncScoreHistory();
    }
  },

  /**
   * 同步计分记录：把本地记录上传服务器（旧本地数据自动迁移），并拉取服务器全量合并回本地。
   * 本地永远先写，服务器为权威；任一侧丢失都能靠另一侧恢复（冗余）。
   */
  syncScoreHistory() {
    const openid = api.getOpenid();
    if (!openid) {
      console.log('[app] 暂无 openid，跳过计分记录同步');
      return;
    }
    const localRecords = storage.getHistory();
    api.syncScoreRecords(openid, localRecords)
      .then((serverList) => {
        if (Array.isArray(serverList)) {
          storage.mergeServerRecords(serverList);
          console.log('[app] 计分记录同步完成，服务器返回', serverList.length, '条');
        }
      })
      .catch((err) => {
        console.warn('[app] 计分记录同步失败（本地已留存）:', err);
      });
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
        // 触发计分记录同步：旧本地数据自动上传服务器，并拉取服务器全量合并回本地
        app.syncScoreHistory();
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
