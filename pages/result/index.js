const { getHistory } = require('../../utils/storage');

const AVATARS = ['😀', '😎', '🀄', '🐯', '🐼', '🦊', '🐬', '🦁'];

Page({
  data: { record: null, roundList: [], posterHeight: 980, medals: ['🥇', '🥈', '🥉'] },
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
    const posterHeight = 520 + (record?.ranking?.length || 0) * 82 + roundList.length * 30 + (record?.rounds?.length || 0) * 40;
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
    ctx.setFillStyle('#f3f8ff');
    ctx.fillRect(0, 0, 690, posterHeight);

    ctx.setFillStyle('#2d6fb6');
    ctx.fillRect(0, 0, 690, 130);
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(36);
    ctx.fillText('麻将战绩海报', 24, 58);
    ctx.setFontSize(22);
    ctx.fillText(`时间 ${new Date(record.finishedAt).toLocaleString()}`, 24, 96);

    let y = 160;
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(20, y, 650, 110);
    ctx.setFillStyle('#295884');
    ctx.setFontSize(24);
    ctx.fillText(`本局 ${record.players.length} 人 · 共 ${record.totalRounds || 1} 回合`, 40, y + 42);
    ctx.setFillStyle('#4b83bd');
    ctx.fillText('TOP 3 冠军榜', 40, y + 82);

    y += 132;
    record.ranking.slice(0, 3).forEach((p, i) => {
      const bg = ['#fff4db', '#edf4ff', '#fff1e8'][i] || '#f6f9ff';
      ctx.setFillStyle(bg);
      ctx.fillRect(20, y, 650, 72);
      ctx.setFillStyle('#1f3f5b');
      ctx.setFontSize(30);
      ctx.fillText(`${medals[i]}  ${p.name}`, 36, y + 46);
      ctx.setFillStyle('#2f7ac9');
      ctx.setFontSize(34);
      ctx.fillText(`${p.score}分`, 530, y + 46);
      y += 84;
    });

    y += 8;
    ctx.setFillStyle('#2f5d88');
    ctx.setFontSize(26);
    ctx.fillText('每回合得分明细', 24, y);
    y += 20;

    roundList.forEach((r) => {
      ctx.setFillStyle('#e8f2ff');
      ctx.fillRect(20, y, 650, 34);
      ctx.setFillStyle('#3b6e9f');
      ctx.setFontSize(20);
      ctx.fillText(`第 ${r.round} 回合`, 34, y + 24);
      y += 40;
      r.scores.forEach((s) => {
        ctx.setFillStyle('#1f3f5b');
        ctx.setFontSize(22);
        ctx.fillText(`${s.playerEmoji} ${s.playerName}`, 40, y + 22);
        ctx.setFillStyle(s.delta >= 0 ? '#1f9d62' : '#d24b5b');
        ctx.fillText(`${s.delta > 0 ? '+' : ''}${s.delta}`, 560, y + 22);
        y += 34;
      });
      y += 8;
    });

    ctx.draw(false, () => setTimeout(done, 200));
  }
});
