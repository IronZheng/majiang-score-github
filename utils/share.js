const DEFAULT_SHARE = {
  title: '麻将计分器：朋友聚会记分、战绩分享',
  path: '/pages/scoring-setup/index'
};

function enableShareMenu() {
  if (!wx.showShareMenu) return;
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  });
}

function appMessage(options = {}) {
  return {
    ...DEFAULT_SHARE,
    ...options
  };
}

function timeline(options = {}) {
  return {
    title: options.title || DEFAULT_SHARE.title,
    query: options.query || ''
  };
}

module.exports = {
  enableShareMenu,
  appMessage,
  timeline
};
