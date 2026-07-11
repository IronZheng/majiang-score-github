const api = require('../../utils/api');

const TYPE_LABELS = {
  tile_recognition: '牌型识别',
  score_calculation: '算番算分',
  strategy: '策略选择',
  tingpai: '听牌挑战'
};

const RANK_KEYS = {
  '青铜': 'bronze',
  '白银': 'silver',
  '黄金': 'gold',
  '钻石': 'diamond',
  '雀神': 'supreme'
};

Page({
  data: {
    loading: true,
    totalCount: 0,
    progressPercent: 0,
    activeIndex: 0,

    // 当前题目视图模型
    q: { typeLabel: '', stars: '', text: '', tiles: [], context: '', options: [], multiSelect: false },
    optionStates: [],
    selectedIndices: [],
    answered: false,
    isCorrect: false,
    lastResult: null,

    // 顶部状态
    totalScore: 0,
    streak: 0,
    rank: '青铜',
    rankKey: 'bronze',
    accuracyRate: 0,
    completed: false,
    alreadyDone: false,
    rankUpgraded: false,
    showComplete: false,
    todayAnswered: 0,
    todayCorrect: 0
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadData();
  },

  ensureOpenid() {
    return new Promise(function (resolve) {
      var oid = api.getOpenid();
      if (oid) return resolve(oid);
      var app = getApp();
      if (app && app.fetchOpenidSilently) {
        app.fetchOpenidSilently();
      }
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        var o = api.getOpenid();
        if (o || tries > 20) {
          clearInterval(timer);
          resolve(o);
        }
      }, 300);
    });
  },

  loadData() {
    var that = this;
    this.setData({ loading: true });
    this.ensureOpenid().then(function () {
      Promise.all([api.getTodayQuestions(), api.getProgress()])
        .then(function (res) {
          var today = res[0] || {};
          var progress = res[1] || {};
          var questions = today.questions || [];
          var totalCount = questions.length;
          var completed = !!(today.completed);
          var startIdx = completed ? totalCount : Math.min(today.currentIndex || 0, Math.max(0, totalCount - 1));
          if (startIdx >= questions.length) startIdx = Math.max(0, questions.length - 1);

          that.setData({
            loading: false,
            sessionId: today.sessionId,
            completed: completed,
            alreadyDone: completed,
            totalCount: totalCount,
            totalScore: today.totalScore || progress.totalScore || 0,
            streak: progress.streak || 0,
            rank: today.rank || progress.rank || '青铜',
            rankKey: RANK_KEYS[today.rank || progress.rank || '青铜'] || 'bronze',
            accuracyRate: progress.accuracyRate || 0,
            todayAnswered: progress.todayAnswered || 0,
            todayCorrect: progress.todayCorrect || 0,
            activeIndex: completed ? questions.length : startIdx,
            questions: questions
          });
          if (!completed) {
            that.renderActive();
          } else {
            that.computeDots(questions.length);
          }
        })
        .catch(function (err) {
          that.setData({ loading: false });
          wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
        });
    });
  },

  renderActive() {
    var questions = this.data.questions || [];
    var idx = this.data.activeIndex;
    var item = questions[idx];
    if (!item) {
      this.computeDots(idx);
      return;
    }
    var q = item.question || {};
    var options = (item.options || []).map(function (text, i) {
      return { letter: String.fromCharCode(65 + i), text: text };
    });
    this.setData({
      q: {
        typeLabel: TYPE_LABELS[item.type] || '听牌挑战',
        stars: '★'.repeat(item.difficulty || 1),
        text: q.text || '',
        tiles: q.tiles || [],
        context: q.context || '',
        options: options,
        multiSelect: !!item.multiSelect
      },
      optionStates: options.map(function () { return ''; }),
      selectedIndices: [],
      answered: false,
      isCorrect: false,
      lastResult: null
    });
    this.computeDots(idx);
  },

  computeDots(activeIdx) {
    var total = this.data.totalCount || 0;
    var percent = total > 0 ? Math.round((activeIdx / total) * 100) : 0;
    this.setData({ progressPercent: percent });
  },

  // 选择选项：单选立即提交；多选切换选中态，等待"确定"
  onSelect(e) {
    if (this.data.answered || this.data.loading) return;
    var index = parseInt(e.currentTarget.dataset.index, 10);
    var q = this.data.q;

    if (!q.multiSelect) {
      this.setData({ selectedIndices: [index] });
      this.doSubmit([index]);
      return;
    }

    var selected = this.data.selectedIndices.slice();
    var pos = selected.indexOf(index);
    if (pos >= 0) {
      selected.splice(pos, 1);
    } else {
      selected.push(index);
    }
    var states = this.data.optionStates.map(function () { return ''; });
    selected.forEach(function (i) { states[i] = 'selected'; });
    this.setData({ selectedIndices: selected, optionStates: states });
  },

  // 多选模式下点击"确定"提交
  onConfirm() {
    if (this.data.answered || this.data.loading) return;
    if (this.data.selectedIndices.length === 0) {
      wx.showToast({ title: '请选择听牌', icon: 'none' });
      return;
    }
    this.doSubmit(this.data.selectedIndices.slice());
  },

  doSubmit(indices) {
    var that = this;
    var questions = this.data.questions || [];
    var item = questions[this.data.activeIndex];
    if (!item) return;

    api.submitAnswer({
      openid: api.getOpenid(),
      sessionId: this.data.sessionId,
      questionId: item.id,
      selectedIndices: indices
    }).then(function (result) {
      var correctArr = (result.correctIndices || '').split(',').map(function (s) { return parseInt(s, 10); }).filter(function (n) { return !isNaN(n); });
      var states = that.data.optionStates.map(function (_, i) {
        if (correctArr.indexOf(i) >= 0) return 'correct';
        if (indices.indexOf(i) >= 0) return 'wrong';
        return 'dim';
      });
      that.setData({
        answered: true,
        isCorrect: !!result.correct,
        lastResult: result,
        optionStates: states,
        totalScore: result.totalScore,
        streak: result.streak,
        rank: result.rank,
        rankKey: RANK_KEYS[result.rank] || 'bronze',
        rankUpgraded: !!result.rankUpgraded,
        todayAnswered: that.data.todayAnswered + 1,
        todayCorrect: result.correct ? that.data.todayCorrect + 1 : that.data.todayCorrect
      });
      if (result.rankUpgraded) {
        wx.showToast({ title: '段位升级：' + result.rank, icon: 'none' });
      }
    }).catch(function (err) {
      wx.showToast({ title: (err && err.message) || '提交失败', icon: 'none' });
    });
  },

  onNext() {
    var last = this.data.lastResult;
    if (last && last.sessionCompleted) {
      this.setData({ showComplete: true });
      return;
    }
    var next = this.data.activeIndex + 1;
    if (next >= (this.data.questions || []).length) {
      this.setData({ showComplete: true });
      return;
    }
    this.setData({ activeIndex: next }, function () {
      this.renderActive();
    });
  },

  openComplete() {
    this.setData({ showComplete: true });
  },

  closeComplete() {
    this.setData({ showComplete: false });
  },

  restartChallenge() {
    this.setData({ showComplete: false, completed: false, alreadyDone: false });
    this.loadData();
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '麻将听牌挑战，你能听对几张牌？',
      path: '/pages/game-quiz/index'
    };
  }
});
