// 牌技挑战后端接口封装（对接 bit-home 的 /api/game-quiz 接口）
//
// 注意：开发阶段后端默认运行在 http://localhost:8080（微信开发者工具需勾选"不校验合法域名"）。
// 生产环境请将 API_BASE 改为已备案且配置到小程序 request 合法域名的地址。

const API_BASE = 'https://www.nextrift.top';

function getOpenid() {
  try {
    var app = getApp();
    var openid = (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) || '';
    if (!openid) {
      var cached = wx.getStorageSync('mj_user') || {};
      openid = cached.openid || '';
    }
    return openid;
  } catch (e) {
    return '';
  }
}

function request(method, path, data) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: API_BASE + path,
      method: method,
      data: data,
      header: { 'content-type': 'application/json' },
      success: function (res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          var body = res.data || {};
          if (body.code === 0) {
            resolve(body.data);
          } else {
            reject(new Error(body.message || '请求失败'));
          }
        } else {
          reject(new Error('网络错误 ' + res.statusCode));
        }
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '网络请求失败'));
      }
    });
  });
}

// 获取今日题目（首次访问自动分配）
function getTodayQuestions() {
  return request('GET', '/api/game-quiz/today?openid=' + encodeURIComponent(getOpenid()), null);
}

// 提交单题答案
function submitAnswer(payload) {
  return request('POST', '/api/game-quiz/answer', payload);
}

// 查询用户总进度与段位
function getProgress() {
  return request('GET', '/api/game-quiz/progress?openid=' + encodeURIComponent(getOpenid()), null);
}

// 开始闯关挑战（返回按难度排序的关卡题目）
function startChallenge() {
  return request('GET', '/api/game-quiz/challenge/start?openid=' + encodeURIComponent(getOpenid()), null);
}

// 提交本场成绩到排行榜
function submitLeaderboard(payload) {
  return request('POST', '/api/game-quiz/leaderboard/submit', payload);
}

// 保存用户资料（昵称 + 头像云文件ID），按 openid upsert
function saveProfile(payload) {
  return request('POST', '/api/game-quiz/profile', payload);
}

// 查询排行榜
function getLeaderboard() {
  return request('GET', '/api/game-quiz/leaderboard?openid=' + encodeURIComponent(getOpenid()), null);
}

module.exports = {
  API_BASE: API_BASE,
  getOpenid: getOpenid,
  getTodayQuestions: getTodayQuestions,
  submitAnswer: submitAnswer,
  getProgress: getProgress,
  startChallenge: startChallenge,
  submitLeaderboard: submitLeaderboard,
  saveProfile: saveProfile,
  getLeaderboard: getLeaderboard
};
