Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: '/pages/rules/index',
        text: '多人',
        icon: '/assets/icons/rules.svg',
        activeIcon: '/assets/icons/rules-active.svg'
      },
      {
        pagePath: '/pages/records/index',
        text: '记录',
        icon: '/assets/icons/record.svg',
        activeIcon: '/assets/icons/record-active.svg'
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
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      this.setData({ selected: idx });
      if (item.navigate) {
        wx.navigateTo({ url: item.pagePath });
      } else {
        wx.switchTab({ url: item.pagePath });
      }
    }
  }
});
