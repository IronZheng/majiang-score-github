const share = require('../../utils/share');

const CONTACT_WECHAT = 'dreamnev';
const CONTACT_PHONE = '19006411743';

const STUDIO_SERVICES = [
  {
    key: 'ai-workflow',
    icon: '/assets/studio/service-ai-workflow.svg',
    title: '企业 AI 工作流',
    tags: ['流程自动化', '智能协同']
  },
  {
    key: 'mini-program',
    icon: '/assets/studio/service-mini-program.svg',
    title: '企业小程序开发',
    tags: ['微信生态', '业务上线']
  },
  {
    key: 'factory-quotation',
    icon: '/assets/studio/service-factory-quotation.svg',
    title: '工厂报价电子化',
    tags: ['报价管理', '数字化']
  },
  {
    key: 'erp-crm',
    icon: '/assets/studio/service-erp-crm.svg',
    title: 'ERP / CRM 定制',
    tags: ['进销存', '客户关系']
  },
  {
    key: 'personal-software',
    icon: '/assets/studio/service-personal-software.svg',
    title: '个人软件定制',
    tags: ['按需开发', '独立交付']
  },
  {
    key: 'app-custom',
    icon: '/assets/studio/service-app-custom.svg',
    title: 'APP 定制',
    tags: ['iOS / Android', '移动端']
  }
];

const STUDIO_PRODUCTS = [
  {
    id: 'majiang-score',
    name: '麻将计分器',
    desc: '朋友聚会时简单好用的多人计分工具',
    icon: '麻',
    status: '当前产品',
    current: true,
    appId: '',
    path: '/pages/scoring-setup/index'
  },
  {
    id: 'coming-soon',
    name: '更多产品',
    desc: '实用、有趣的产品正在持续开发中',
    icon: '+',
    status: '持续上线',
    placeholder: true,
    appId: '',
    path: ''
  }
];

Page({
  data: {
    wechat: CONTACT_WECHAT,
    phone: CONTACT_PHONE,
    studioServices: STUDIO_SERVICES,
    studioProducts: STUDIO_PRODUCTS
  },

  onShow() {
    share.enableShareMenu();
  },

  copyWechat() {
    wx.setClipboardData({
      data: CONTACT_WECHAT,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'success' })
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

  openProduct(e) {
    const index = Number(e.currentTarget.dataset.index);
    const product = this.data.studioProducts[index];
    if (!product) return;

    if (product.current) {
      wx.switchTab({ url: product.path || '/pages/scoring-setup/index' });
      return;
    }

    if (product.appId) {
      wx.navigateToMiniProgram({
        appId: product.appId,
        path: product.path || '',
        fail: () => wx.showToast({ title: '暂时无法打开该产品', icon: 'none' })
      });
      return;
    }

    wx.showToast({ title: '更多产品正在准备中', icon: 'none' });
  },

  onShareAppMessage() {
    return share.appMessage({
      title: '比特光年工作室：软件开发与企业 AI 定制'
    });
  },

  onShareTimeline() {
    return share.timeline({
      title: '比特光年工作室：软件开发与企业 AI 定制'
    });
  }
});
