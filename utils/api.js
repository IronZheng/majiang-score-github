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

// ===================== 麻将计分记录（服务器 + 本地双写冗余） =====================

// 同步计分记录：上传本地记录数组并拉取服务器全量（按 openid+clientId 幂等去重）
function syncScoreRecords(openid, records) {
  if (!openid) return Promise.resolve(null);
  return request('POST', '/api/mahjong-score/sync', { openid: openid, records: records || [] });
}

// 删除一条服务器记录（按 openid + clientId），与本地删除保持一致
function deleteScoreRecord(openid, clientId) {
  if (!openid || !clientId) return Promise.resolve();
  return request(
    'POST',
    '/api/mahjong-score/delete?openid=' + encodeURIComponent(openid) + '&clientId=' + encodeURIComponent(clientId),
    null
  );
}

// ===================== 麻将多人房间（开放访问 + 成员令牌防串房） =====================

// 持久化房间成员令牌：key 绑定 roomId + openid，避免被他人串房滥用
function saveRoomToken(roomId, openid, token) {
  if (!roomId || !openid || !token) return;
  wx.setStorageSync('mj_room_token:' + roomId + ':' + openid, token);
}
function getRoomToken(roomId, openid) {
  if (!roomId || !openid) return '';
  return wx.getStorageSync('mj_room_token:' + roomId + ':' + openid) || '';
}

// 创建房间：房主建房 + 入座，返回 roomId + accessToken
function createRoom(payload) {
  return request('POST', '/api/mahjong-room/create', payload);
}

// 加入房间：返回 accessToken
function joinRoom(payload) {
  return request('POST', '/api/mahjong-room/join', payload);
}

// 离开房间（房主离开转移/解散）
function leaveRoom(roomId) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/leave', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid)
  });
}

// 开始游戏（仅房主）
function startRoom(roomId) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/start', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid)
  });
}

// 提交分数：可指定目标玩家（targetOpenid，不传则本人），任意成员可改任意成员
function submitRoomScore(roomId, round, delta, note, targetOpenid) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/score', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid),
    round: round,
    delta: delta,
    targetOpenid: targetOpenid || '',
    note: note || ''
  });
}

// 提交台费：独立计项，不计入玩家总分（fee>0）
function submitRoomFee(roomId, round, fee) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/score', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid),
    round: round,
    delta: 0,
    targetOpenid: '',
    note: '台费',
    fee: fee
  });
}

// 撤销本人上一笔计分
function undoRoomScore(roomId) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/undo', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid)
  });
}

// 轮询房间状态（只读，无需令牌）
function getRoomState(roomId) {
  var openid = getOpenid();
  return request(
    'GET',
    '/api/mahjong-room/state?roomId=' + encodeURIComponent(roomId) +
      '&selfOpenid=' + encodeURIComponent(openid),
    null
  );
}

// 结束游戏（仅房主）
function finishRoom(roomId) {
  var openid = getOpenid();
  return request('POST', '/api/mahjong-room/finish', {
    roomId: roomId,
    openid: openid,
    accessToken: getRoomToken(roomId, openid)
  });
}

// 分享信息（点击即加入的路径）
function getRoomShareInfo(roomId) {
  return request('GET', '/api/mahjong-room/share-info?roomId=' + encodeURIComponent(roomId), null);
}

// 小程序码（扫码加入，返回 base64 data-url）
function getRoomQrcode(roomId) {
  return request('GET', '/api/mahjong-room/qrcode?roomId=' + encodeURIComponent(roomId), null);
}

// 我的房间列表（进行中 + 历史记录）
function getMyRooms(openid) {
  if (!openid) return Promise.resolve([]);
  return request('GET', '/api/mahjong-room/my-rooms?openid=' + encodeURIComponent(openid), null);
}

// ===================== 个人对局记录（方位统计） =====================

// 保存对局记录
function saveUserRecord(payload) {
  return request('POST', '/api/mahjong-record/save', payload);
}

// 查询我的对局记录（按日期倒序）
function listUserRecords() {
  var openid = getOpenid();
  if (!openid) return Promise.resolve([]);
  return request('GET', '/api/mahjong-record/list?openid=' + encodeURIComponent(openid), null);
}

// 查询我的对局统计（总局数/胜率/场均/方位）
function getUserRecordStats() {
  var openid = getOpenid();
  if (!openid) return Promise.resolve(null);
  return request('GET', '/api/mahjong-record/stats?openid=' + encodeURIComponent(openid), null);
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
  getLeaderboard: getLeaderboard,
  syncScoreRecords: syncScoreRecords,
  deleteScoreRecord: deleteScoreRecord,
  saveRoomToken: saveRoomToken,
  getRoomToken: getRoomToken,
  createRoom: createRoom,
  joinRoom: joinRoom,
  leaveRoom: leaveRoom,
  startRoom: startRoom,
  submitRoomScore: submitRoomScore,
  submitRoomFee: submitRoomFee,
  undoRoomScore: undoRoomScore,
  getRoomState: getRoomState,
  finishRoom: finishRoom,
  getRoomShareInfo: getRoomShareInfo,
  getRoomQrcode: getRoomQrcode,
  getMyRooms: getMyRooms,
  saveUserRecord: saveUserRecord,
  listUserRecords: listUserRecords,
  getUserRecordStats: getUserRecordStats
};
