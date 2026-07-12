const api = require('../../utils/api');

const TYPE_LABELS = {
  tingpai: '听牌挑战'
};

Page({
  data: {
    loading: true,
    questions: [],
    totalLevels: 0,
    levelIndex: 0,
    lives: 3,
    timeLeft: 60,
    timeText: '01:00',
    q: { typeLabel: '', stars: '', text: '', tiles: [], groups: [], context: '', hasLaizi: false, options: [], multiSelect: false },
    optionStates: [],
    selectedIndices: [],
    answered: false,
    isCorrect: false,
    lastExplanation: '',
    correctArr: [],
    gameOver: false,
    overInfo: null,
    score: 0
  },

  _timer: null,

  onLoad() {
    this.startGame();
  },

  onUnload() {
    this.clearTimer();
  },

  startGame() {
    var that = this;
    this.clearTimer();
    this.setData({ loading: true });
    api.startChallenge().then(function (res) {
      var qs = res.questions || [];
      if (!qs.length) {
        that.setData({ loading: false });
        wx.showToast({ title: '暂无题目', icon: 'none' });
        return;
      }
      that.setData({
        loading: false,
        questions: qs,
        totalLevels: res.totalLevels || qs.length,
        levelIndex: 0,
        lives: res.lives || 3,
        timeLeft: res.durationSec || 60,
        score: 0,
        gameOver: false,
        overInfo: null
      });
      that.updateTime();
      that.renderLevel(0);
      that.startTimer();
    }).catch(function (err) {
      that.setData({ loading: false });
      wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
    });
  },

  startTimer() {
    var that = this;
    this.clearTimer();
    this._timer = setInterval(function () {
      var t = that.data.timeLeft - 1;
      if (t <= 0) {
        that.setData({ timeLeft: 0 });
        that.updateTime();
        that.clearTimer();
        that.endGame('timeout');
      } else {
        that.setData({ timeLeft: t });
        that.updateTime();
      }
    }, 1000);
  },

  clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  updateTime() {
    var t = this.data.timeLeft;
    var m = Math.floor(t / 60);
    var s = t % 60;
    var txt = (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
    this.setData({ timeText: txt });
  },

  renderLevel(idx) {
    var qs = this.data.questions;
    var item = qs[idx];
    if (!item) return;
    var q = item.question || {};
    var options = (item.options || []).map(function (tileId, i) {
      return { letter: String.fromCharCode(65 + i), tileId: tileId };
    });
    var correctArr = (item.correctIndices || '').split(',')
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (n) { return !isNaN(n); });
    this.setData({
      q: {
        typeLabel: TYPE_LABELS[item.type] || '听牌挑战',
        stars: '★'.repeat(item.difficulty || 1),
        text: q.text || '',
        tiles: q.tiles || [],
        groups: q.groups || [],
        context: q.context || '',
        hasLaizi: (q.tiles || []).indexOf('laizi') >= 0,
        options: options,
        multiSelect: !!item.multiSelect
      },
      optionStates: options.map(function () { return ''; }),
      selectedIndices: [],
      answered: false,
      isCorrect: false,
      lastExplanation: item.explanation || '',
      correctArr: correctArr
    });
  },

  onSelect(e) {
    if (this.data.answered || this.data.gameOver) return;
    var index = parseInt(e.currentTarget.dataset.index, 10);
    var q = this.data.q;
    if (!q.multiSelect) {
      this.setData({ selectedIndices: [index] });
      this.doAnswer([index]);
      return;
    }
    var selected = this.data.selectedIndices.slice();
    var pos = selected.indexOf(index);
    if (pos >= 0) selected.splice(pos, 1);
    else selected.push(index);
    var states = this.data.optionStates.map(function () { return ''; });
    selected.forEach(function (i) { states[i] = 'selected'; });
    this.setData({ selectedIndices: selected, optionStates: states });
  },

  onConfirm() {
    if (this.data.answered || this.data.gameOver) return;
    if (this.data.selectedIndices.length === 0) {
      wx.showToast({ title: '请选择听牌', icon: 'none' });
      return;
    }
    this.doAnswer(this.data.selectedIndices.slice());
  },

  doAnswer(indices) {
    var correctArr = this.data.correctArr;
    var a = indices.slice().sort();
    var b = correctArr.slice().sort();
    var correct = a.length === b.length && a.every(function (v, i) { return v === b[i]; });
    var states = this.data.optionStates.map(function (_, i) {
      if (correctArr.indexOf(i) >= 0) return 'correct';
      if (indices.indexOf(i) >= 0) return 'wrong';
      return 'dim';
    });
    var lives = this.data.lives - (correct ? 0 : 1);
    var score = this.data.score + (correct ? 10 : 0);
    this.setData({
      answered: true,
      isCorrect: correct,
      optionStates: states,
      lives: lives,
      score: score
    });
  },

  onNext() {
    if (this.data.gameOver) return;
    if (!this.data.isCorrect && this.data.lives <= 0) {
      this.endGame('wrong');
      return;
    }
    var next = this.data.levelIndex + 1;
    if (next >= this.data.totalLevels) {
      this.endGame('clear');
      return;
    }
    this.setData({ levelIndex: next }, function () { this.renderLevel(next); });
  },

  onExit() {
    if (this.data.gameOver) return;
    this.endGame('exit');
  },

  endGame(reason) {
    if (this.data.gameOver) return;
    this.clearTimer();
    var that = this;
    var maxLevel = this.data.levelIndex + 1;
    var base = this.data.score;
    // 时间/生命奖励仅「通关」时发放；中途退出/超时/失败不白送分
    var finished = (reason === 'clear');
    var timeBonus = finished ? this.data.timeLeft : 0;
    var lifeBonus = finished ? this.data.lives * 5 : 0;
    var finalScore = base + timeBonus + lifeBonus;
    var overInfo = {
      reason: reason,
      base: base,
      timeBonus: timeBonus,
      lifeBonus: lifeBonus,
      score: finalScore,
      maxLevel: maxLevel,
      rank: null
    };
    this.setData({ gameOver: true, overInfo: overInfo });
    var app = getApp();
    var u = (app && app.globalData && app.globalData.userInfo) || {};
    api.submitLeaderboard({
      openid: api.getOpenid(),
      nickname: u.nickName || '',
      avatarUrl: u.avatarUrl || '',
      score: finalScore,
      maxLevel: maxLevel
    }).then(function (rank) {
      that.setData({ 'overInfo.rank': rank });
    }).catch(function () {
      // 提交失败不影响结算展示
    });
  },

  restart() {
    this.startGame();
  },

  goLeaderboard() {
    wx.redirectTo({ url: '/pages/leaderboard/index' });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  noop() {}
});
