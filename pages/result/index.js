const { getHistory } = require('../../utils/storage');
const share = require('../../utils/share');
const playerAvatars = require('../../utils/player-avatars');

const AVATARS = playerAvatars;
const CANVAS_WIDTH = 690;
const QR_IMAGE_SRC = '/assets/code.jpg';
const POSTER_MARGIN = 30;
const POSTER_HERO_HEIGHT = 380;
const POSTER_RANK_HEADER = 72;
const POSTER_RANK_ROW = 54;
const POSTER_ROUND_HEADER = 62;
const POSTER_ROUND_SCORE_ROW = 40;
const POSTER_QR_HEIGHT = 450;
const POSTER_MIN_HEIGHT = 1180;
const POSTER_GAP = 16;

const pad2 = (value) => String(value).padStart(2, '0');
const normalizeLocalImagePath = (path) => {
  const value = String(path || '').trim();
  if (!value) return QR_IMAGE_SRC;
  if (/^(wxfile:\/\/|https?:\/\/|data:)/.test(value)) return value;
  return value.startsWith('/') ? value : `/${value}`;
};
const formatPosterDate = (value) => {
  const date = new Date(value || Date.now());
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
};

const calcPosterHeight = (roundList = []) => {
  const rankingHeight = POSTER_RANK_HEADER + 4 * POSTER_RANK_ROW + 18;
  const roundAreaHeight = roundList.length
    ? 50 + roundList.reduce((sum, round) => sum + POSTER_ROUND_HEADER + Math.max(round.scores.length, 1) * POSTER_ROUND_SCORE_ROW + 18 + 14, 0)
    : 142 + POSTER_GAP;
  return Math.max(
    POSTER_MIN_HEIGHT,
    POSTER_MARGIN + POSTER_HERO_HEIGHT + POSTER_GAP + rankingHeight + POSTER_GAP + roundAreaHeight + 10 + POSTER_QR_HEIGHT + POSTER_MARGIN
  );
};

