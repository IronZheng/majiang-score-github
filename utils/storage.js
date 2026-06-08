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

module.exports = {
  saveCurrentGame,
  getCurrentGame,
  clearCurrentGame,
  addHistory,
  getHistory,
  removeHistory
};
