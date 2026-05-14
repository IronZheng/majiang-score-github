const auth = require('../../utils/auth');
const share = require('../../utils/share');

Page({
  data: {
    loading: false,
    showManualInput: false,
    manualPhone: '',
    loginDone: false
  },

  onLoad() {
    share.enableShareMenu();

    console.log('[login] 页面加载，当前登录状态:', auth.isLoggedIn());
    if (auth.isLoggedIn()) {
      const user = auth.getUserInfo();
      if (user && user.phoneNumber) {
        this.goHome();
        return;
      }
    }
  },

  /**
   * 登录成功后，静默拉取微信头像和昵称
   */
  tryFetchWechatProfile() {
    wx.getUserInfo({
      lang: 'zh_CN',
      success: (res) => {
        const wechat = res.userInfo || {};
        const nickName = wechat.nickName;
        const avatarUrl = wechat.avatarUrl;
        if (!nickName || nickName === '微信用户') return;

        const app = getApp();
        const user = app.globalData.userInfo || {};
        if (!user.nickNameCustomized) user.nickName = nickName;
        if (!user.avatarCustomized && avatarUrl) user.avatarUrl = avatarUrl;
        wx.setStorageSync('mj_user', user);
        app.globalData.userInfo = user;
        console.log('[login] 已获取微信头像和昵称:', nickName);
      },
      fail: () => {} // 静默失败，用户可自己去 profile 页设置
    });
  },

  /**
   * 手机号授权按钮回调
   */
  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    console.log('[login] getPhoneNumber 回调:', JSON.stringify(detail));
    console.log('[login] code:', detail.code ? detail.code.substring(0, 6) + '...' : '(空)');

    const errMsg = detail.errMsg || detail.err_msg || '';
    const code = detail.code || '';

    if (errMsg.indexOf('fail:auth deny') !== -1 ||
        errMsg.indexOf('fail user deny') !== -1 ||
        errMsg.indexOf('用户拒绝') !== -1) {
      wx.showToast({ title: '需要授权手机号才能登录', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    const startTime = Date.now();
    auth.login(code)
      .then(userInfo => {
        const elapsed = Date.now() - startTime;
        console.log('[login] 登录成功 (耗时', elapsed + 'ms):', JSON.stringify(userInfo));

        // 尝试拉取微信头像和昵称
        this.tryFetchWechatProfile();

        if (!code && !userInfo.phoneNumber) {
          console.log('[login] 无手机号，展示手动输入');
          this.setData({ loading: false, loginDone: true, showManualInput: true });
          wx.hideLoading();
          wx.showToast({ title: '请填写手机号完成登录', icon: 'none' });
          return;
        }

        this.setData({ loading: false });
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => this.goBack(), 1200);
      })
      .catch(err => {
        console.error('[login] 登录失败:', err.message);
        this.setData({ loading: false });
        wx.showToast({ title: err.message || '登录失败', icon: 'none' });
      });
  },

  /** 手机号输入 */
  onPhoneInput(e) {
    this.setData({ manualPhone: e.detail.value });
  },

  /** 提交手动填写的手机号 */
  submitManualPhone() {
    let phone = (this.data.manualPhone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    auth.setPhoneNumber(phone);
    // 手动提交时也试拉取头像昵称
    this.tryFetchWechatProfile();

    this.setData({ loading: false });
    wx.showToast({ title: '绑定成功', icon: 'success' });
    setTimeout(() => this.goBack(), 1200);
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      this.goHome();
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/scoring-setup/index' });
  },

  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器，聚会计分更省心'
    });
  },

  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器，聚会计分更省心'
    });
  }
});