Page({
  data: { record: null, roundList: [], posterHeight: 980, medals: ['🥇', '🥈', '🥉'] },
  onLoad(options) {
    share.enableShareMenu();

    const history = getHistory();
    const record = history.find((item) => item.id === options.id) || history[0] || null;
    if (record?.tableFee) {
      record.tableFee = {
        enabled: Boolean(record.tableFee.enabled),
        score: Number(record.tableFee.score) || 0,
        records: Array.isArray(record.tableFee.records) ? record.tableFee.records : []
      };
    }
    const avatarMap = {};
    (record?.players || []).forEach((p, i) => { avatarMap[p.id] = p.avatarUrl || AVATARS[i % AVATARS.length]; });

    const map = {};
    (record?.rounds || []).forEach((r) => {
      if (!map[r.round]) map[r.round] = [];
      map[r.round].push({ ...r, playerAvatar: r.playerAvatar || avatarMap[r.playerId] || AVATARS[0] });
    });
    const roundList = Object.keys(map).map((round) => ({ round: Number(round), scores: map[round] })).sort((a, b) => a.round - b.round);
    const posterHeight = calcPosterHeight(roundList);

    // 计算对局统计
    const stats = this.calcStats(record, roundList);
    const chartHeight = 400 + Math.max(roundList.length, 1) * 36;

    this.setData({ record, roundList, posterHeight, stats, chartHeight });
    // 统计图延迟绘制（等待 canvas 渲染）
    if (stats) {
      setTimeout(() => this.drawStatsChart(stats), 300);
    }
  },
  onShareAppMessage() {
    return share.appMessage({
      title: '麻将计分器：来看看这局战绩'
    });
  },
  onShareTimeline() {
    return share.timeline({
      title: '麻将计分器：来看看这局战绩'
    });
  },
  previewPoster() {
    if (!this.data.record) {
      wx.showToast({ title: '暂无战绩可预览', icon: 'none' });
      return;
    }
    this.buildPoster((tempFilePath) => wx.previewImage({ current: tempFilePath, urls: [tempFilePath] }));
  },
  savePoster() {
    if (!this.data.record) {
      wx.showToast({ title: '暂无战绩可保存', icon: 'none' });
      return;
    }
    this.buildPoster((tempFilePath) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => wx.showToast({ title: '保存失败，请检查权限', icon: 'none' })
      });
    });
  },
  buildPoster(cb) {
    const { posterHeight } = this.data;
    this.ensurePosterAssets()
      .then(() => {
        this.drawPoster(() => {
          wx.canvasToTempFilePath({
            canvasId: 'posterCanvas',
            destWidth: CANVAS_WIDTH,
            destHeight: posterHeight,
            success: (res) => cb(res.tempFilePath),
            fail: () => wx.showToast({ title: '生成图片失败', icon: 'none' })
          }, this);
        });
      })
      .catch(() => {
        wx.showToast({ title: '加载二维码失败', icon: 'none' });
      });
  },
  ensurePosterAssets() {
    if (this._posterAssetPromise && this._posterQrPath) return this._posterAssetPromise;

    this._posterAssetPromise = new Promise((resolve) => {
      wx.getImageInfo({
        src: QR_IMAGE_SRC,
        success: (res) => {
          this._posterQrPath = normalizeLocalImagePath(res.path || res.tempFilePath || QR_IMAGE_SRC);
          resolve(this._posterQrPath);
        },
        fail: () => {
          this._posterQrPath = normalizeLocalImagePath(QR_IMAGE_SRC);
          resolve(this._posterQrPath);
        }
      });
    });

    return this._posterAssetPromise;
  },
  drawPoster(done) {
    const { record, roundList, posterHeight } = this.data;
    const ctx = wx.createCanvasContext('posterCanvas', this);
    const palette = {
      bg: '#fffaf6',
      card: '#ffffff',
      border: '#f0e1d7',
      text: '#1f2937',
      muted: '#6b7280',
      accent: '#e49b73',
      accentDeep: '#b86142',
      accentSoft: '#fff1e8',
      inkSoft: '#3f3a37',
      greenSoft: '#edf7ef',
      green: '#5f8f6a',
      redSoft: '#fff0ee',
      red: '#c66d61'
    };
    const drawRoundRect = (x, y, w, h, r, fill, stroke) => {
      const radius = Math.min(r, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.arcTo(x + w, y, x + w, y + radius, radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
      ctx.lineTo(x + radius, y + h);
      ctx.arcTo(x, y + h, x, y + h - radius, radius);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
      if (fill) {
        ctx.setFillStyle(fill);
        ctx.fill();
      }
      if (stroke) {
        ctx.setStrokeStyle(stroke);
        ctx.stroke();
      }
    };

    const fitText = (text, maxWidth) => {
      const raw = String(text || '');
      if (!raw) return '';
      if (ctx.measureText(raw).width <= maxWidth) return raw;

      let end = raw.length;
      while (end > 1 && ctx.measureText(`${raw.slice(0, end)}...`).width > maxWidth) {
        end -= 1;
      }
      return `${raw.slice(0, Math.max(1, end - 1))}...`;
    };

    const drawText = (text, x, y, size, color, maxWidth) => {
      ctx.setFillStyle(color);
      ctx.setFontSize(size);
      ctx.fillText(maxWidth ? fitText(text, maxWidth) : String(text || ''), x, y);
    };

    const drawCenteredText = (text, centerX, y, size, color, maxWidth) => {
      ctx.setFillStyle(color);
      ctx.setFontSize(size);
      const output = maxWidth ? fitText(text, maxWidth) : String(text || '');
      const width = ctx.measureText(output).width;
      ctx.fillText(output, centerX - width / 2, y);
    };

    const drawRightText = (text, rightX, y, size, color, maxWidth) => {
      ctx.setFillStyle(color);
      ctx.setFontSize(size);
      const output = maxWidth ? fitText(text, maxWidth) : String(text || '');
      const width = ctx.measureText(output).width;
      ctx.fillText(output, rightX - width, y);
    };

    ctx.setFillStyle(palette.bg);
    ctx.fillRect(0, 0, CANVAS_WIDTH, posterHeight);

    const safeRanking = record.ranking || [];
    const winner = safeRanking[0] || { name: '-', score: 0 };
    const heroX = POSTER_MARGIN;
    const heroY = POSTER_MARGIN;
    const heroW = CANVAS_WIDTH - POSTER_MARGIN * 2;

    drawRoundRect(heroX, heroY, heroW, POSTER_HERO_HEIGHT, 34, '#f0a47d');
    drawRoundRect(heroX + 18, heroY + 18, heroW - 36, POSTER_HERO_HEIGHT - 36, 28, 'rgba(255,255,255,0.18)');
    drawRoundRect(heroX + heroW - 152, heroY + 26, 112, 42, 21, 'rgba(255,255,255,0.28)');
    drawCenteredText('分享战绩', heroX + heroW - 96, heroY + 54, 18, '#fffaf6', 96);
    drawText('麻将计分器', heroX + 30, heroY + 58, 24, '#fffaf6', 220);
    drawRightText(formatPosterDate(record.finishedAt), heroX + heroW - 30, heroY + 96, 20, '#fff8f2', 150);

    drawText('本局战绩', heroX + 30, heroY + 164, 62, '#ffffff', 300);
    drawText('本局赢家', heroX + 34, heroY + 226, 24, '#fff8f2', 180);
    const winnerScoreText = `${winner.score}分`;
    ctx.setFontSize(56);
    const winnerScoreWidth = Math.min(ctx.measureText(winnerScoreText).width, 220);
    drawText(winner.name, heroX + 34, heroY + 280, 50, '#ffffff', heroW - 98 - winnerScoreWidth);
    drawRightText(winnerScoreText, heroX + heroW - 34, heroY + 282, 56, '#ffffff', 220);

    const heroStatsH = 56;
    const heroStatsY = heroY + POSTER_HERO_HEIGHT - 18 - heroStatsH - 4;
    drawRoundRect(heroX + 30, heroStatsY, heroW - 60, heroStatsH, 22, 'rgba(255,255,255,0.22)');
    const heroStats = [
      { label: '人数', value: `${record.players.length}人` },
      { label: '回合', value: `${record.totalRounds || 1}轮` },
      { label: '分差', value: `${Math.abs((safeRanking[0]?.score || 0) - (safeRanking[safeRanking.length - 1]?.score || 0))}分` }
    ];
    const heroStatW = (heroW - 60) / 3;
    heroStats.forEach((item, index) => {
      const statX = heroX + 30 + index * heroStatW;
      drawCenteredText(item.label, statX + heroStatW / 2, heroStatsY + 22, 18, '#fff2ea', heroStatW - 20);
      drawCenteredText(item.value, statX + heroStatW / 2, heroStatsY + 47, 26, '#ffffff', heroStatW - 20);
    });

    let y = heroY + POSTER_HERO_HEIGHT + POSTER_GAP;
    const rankRows = safeRanking.slice(0, 4);
    const rankCardH = POSTER_RANK_HEADER + 4 * POSTER_RANK_ROW + 18;
    drawRoundRect(POSTER_MARGIN, y, heroW, rankCardH, 28, palette.card, palette.border);
    drawText('最终排名', POSTER_MARGIN + 28, y + 44, 31, palette.text, 220);
    drawRightText('分数', CANVAS_WIDTH - POSTER_MARGIN - 28, y + 44, 22, palette.muted, 100);

    const rankColors = ['#fff0e8', '#f7f2ed', '#fff3f4', '#f7f7f8'];
    rankRows.forEach((player, index) => {
      const rowY = y + POSTER_RANK_HEADER + index * POSTER_RANK_ROW;
      drawRoundRect(POSTER_MARGIN + 20, rowY, heroW - 40, 44, 16, rankColors[index] || '#fffaf6');
      drawRoundRect(POSTER_MARGIN + 36, rowY + 7, 32, 30, 15, index === 0 ? palette.accent : '#ffffff', index === 0 ? null : '#efe6df');
      drawCenteredText(String(index + 1), POSTER_MARGIN + 52, rowY + 29, 18, index === 0 ? '#ffffff' : palette.muted, 28);
      drawText(player.name, POSTER_MARGIN + 84, rowY + 30, 27, palette.text, 330);
      drawRightText(`${player.score}分`, CANVAS_WIDTH - POSTER_MARGIN - 38, rowY + 30, 28, index === 0 ? palette.accentDeep : palette.text, 150);
    });

    y += rankCardH + POSTER_GAP;

    if (roundList.length) {
      drawText('回合明细', POSTER_MARGIN, y + 28, 30, palette.text, 240);
      drawRightText(`共${roundList.length}轮`, CANVAS_WIDTH - POSTER_MARGIN, y + 28, 22, palette.muted, 160);
      y += 46;

      roundList.forEach((round) => {
        const blockH = POSTER_ROUND_HEADER + Math.max(round.scores.length, 1) * POSTER_ROUND_SCORE_ROW + 18;
        drawRoundRect(POSTER_MARGIN, y, heroW, blockH, 24, palette.card, palette.border);
        drawRoundRect(POSTER_MARGIN + 24, y + 18, 120, 32, 16, palette.accentSoft);
        drawCenteredText(`第${round.round}轮`, POSTER_MARGIN + 84, y + 41, 20, palette.red, 104);

        let rowY = y + POSTER_ROUND_HEADER + 25;
        round.scores.forEach((score) => {
          drawText(score.playerName, POSTER_MARGIN + 28, rowY, 24, palette.inkSoft, 350);
          const deltaText = `${score.delta > 0 ? '+' : ''}${score.delta}`;
          const deltaBg = score.delta >= 0 ? palette.redSoft : palette.greenSoft;
          const deltaColor = score.delta >= 0 ? palette.red : palette.green;
          ctx.setFontSize(22);
          const deltaW = Math.max(92, ctx.measureText(deltaText).width + 34);
          const deltaX = CANVAS_WIDTH - POSTER_MARGIN - 28 - deltaW;
          drawRoundRect(deltaX, rowY - 24, deltaW, 36, 18, deltaBg);
          drawCenteredText(deltaText, deltaX + deltaW / 2, rowY + 1, 22, deltaColor, deltaW - 18);
          rowY += POSTER_ROUND_SCORE_ROW;
        });

        y += blockH + 14;
      });
    } else {
      drawRoundRect(POSTER_MARGIN, y, heroW, 142, 24, palette.card, palette.border);
      drawText('回合明细', POSTER_MARGIN + 28, y + 46, 30, palette.text, 220);
      drawText('本局没有记录单回合操作', POSTER_MARGIN + 28, y + 90, 22, palette.muted, heroW - 56);
      y += 142 + POSTER_GAP;
    }

    y += 10;
    drawRoundRect(POSTER_MARGIN, y, heroW, POSTER_QR_HEIGHT, 32, '#ffffff', palette.border);
    drawCenteredText('扫码记录下一局', CANVAS_WIDTH / 2, y + 56, 34, palette.text, heroW - 80);
    drawCenteredText('长按识别小程序码', CANVAS_WIDTH / 2, y + 92, 23, palette.muted, heroW - 80);

    const qrSize = 224;
    const qrX = (CANVAS_WIDTH - qrSize) / 2;
    const qrY = y + 132;
    drawRoundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 36, palette.accentSoft, palette.border);
    drawRoundRect(qrX - 7, qrY - 7, qrSize + 14, qrSize + 14, 24, '#ffffff');
    try {
      ctx.drawImage(normalizeLocalImagePath(this._posterQrPath || QR_IMAGE_SRC), qrX, qrY, qrSize, qrSize);
    } catch (e) {
      ctx.setFillStyle('#c9b8ac');
      ctx.setFontSize(22);
      ctx.fillText('二维码加载中', qrX + 38, qrY + 118);
    }

    drawCenteredText('麻将计分器', CANVAS_WIDTH / 2, y + 416, 21, palette.accentDeep, heroW - 80);

    ctx.draw(false, () => setTimeout(done, 200));
  },
  calcStats(record, roundList) {
    const players = record.players || [];
    const rounds = record.rounds || [];
    if (!players.length || !roundList.length) return null;

    // 胜负差
    const ranking = record.ranking || players.slice().sort((a, b) => b.score - a.score);
    const gap = (ranking[0]?.score || 0) - (ranking[ranking.length - 1]?.score || 0);

    // 每位玩家每回合的分数变化，用于计算稳定度和走势
    const playerScoresPerRound = {};
    players.forEach((p) => { playerScoresPerRound[p.id] = { name: p.name, avatarUrl: p.avatarUrl, totals: [], deltas: [] }; });

    // 按回合顺序累计分数
    roundList.forEach((roundItem) => {
      players.forEach((p) => {
        const prev = playerScoresPerRound[p.id].totals.length
          ? playerScoresPerRound[p.id].totals[playerScoresPerRound[p.id].totals.length - 1]
          : 0;
        const delta = roundItem.scores
          .filter((s) => s.playerId === p.id)
          .reduce((sum, s) => sum + s.delta, 0);
        playerScoresPerRound[p.id].totals.push(prev + delta);
        playerScoresPerRound[p.id].deltas.push(delta);
      });
    });

    // 走势数据
    const trendLabels = roundList.map((r) => `R${r.round}`);
    const trendSeries = players.map((p) => ({
      name: p.name,
      data: playerScoresPerRound[p.id].totals
    }));

    // 手气最佳：单回合 delta 最大的玩家
    let bestRound = null;
    let bestRoundDelta = -Infinity;
    rounds.forEach((r) => {
      if (r.delta > bestRoundDelta) {
        bestRoundDelta = r.delta;
        bestRound = { ...r, round: r.round };
      }
    });

    // 最稳选手：每回合delta的方差最小
    let mostStable = null;
    let minVariance = Infinity;
    players.forEach((p) => {
      const deltas = playerScoresPerRound[p.id].deltas;
      if (!deltas.length) return;
      const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
      if (variance < minVariance) {
        minVariance = variance;
        mostStable = { name: p.name, variance: Math.round(variance * 10) / 10 };
      }
    });

    return {
      gap,
      bestRound,
      mostStable,
      trendLabels,
      trendSeries,
      playerCount: players.length,
      totalRounds: record.totalRounds || roundList.length
    };
  },
  drawStatsChart(stats) {
    if (!stats || !stats.trendSeries.length) return;

    const ctx = wx.createCanvasContext('statsCanvas', this);
    const width = 670;
    const margin = { top: 60, right: 30, bottom: 50, left: 60 };
    const chartW = width - margin.left - margin.right;
    const chartH = 320;
    const height = margin.top + chartH + margin.bottom;

    const colors = ['#e49b73', '#5f8f6a', '#6b8fcf', '#c66d61', '#8a7bd6', '#d4a900', '#4dacb8', '#c98fba'];

    // 背景
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    // 计算Y轴范围
    let yMin = Infinity, yMax = -Infinity;
    stats.trendSeries.forEach((s) => {
      s.data.forEach((v) => {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      });
    });
    if (yMin === yMax) { yMin -= 10; yMax += 10; }
    const yRange = yMax - yMin || 1;
    const yTickCount = 5;
    const xStep = stats.trendLabels.length > 1 ? chartW / (stats.trendLabels.length - 1) : chartW;

    // Y轴刻度和网格线
    ctx.setStrokeStyle('#f0e8e2');
    ctx.setLineWidth(1);
    ctx.setFontSize(18);
    ctx.setFillStyle('#9ca3af');
    for (let i = 0; i <= yTickCount; i++) {
      const val = yMin + (yRange / yTickCount) * i;
      const y = margin.top + chartH - (chartH / yTickCount) * i;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartW, y);
      ctx.stroke();
      ctx.setTextAlign('right');
      ctx.fillText(Math.round(val).toString(), margin.left - 12, y + 6);
    }

    // X轴标签
    ctx.setTextAlign('center');
    ctx.setFillStyle('#9ca3af');
    stats.trendLabels.forEach((label, i) => {
      const x = margin.left + xStep * i;
      ctx.fillText(label, x, margin.top + chartH + 32);
    });

    // 绘制折线
    stats.trendSeries.forEach((series, si) => {
      const color = colors[si % colors.length];
      ctx.setStrokeStyle(color);
      ctx.setLineWidth(3);
      ctx.setLineCap('round');
      ctx.setLineJoin('round');

      ctx.beginPath();
      series.data.forEach((val, i) => {
        const x = margin.left + xStep * i;
        const y = margin.top + chartH - ((val - yMin) / yRange) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 数据点
      series.data.forEach((val, i) => {
        const x = margin.left + xStep * i;
        const y = margin.top + chartH - ((val - yMin) / yRange) * chartH;
        ctx.setFillStyle(color);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.setFillStyle('#ffffff');
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });

    ctx.draw();

    // 图例区域
    const legendY = margin.top + chartH + 50;
    ctx.setFontSize(20);
    ctx.setTextAlign('left');
    const legendW = width / Math.min(stats.trendSeries.length, 4);
    stats.trendSeries.forEach((series, si) => {
      const color = colors[si % colors.length];
      const col = si % 4;
      const row = Math.floor(si / 4);
      const lx = col * legendW + 26;
      const ly = legendY + row * 34;
      ctx.setFillStyle(color);
      ctx.fillRect(lx, ly - 12, 18, 18);
      ctx.setFillStyle('#374151');
      ctx.fillText(series.name, lx + 28, ly + 4);
    });

    this.setData({ chartTotalHeight: height + Math.ceil(stats.trendSeries.length / 4) * 34 + 16 });
  }
});
