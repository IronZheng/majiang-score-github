const auth = require('./utils/auth');
const track = require('./utils/track');
const api = require('./utils/api');
const storage = require('./utils/storage');
const userUtil = require('./utils/user');

// 包装全局 Page，自动为每个页面注入行为追踪
// （资料同步与刷新统一由 app.ensureProfile 处理，见下方 onShow 注入）
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
      // 进入页面即确保已读取服务端资料并刷新；新用户按需弹一次引导
      try {
        var app = getApp();
        if (app && app.ensureProfile) {
          app.ensureProfile().then(function () {
            if (app.maybePromptProfileSetup) app.maybePromptProfileSetup();
          });
        }
      } catch (e) {}
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
    loggedIn: false,
    // 资料同步状态：
    // needProfileSetup=服务端无资料，视为新用户；profileReady=本次会话资料加载 Promise（只拉一次）；
    // profilePromptShown=新用户引导弹窗本次会话只弹一次
    needProfileSetup: false,
    profileReady: null,
    profilePromptShown: false
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

    // 4. 已登录用户 openid 立即可用，先同步计分记录（本地 + 服务器融合）
    if (this.globalData.loggedIn) {
      this.syncScoreHistory();
    }

    // 5. 统一的第一步：拿 openid -> 读服务端资料 -> 套用/判定新用户 -> 刷新页面
    //    无论是否登录都走这里；未登录时内部会先静默获取 openid
    this.ensureProfile();
  },

  /**
   * 统一资料加载（本次会话只执行一次）：
   * 第一步 拿 openid（已有直接用，否则等静默获取，最多约 3 秒）；
   * 第二步 用 openid 调 getProfile 读库；
   * 第三步 有数据 -> 写回 globalData+缓存 并刷新当前页面；无数据 -> 标记新用户。
   * 返回 Promise，页面 onShow 可 .then 刷新，保证"数据回来后刷新页面"。
   */
  ensureProfile() {
    var app = this;
    if (app.globalData.profileReady) {
      return app.globalData.profileReady;
    }
    var p = app.ensureOpenid().then(function (openid) {
      if (!openid) {
        // 拿不到 openid：按新用户处理，不阻塞使用
        app.globalData.needProfileSetup = true;
        return null;
      }
      return api.getProfile().then(function (profile) {
        var has = !!(profile && (profile.nickname || profile.avatarUrl));
        if (has) {
          userUtil.applyServerProfile(profile); // 写回 globalData + 缓存
          app.globalData.needProfileSetup = false;
        } else {
          app.globalData.needProfileSetup = true; // 新用户
        }
        return profile;
      }).catch(function () {
        // 查询失败不阻塞使用，按新用户处理（稍后重试）
        app.globalData.needProfileSetup = true;
        return null;
      });
    }).then(function (profile) {
      // 数据就绪：刷新所有已显示页面
      app._refreshIdentityPages();
      return profile;
    });
    app.globalData.profileReady = p;
    return p;
  },

  /** 遍历当前页面栈，让实现了 renderIdentity 的页面用最新资料重渲染 */
  _refreshIdentityPages() {
    var pages = getCurrentPages() || [];
    pages.forEach(function (page) {
      if (page && typeof page.renderIdentity === 'function') {
        try { page.renderIdentity(); } catch (e) {}
      }
    });
  },

  /** 新用户引导：仅在需设置且本次会话未弹过时弹一次 */
  maybePromptProfileSetup() {
    var app = this;
    if (!app.globalData.needProfileSetup || app.globalData.profilePromptShown) return;
    app.globalData.profilePromptShown = true;
    wx.showModal({
      title: '完善头像和昵称',
      content: '设置头像和昵称后，朋友在牌局和排行榜中就能认出你啦～',
      confirmText: '去设置',
      cancelText: '稍后再说',
      success: function (res) {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/profile/index' });
        }
      }
    });
  },

  /**
   * 确保已拿到 openid：已有则直接返回；否则触发静默获取并轮询等待（最多约 3 秒）。
   * 返回 Promise<openid>，拿不到则 resolve 空串。用于「创建房间」等需要 openid 的动作，
   * 避免静默获取尚未返回时直接报「请先授权」。
   */
  ensureOpenid() {
    var self = this;
    return new Promise(function (resolve) {
      var existing = api.getOpenid();
      if (existing) {
        resolve(existing);
        return;
      }
      if (self.fetchOpenidSilently) self.fetchOpenidSilently();
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        var id = api.getOpenid();
        if (id || tries > 30) {
          clearInterval(timer);
          resolve(api.getOpenid());
        }
      }, 100);
    });
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
        // 资料加载由 app.ensureProfile() 统一触发（onLaunch 已调用，待 openid 就绪后其 Promise 会继续推进）
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
