const auth = require('./utils/auth');

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
