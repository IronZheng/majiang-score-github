Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/scoring-setup/index',
        text: '计分',
        icon: '/assets/icons/score.svg',
        activeIcon: '/assets/icons/score-active.svg'
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的',
        icon: '/assets/icons/profile.svg',
        activeIcon: '/assets/icons/profile-active.svg'
      }
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
