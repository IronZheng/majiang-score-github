Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/scoring-setup/index',
        text: '单人',
        icon: '/assets/icons/score.svg',
        activeIcon: '/assets/icons/score-active.svg'
      },
      {
        pagePath: '/pages/rules/index',
        text: '多人',
        icon: '/assets/icons/rules.svg',
        activeIcon: '/assets/icons/rules-active.svg'
      },
      {
        pagePath: '/pages/game-quiz/index',
        text: '牌技',
        icon: '/assets/icons/quiz.svg',
        activeIcon: '/assets/icons/quiz-active.svg'
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
