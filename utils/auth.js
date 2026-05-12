/**
 * auth.js - 微信云开发登录模块
 *
 * 调用已部署的 login 云函数，管理登录状态。
 * 云函数入参：{ phoneCode, nickname?, avatarUrl? }
 * 云函数出参：{ success, openid, phoneNumber, userInfo }
 */

const CACHE_KEY = 'mj_user';

function isLoggedIn() {
  const app = getApp();
  return !!(app.globalData && app.globalData.loggedIn);
}

function getUserInfo() {
  const app = getApp();
  return (app.globalData && app.globalData.userInfo) || null;
}

/**
 * 从缓存恢复登录状态
 */
function restoreLogin() {
  try {
    const cached = wx.getStorageSync(CACHE_KEY);
    if (cached && cached.openid) {
      const app = getApp();
      app.globalData.userInfo = cached;
      app.globalData.loggedIn = true;
      console.log('[auth] 从缓存恢复登录状态, openid:', cached.openid);
      return true;
    }
  } catch (e) {
    console.warn('[auth] 恢复登录失败:', e);
  }
  console.log('[auth] 无有效缓存，未登录');
  return false;
}

/**
 * 执行登录
 * phoneCode 允许为空（云函数仍能获取 OPENID）
 */
function login(phoneCode, nickName, avatarUrl) {
  phoneCode = phoneCode || '';
  console.log('[auth] login() 调用, phoneCode 长度:', phoneCode.length, 'nickName:', nickName || '玩家');

  return wx.cloud.callFunction({
    name: 'login',
    data: {
      phoneCode,
      nickname: nickName || '玩家',
      avatarUrl: avatarUrl || ''
    }
  }).then(res => {
    console.log('[auth] 云函数返回:', JSON.stringify(res));

    const result = res.result || {};

    if (result.success === false) {
      throw new Error(result.error || '登录失败，请重试');
    }

    const userInfo = result.userInfo || {
      openid: result.openid || '',
      phoneNumber: result.phoneNumber || '',
      nickName: nickName || '玩家',
      avatarUrl: avatarUrl || ''
    };

    console.log('[auth] 登录成功, userInfo:', JSON.stringify(userInfo));

    wx.setStorageSync(CACHE_KEY, userInfo);

    const app = getApp();
    app.globalData.userInfo = userInfo;
    app.globalData.loggedIn = true;

    return userInfo;
  }).catch(err => {
    console.error('[auth] 云函数调用失败:', err.errMsg || err.message || err);
    throw err;
  });
}

function logout() {
  try {
    wx.removeStorageSync(CACHE_KEY);
  } catch (e) {
    console.warn('[auth] 清除缓存失败:', e);
  }

  const app = getApp();
  app.globalData.userInfo = null;
  app.globalData.loggedIn = false;

  console.log('[auth] 已退出登录');
}

/**
 * 设置手机号（手动绑定）
 */
function setPhoneNumber(phoneNumber) {
  if (!phoneNumber) return;

  const app = getApp();

  // 更新缓存
  const cached = wx.getStorageSync(CACHE_KEY) || {};
  cached.phoneNumber = phoneNumber;
  wx.setStorageSync(CACHE_KEY, cached);

  // 更新全局状态
  if (app.globalData.userInfo) {
    app.globalData.userInfo.phoneNumber = phoneNumber;
  } else {
    app.globalData.userInfo = { phoneNumber };
  }

  console.log('[auth] 手动设置手机号:', phoneNumber);
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  getUserInfo,
  restoreLogin,
  setPhoneNumber
};
