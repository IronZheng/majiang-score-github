const { getHistory } = require('../../utils/storage');

const AVATARS = ['😀', '😎', '🀄', '🐯', '🐼', '🦊', '🐬', '🦁'];

Page({
  data: { record: null, roundList: [], posterHeight: 900, medals: ['🥇', '🥈', '🥉'] },
  onLoad(options) {
    const history = getHistory();
    const record = history.find((item) => item.id === options.id) || history[0] || null;
    const emojiMap = {};
    (record?.players || []).forEach((p, i) => { emojiMap[p.id] = AVATARS[i % AVATARS.length]; });

    const map = {};
    (record?.rounds || []).forEach((r) => {
      if (!map[r.round]) map[r.round] = [];
      map[r.round].push({ ...r, playerEmoji: emojiMap[r.playerId] || '🙂' });
    });
    const roundList = Object.keys(map).map((round) => ({ round: Number(round), scores: map[round] })).sort((a, b) => a.round - b.round);
    const posterHeight = 380 + (record?.ranking?.length || 0) * 58 + roundList.length * 46 + (record?.rounds?.length || 0) * 36;
    this.setData({ record, roundList, posterHeight });
  },
  onShareAppMessage() {
    return { title: '我刚完成一局麻将计分，来看看战绩！', path: '/pages/scoring-setup/index' };
  },
  previewPoster() {
    this.buildPoster((tempFilePath) => wx.previewImage({ current: tempFilePath, urls: [tempFilePath] }));
  },
  savePoster() {
    this.buildPoster((tempFilePath) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => wx.showToast({ title: '保存失败，请检查权限', icon: 'none' })
      });
    });
  },
  buildPoster(cb) {
    this.drawPoster(() => {
      wx.canvasToTempFilePath({
        canvasId: 'posterCanvas',
        success: (res) => cb(res.tempFilePath),
        fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
      }, this);
    });
  },
  drawPoster(done) {
    const { record, roundList, posterHeight, medals } = this.data;
    const ctx = wx.createCanvasContext('posterCanvas', this);
    let y = 0;
    ctx.setFillStyle('#f4f9ff'); ctx.fillRect(0, 0, 690, posterHeight);
    ctx.setFillStyle('#2f7ac9'); ctx.fillRect(0, 0, 690, 96);
    ctx.setFillStyle('#ffffff'); ctx.setFontSize(34); ctx.fillText('🀄 麻将战绩结算', 24, 62);

    y = 130;
    ctx.setFillStyle('#5a7da3'); ctx.setFontSize(20); ctx.fillText(`时间：${new Date(record.finishedAt).toLocaleString()}`, 24, y);
    y += 28;
    ctx.fillText(`总回合：${record.totalRounds || 1} ｜ 玩家：${record.players.length}人`, 24, y);

    y += 36;
    ctx.setFillStyle('#ffffff'); ctx.fillRect(20, y - 24, 650, (record.ranking.length + 1) * 52);
    ctx.setFillStyle('#2f5d88'); ctx.setFontSize(24); ctx.fillText('🏆 最终排名', 34, y + 8);
    y += 50;
    record.ranking.forEach((p, i) => {
      const medal = medals[i] || `第${i + 1}名`;
      ctx.setFillStyle('#1f3f5b'); ctx.setFontSize(22); ctx.fillText(`${medal} ${p.name}`, 34, y);
      ctx.setFillStyle('#2f7ac9'); ctx.fillText(`${p.score}分`, 560, y);
      y += 44;
    });

    y += 24;
    ctx.setFillStyle('#2f5d88'); ctx.setFontSize(24); ctx.fillText('📒 回合明细', 24, y);
    y += 30;
    roundList.forEach((r) => {
      ctx.setFillStyle('#5a7da3'); ctx.setFontSize(20); ctx.fillText(`第${r.round}回合`, 24, y);
      y += 28;
      r.scores.forEach((s) => {
        ctx.setFillStyle('#1f3f5b'); ctx.fillText(`${s.playerEmoji} ${s.playerName}`, 40, y);
        ctx.setFillStyle(s.delta >= 0 ? '#2f9b66' : '#c4455a'); ctx.fillText(`${s.delta > 0 ? '+' : ''}${s.delta}`, 560, y);
        y += 28;
      });
      y += 10;
    });
    ctx.draw(false, () => setTimeout(done, 200));
  }
});
