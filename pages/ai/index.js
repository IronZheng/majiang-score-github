const aiConfig = require('../../utils/ai-config');

Page({
  data: {
    userInput: '',
    imageUrl: '',
    aiResponse: '',
    loading: false
  },

  lastRequestTime: 0,
  requestInterval: 3000,

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onInputChange(e) {
    this.setData({ userInput: e.detail.value });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) {
          wx.showToast({ title: '图片选择失败', icon: 'none' });
          return;
        }

        this.setData({
          imageUrl: file.tempFilePath,
          aiResponse: ''
        });
      }
    });
  },

  deleteImage() {
    this.setData({
      imageUrl: '',
      aiResponse: ''
    });
  },

  async uploadImage(filePath) {
    const extMatch = filePath.match(/\.(jpg|jpeg|png|webp)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    const cloudPath = `${aiConfig.uploadDir}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const uploadRes = await wx.cloud.uploadFile({
      cloudPath,
      filePath
    });

    if (!uploadRes.fileID) {
      throw new Error('图片上传失败');
    }

    const tempRes = await wx.cloud.getTempFileURL({
      fileList: [uploadRes.fileID]
    });
    const fileInfo = tempRes.fileList && tempRes.fileList[0];

    if (!fileInfo || !fileInfo.tempFileURL) {
      throw new Error('图片临时链接生成失败');
    }

    return fileInfo.tempFileURL;
  },

  async callAI() {
    const { userInput, imageUrl, loading } = this.data;

    if (loading) return;

    if (!imageUrl && !userInput.trim()) {
      wx.showToast({
        title: '请上传手牌或补充描述',
        icon: 'none'
      });
      return;
    }

    const now = Date.now();
    if (now - this.lastRequestTime < this.requestInterval) {
      wx.showToast({
        title: '请求太快了，稍后再试',
        icon: 'none'
      });
      return;
    }

    this.lastRequestTime = now;
    this.setData({
      loading: true,
      aiResponse: ''
    });

    try {
      const imageTempUrl = imageUrl ? await this.uploadImage(imageUrl) : '';
      const res = await wx.cloud.callFunction({
        name: aiConfig.cloudFunctionName,
        data: {
          imageUrl: imageTempUrl,
          text: userInput.trim()
        }
      });

      const result = res.result || {};
      if (!result.success) {
        throw new Error(result.error || 'AI分析失败');
      }

      this.setData({ aiResponse: result.content });
    } catch (err) {
      console.error('AI分析失败:', err);
      wx.showModal({
        title: '分析失败',
        content: err.message || '请换一张清晰的麻将手牌照片，或补充具体牌面',
        showCancel: false,
        confirmText: '知道了'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  clearChat() {
    this.setData({
      userInput: '',
      imageUrl: '',
      aiResponse: ''
    });
  },

  onShareAppMessage() {
    return {
      title: '麻将AI助手 - 智能出牌建议',
      path: '/pages/ai/index'
    };
  }
});
