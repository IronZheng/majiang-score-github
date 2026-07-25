// 统一的用户资料读取：优先读持久化缓存 mj_user，没有则生成默认资料并落盘。
// 解决「必须进入我的页头像/昵称才显示」的体验问题——任何页面都能直接拿到可用资料。

const defaultProfiles = require('./default-profiles');

const CACHE_KEY = 'mj_user';

function getCachedUser() {
  try {
    const cached = wx.getStorageSync(CACHE_KEY) || null;
    if (!cached) return null;
    return defaultProfiles.applyDefaultUserProfile(
      cached,
      cached.defaultProfileSeed || cached.openid || cached.phoneNumber
    );
  } catch (e) {
    return null;
  }
}

// 确保存在可用资料：读缓存 -> 缺失则生成默认并保存 -> 同步到 globalData
function ensureUser() {
  const app = getApp();
  let user = getCachedUser();
  if (user) {
    if (app && app.globalData) app.globalData.userInfo = user;
    return user;
  }
  const seed = defaultProfiles.getLocalProfileSeed();
  user = defaultProfiles.applyDefaultUserProfile(
    {
      defaultProfileSeed: seed,
      defaultProfileAuto: true
    },
    seed
  );
  try {
    wx.setStorageSync(CACHE_KEY, user);
  } catch (e) {}
  if (app && app.globalData) app.globalData.userInfo = user;
  return user;
}

module.exports = {
  CACHE_KEY: CACHE_KEY,
  getCachedUser: getCachedUser,
  ensureUser: ensureUser
};
