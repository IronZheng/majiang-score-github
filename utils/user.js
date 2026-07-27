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

// 把服务端（数据库）读取到的资料套用到本地缓存与全局状态。
// 仅在服务端确有数据时写入，并标记对应字段已自定义，避免被默认资料覆盖；
// 返回合并后的用户资料。
function applyServerProfile(profile) {
  if (!profile) return null;
  const app = getApp();
  const cached = wx.getStorageSync(CACHE_KEY) || {};
  let changed = false;
  // 服务端资料作为「兜底」：仅当本地尚未自定义时才套用，避免用（可能过期的）库值覆盖
  // 用户刚刚在「我的」页做出的选择。
  if (profile.nickname && !cached.nickNameCustomized) {
    cached.nickName = profile.nickname;
    cached.nickNameCustomized = true;
    changed = true;
  }
  if (profile.avatarUrl && !cached.avatarCustomized) {
    cached.avatarUrl = profile.avatarUrl;
    cached.avatarCustomized = true;
    changed = true;
  }
  if (changed) {
    try {
      wx.setStorageSync(CACHE_KEY, cached);
    } catch (e) {}
    if (app && app.globalData) app.globalData.userInfo = cached;
  }
  return cached;
}

module.exports = {
  CACHE_KEY: CACHE_KEY,
  getCachedUser: getCachedUser,
  ensureUser: ensureUser,
  applyServerProfile: applyServerProfile
};
