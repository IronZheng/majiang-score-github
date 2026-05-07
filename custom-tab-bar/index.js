Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/scoring-setup/index', text: '计分', icon: '🀄', activeIcon: '🎯' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '👤', activeIcon: '😄' }
    ]
  },
  methods: {
    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    }
  }
});
