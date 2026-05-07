const { getHistory } = require('../../utils/storage');

Page({
  data: { record: null },
  onLoad(options) {
    const history = getHistory();
    const record = history.find((item) => item.id === options.id) || history[0] || null;
    this.setData({ record });
  },
  onShareAppMessage() {
    return {
      title: '我刚完成一局麻将计分，来看看战绩！',
      path: '/pages/scoring-setup/index'
    };
  }
});
