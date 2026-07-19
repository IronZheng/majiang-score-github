const GAME_KEY = 'mj_current_game';
const HISTORY_KEY = 'mj_score_history';

function saveCurrentGame(game) {
  wx.setStorageSync(GAME_KEY, game);
}

function getCurrentGame() {
  return wx.getStorageSync(GAME_KEY) || null;
}

function clearCurrentGame() {
  wx.removeStorageSync(GAME_KEY);
}

function addHistory(record) {
  const list = wx.getStorageSync(HISTORY_KEY) || [];
  list.unshift(record);
  wx.setStorageSync(HISTORY_KEY, list.slice(0, 100));
}

function getHistory() {
  return wx.getStorageSync(HISTORY_KEY) || [];
}

function removeHistory(id) {
  const list = wx.getStorageSync(HISTORY_KEY) || [];
  wx.setStorageSync(HISTORY_KEY, list.filter((item) => item.id !== id));
}

/**
 * 生成客户端记录唯一ID（clientId）。
 * 新版本统一用「时间戳 + 随机串」，避免多设备/同毫秒碰撞；旧版本本地记录 id=Date.now() 将直接作为 clientId 上传。
 */
function genClientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 将服务器返回的记录合并回本地（服务器为权威，同 id 以服务器为准），实现「本地 + 服务器」双写冗余。
 * serverList: [{ clientId, finishedAt, payload }]
 * 返回合并后的本地列表。
 */
function mergeServerRecords(serverList) {
  const local = getHistory();
  const byId = {};
  local.forEach((r) => {
    if (r && r.id) byId[r.id] = r;
  });

  (serverList || []).forEach((s) => {
    if (!s || !s.clientId) return;
    // 用服务器 payload 重组本地记录，id 用 clientId
    const reconstructed = Object.assign({}, s.payload || {}, { id: s.clientId });
    byId[s.clientId] = reconstructed; // 服务器权威，覆盖本地
  });

  const merged = Object.keys(byId).map((k) => byId[k]);
  merged.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  wx.setStorageSync(HISTORY_KEY, merged.slice(0, 300));
  return merged;
}

module.exports = {
  saveCurrentGame,
  getCurrentGame,
  clearCurrentGame,
  addHistory,
  getHistory,
  removeHistory,
  genClientId,
  mergeServerRecords
};
