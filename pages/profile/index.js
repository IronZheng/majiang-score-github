const { getHistory, removeHistory } = require('../../utils/storage');
const share = require('../../utils/share');
const defaultProfiles = require('../../utils/default-profiles');
const app = getApp();

const CACHE_KEY = 'mj_user';

Page({
  data: {
    userInfo: null,
    history: [],
    avatarBg: 'rgba(255,255,255,0.12)'
  },

  onShow() {
    share.enableShareMenu();

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 2 });

    const userInfo = this._getOrCreateUser();

    this.setData({
      userInfo,
      history: this.formatHistory()
    });
  },

  _getCachedUser() {
    try {
      const cached = wx.getStorageSync(CACHE_KEY) || null;
      if (!cached) return null;
      return defaultProfiles.applyDefaultUserProfile(cached, cached.defaultProfileSeed || cached.openid || cached.phoneNumber);
    } catch (e) {
      console.warn('[profile] 读取用户缓存失败:', e);
      return null;
    }
  },

  _getOrCreateUser() {
    const cached = this._getCachedUser();
    if (cached) {
      app.globalData.userInfo = cached;
      return cached;
    }

    const seed = defaultProfiles.getLocalProfileSeed();
    const user = defaultProfiles.applyDefaultUserProfile({
      defaultProfileSeed: seed,
      defaultProfileAuto: true
    }, seed);
    this._saveUserInfo(user);
    return user;
  },

  resetDefaultProfile() {
    wx.showModal({
      title: '恢复默认资料',
      content: '确定恢复系统分配的默认头像和名称吗？',
      confirmText: '恢复',
      success: (res) => {
        if (!res.confirm) return;
        const seed = defaultProfiles.getLocalProfileSeed();
        const user = defaultProfiles.applyDefaultUserProfile({
          defaultProfileSeed: seed,
          defaultProfileAuto: true
        }, seed);
        this._saveUserInfo(user);
        wx.showToast({ title: '已恢复默认', icon: 'success' });
      }
    });
  },

  onChooseAvatar(e) {
    const avatarUrl = e.detail && e.detail.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '未选择头像', icon: 'none' });
      return;
    }

    this._saveAvatarUrl(avatarUrl);
  },

  _saveAvatarUrl(avatarUrl) {
    const saveUserAvatar = (finalAvatarUrl) => {
      const user = {
        ...(app.globalData.userInfo || this._getOrCreateUser()),
        avatarUrl: finalAvatarUrl,
        avatarCustomized: true,
        defaultProfileAuto: false
      };
      this._saveUserInfo(user);
      wx.showToast({ title: '头像已更新', icon: 'success' });
    };

    if (!wx.env || !wx.env.USER_DATA_PATH || !wx.getFileSystemManager || !avatarUrl.startsWith('wxfile://')) {
      saveUserAvatar(avatarUrl);
      return;
    }

    const extMatch = avatarUrl.match(/\.(png|jpg|jpeg|webp)(?:\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const savedAvatarUrl = `${wx.env.USER_DATA_PATH}/profile-avatar.${ext}`;

    wx.getFileSystemManager().copyFile({
      srcPath: avatarUrl,
      destPath: savedAvatarUrl,
      success: () => saveUserAvatar(savedAvatarUrl),
      fail: () => saveUserAvatar(avatarUrl)
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
    const user = app.globalData.userInfo || this._getCachedUser() || {};
    if (user.nickName === nickName) return; // 没变化就不写

    user.nickName = nickName;
    user.nickNameCustomized = true;
    this._saveUserInfo(user);
    console.log('[profile] 昵称已保存:', nickName);
  },

  // ==================== 统一保存 ====================

  _saveUserInfo(userInfo) {
    const normalized = {
      ...(this._getCachedUser() || {}),
      ...(userInfo || {})
    };
    // 存到缓存
    wx.setStorageSync(CACHE_KEY, normalized);
    // 同步到全局状态
    app.globalData.userInfo = normalized;
    app.globalData.loggedIn = false;
    // 渲染
    this.setData({ userInfo: { ...normalized } });
  },

  openRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/result/index?id=${id}` });
  },

  deleteRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条历史计分记录吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#d9534f',
      success: (res) => {
        if (!res.confirm) return;
        removeHistory(id);
        this.setData({ history: this.formatHistory() });
        wx.showToast({ title: '已删除', icon: 'success' });
      }
    });
  },

  showAbout() {
    wx.showModal({
      title: '小程序说明',
      content: '麻将计分器是一款轻量的本地计分工具，支持多人开局、回合加减分、历史记录查看和战绩海报生成，方便朋友聚会时快速记录每局得分。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  showFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '如有问题或建议，欢迎添加微信：dreamnev',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：我的历史战绩'
    });
  },

  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：我的历史战绩'
    });
  },

  formatHistory() {
    return getHistory().map(item => ({
      ...item,
      finishedAtText: item.finishedAt
        ? this.formatFinishedAt(item.finishedAt)
        : ''
    }));
  },

  formatFinishedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}月${day}日 ${hour}:${minute}`;
  }
});
