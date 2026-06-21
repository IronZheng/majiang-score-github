const CONTACT_WECHAT = 'dreamnev';
const CONTACT_PHONE = '19006411743';
const CONTACT_QR_PLACEHOLDER = '/assets/contact/dreamnev-wechat-placeholder.svg';

Page({
  data: {
    wechat: CONTACT_WECHAT,
    phone: CONTACT_PHONE,
    qrImageSrc: CONTACT_QR_PLACEHOLDER,
    qrIsPlaceholder: true
  },

  copyWechat() {
    wx.setClipboardData({
      data: CONTACT_WECHAT,
      success: () => {
        wx.showToast({ title: '微信号已复制', icon: 'success' });
      }
    });
  },

  callPhone() {
    wx.makePhoneCall({
      phoneNumber: CONTACT_PHONE,
      fail: (error) => {
        if (error && /cancel/i.test(error.errMsg || '')) return;
        wx.showToast({ title: '暂时无法拨号', icon: 'none' });
      }
    });
  },

  previewContactQr() {
    wx.previewImage({
      current: this.data.qrImageSrc,
      urls: [this.data.qrImageSrc],
      fail: () => {
        wx.showToast({ title: '暂时无法预览二维码', icon: 'none' });
      }
    });
  },

  onQrError() {
    if (this.data.qrImageSrc === CONTACT_QR_PLACEHOLDER) return;
    this.setData({
      qrImageSrc: CONTACT_QR_PLACEHOLDER,
      qrIsPlaceholder: true
    });
  }
});
