const storage = require('../../utils/storage');
const { getHistory, removeHistory } = storage;
const share = require('../../utils/share');
const defaultProfiles = require('../../utils/default-profiles');
const api = require('../../utils/api');
const app = getApp();

const CACHE_KEY = 'mj_user';

Page({
  data: {
    userInfo: null,
    history: [],
    avatarBg: 'rgba(255,255,255,0.12)',
    syncLoading: false,
    cloudHint: ''
  },

  onShow() {
    share.enableShareMenu();

    const tabBar = this.getTabBar && this.getTabBar();
    if (tabBar) tabBar.setData({ selected: 3 });

    const userInfo = this._getOrCreateUser();

    this.setData({
      userInfo,
      history: this.formatHistory()
    });

    // 进入页面即把已设置的昵称/头像同步到后端（openid 就绪时）
    this._reportProfile();
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

    this._uploadAvatar(avatarUrl);
  },

  // 选头像：临时文件先上传到微信云存储，拿到云文件ID后保存并上报后端
  _uploadAvatar(tempPath) {
    const that = this;
    const extMatch = tempPath.match(/\.(png|jpg|jpeg|webp)(?:\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const cloudPath = `avatar/${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
    wx.showLoading({ title: '上传头像...' });
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempPath
    }).then(function (res) {
      wx.hideLoading();
      const fileID = (res && res.fileID) || '';
      if (!fileID) {
        wx.showToast({ title: '头像上传失败', icon: 'none' });
        return;
      }
      that._saveAvatarUrl(fileID);
      that._reportProfile();
    }).catch(function (err) {
      wx.hideLoading();
      console.warn('[profile] 头像云上传失败:', err);
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    });
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

  // 将当前昵称/头像上报到后端（按 openid 保存），供排行榜展示
  _reportProfile() {
    const openid = api.getOpenid();
    if (!openid) return;
    const user = app.globalData.userInfo || this._getOrCreateUser() || {};
    const payload = { openid: openid };
    if (user.nickName) payload.nickname = user.nickName;
    if (user.avatarUrl) payload.avatarUrl = user.avatarUrl;
    api.saveProfile(payload).catch(function (err) {
      console.warn('[profile] 保存资料失败:', err);
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
    this._reportProfile();
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
        // 同步删除服务器记录（失败仅告警，本地已删除；下次同步会再次尝试删除）
        api.deleteScoreRecord(api.getOpenid(), id).catch((err) => {
          console.warn('[profile] 服务器删除计分记录失败:', err);
        });
      }
    });
  },

  /**
   * 手动「备份到云端」：把本地全部记录全量上传服务器，并拉取服务器全量合并回本地。
   * 用于确保未上传的本地记录全部入库（幂等去重，已传的自动跳过），并给出可视反馈。
   */
  syncToCloud() {
    if (this.data.syncLoading) return;
    const openid = api.getOpenid();
    if (!openid) {
      wx.showToast({ title: '请先获取登录信息', icon: 'none' });
      return;
    }
    const localRecords = storage.getHistory();
    const localCount = localRecords.length;
    if (localCount === 0) {
      wx.showToast({ title: '暂无本地记录', icon: 'none' });
      return;
    }
    this.setData({ syncLoading: true, cloudHint: '' });
    api.syncScoreRecords(openid, localRecords)
      .then((serverList) => {
        if (Array.isArray(serverList)) {
          storage.mergeServerRecords(serverList);
          this.setData({ history: this.formatHistory(), cloudHint: `已备份：本地 ${localCount} 条，云端共 ${serverList.length} 条` });
          wx.showToast({ title: '备份完成', icon: 'success' });
        } else {
          this.setData({ cloudHint: '备份完成' });
        }
      })
      .catch((err) => {
        console.warn('[profile] 备份到云端失败:', err);
        this.setData({ cloudHint: '备份失败，请稍后重试' });
        wx.showToast({ title: '备份失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ syncLoading: false });
      });
  },

  showAbout() {
    wx.showModal({
      title: '小程序说明',
      content: '麻将计分器适合朋友聚会、家庭牌局等场景使用。你可以快速设置玩家，记录每局加减分，按需单独统计台费，并在历史记录中回看每次结果。数据主要保存在本机，轻量、简单，不需要复杂登录。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  showAddMyGuide() {
    wx.showModal({
      title: '添加到我的小程序',
      content: '点击页面右上角「···」，选择「添加到我的小程序」。以后在微信首页下拉，就能快速找到麻将计分器。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#e49b73'
    });
  },

  openStudio() {
    wx.navigateTo({ url: '/pages/studio/index' });
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
