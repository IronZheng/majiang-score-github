const share = require('../../utils/share');
const rules = require('../../utils/rules-data.js');

Page({
  data: { rule: null },
  onLoad(options) {
    share.enableShareMenu();

    const rule = rules.find((item) => item.id === options.id) || rules[0];
    this.setData({ rule });
    wx.setNavigationBarTitle({ title: rule.title });
  },
  onShareAppMessage() {
    return share.appMessage({
      title: this.data.rule ? `麻将计分器：${this.data.rule.title}` : '麻将计分器：玩法说明'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: this.data.rule ? `麻将计分器：${this.data.rule.title}` : '麻将计分器：玩法说明'
    });
  }
});
