const { getHistory } = require('../../utils/storage');
const auth = require('../../utils/auth');
const app = getApp();

const CACHE_KEY = 'mj_user';

Page({
  data: {
    userInfo: null,
    history: [],
    avatarBg: '#e8f4ff'
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 1 });

    // 从全局状态同步（全局状态在 app.onLaunch 时已从缓存恢复）
    this.setData({
      userInfo: app.globalData.loggedIn ? app.globalData.userInfo : null,
      history: this.formatHistory()
    });

    // 已登录但缺少昵称/头像 → 尝试从微信静默拉取
    if (app.globalData.loggedIn) {
      this.tryFetchUserProfile();
    }
  },

  // ==================== 自动拉取微信信息 ====================

  /**
   * 仅当用户还没设置过自己的昵称和头像时，才从微信拉取
   */
  tryFetchUserProfile() {
    const user = app.globalData.userInfo;
    if (!user) return;

    // 用户已经手动设过自定义头像或非默认昵称，就不覆盖
    const hasCustomAvatar = user.avatarUrl && !user.avatarUrl.startsWith('wxfile://');
    const hasCustomName = user.nickName && user.nickName !== '玩家' && user.nickName !== '微信用户';
    if (hasCustomAvatar && hasCustomName) return;

    wx.getUserInfo({
      lang: 'zh_CN',
      success: (res) => {
        const wechat = res.userInfo || {};
        if (!wechat.nickName || wechat.nickName === '微信用户') return;

        const updated = { ...user };
        if (!hasCustomName) updated.nickName = wechat.nickName;
        if (!hasCustomAvatar && wechat.avatarUrl) updated.avatarUrl = wechat.avatarUrl;

        // 保存
        this._saveUserInfo(updated);
        console.log('[profile] 微信拉取到信息:', wechat.nickName);
      },
      fail: () => {}
    });
  },

  // ==================== 头像（chooseAvatar 返回临时路径 → 存为持久文件） ====================

  onChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;

    wx.showLoading({ title: '保存头像...' });

    // 转存为持久文件（临时路径刷新后会消失）
    wx.saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        const savedPath = res.savedFilePath;
        console.log('[profile] 头像已持久化:', savedPath);

        const user = app.globalData.userInfo || {};
        user.avatarUrl = savedPath;
        this._saveUserInfo(user);
        wx.hideLoading();
      },
      fail: () => {
        // saveFile 失败时降级用临时路径（至少当前会话能用）
        console.warn('[profile] 头像持久化失败，使用临时路径');
        const user = app.globalData.userInfo || {};
        user.avatarUrl = tempPath;
        this._saveUserInfo(user);
        wx.hideLoading();
      }
    });
  },

  // ==================== 昵称（type="nickname"，确认/失焦时保存） ====================

  onNicknameInput(e) {
    this._pendingNickName = e.detail.value;
  },

  onNicknameConfirm(e) {
    const nickName = (e.detail.value || '').trim();
    if (nickName) this._doSaveNickname(nickName);
  },

  onNicknameBlur(e) {
    // blur 也能取到 e.detail.value
    const val = e.detail && e.detail.value;
    const nickName = ((val || this._pendingNickName || '')).trim();
    if (nickName) this._doSaveNickname(nickName);
  },

  _doSaveNickname(nickName) {
    const user = app.globalData.userInfo || {};
    if (user.nickName === nickName) return; // 没变化就不写

    user.nickName = nickName;
    this._saveUserInfo(user);
    console.log('[profile] 昵称已保存:', nickName);
  },

  // ==================== 统一保存 ====================

  _saveUserInfo(userInfo) {
    // 存到缓存
    wx.setStorageSync(CACHE_KEY, userInfo);
    // 同步到全局状态
    app.globalData.userInfo = userInfo;
    // 渲染
    this.setData({ userInfo: { ...userInfo } });
  },

  // ==================== 导航 ====================

  goLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？退出后本地记录不受影响。',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({ userInfo: null });
        }
      }
    });
  },

  openRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/result/index?id=${id}` });
  },

  formatHistory() {
    return getHistory().map(item => ({
      ...item,
      finishedAtText: item.finishedAt
        ? new Date(item.finishedAt).toLocaleString()
        : ''
    }));
  }
});
