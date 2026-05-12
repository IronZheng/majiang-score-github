// 云函数入口文件
const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloud1-d9gunt71q5391b5eb' });

exports.main = async (event, context) => {
  const { phoneCode, nickname, avatarUrl } = event;
  const wxContext = cloud.getWXContext();

  console.log('===== login 云函数 =====');
  console.log('收到参数:', JSON.stringify(event));
  console.log('OPENID:', wxContext.OPENID);
  console.log('APPID:', wxContext.APPID);

  try {
    let phoneNumber = '';
    const openid = wxContext.OPENID || '';

    // ====== 验证必要参数 ======
    if (!openid) {
      console.error('无法获取 OPENID');
      return {
        success: false,
        error: '无法获取用户身份，请重试'
      };
    }

    // ====== 尝试获取手机号（允许失败） ======
    if (phoneCode) {
      try {
        // 通过云开发直连接口获取手机号
        // 文档: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-info/phone-num/getPhoneNumber.html
        const phoneRes = await cloud.callContainer({
          config: { env: 'cloud1-d9gunt71q5391b5eb' },
          path: '/getPhoneNumber',
          method: 'POST',
          data: { code: phoneCode }
        });
        console.log('手机号接口返回:', JSON.stringify(phoneRes));
        if (phoneRes && phoneRes.phone_info) {
          phoneNumber = phoneRes.phone_info.phoneNumber || '';
        }
      } catch (cloudErr) {
        // 云托管未配置或接口无权限，不阻塞登录
        console.log('手机号获取失败（非阻塞）:', cloudErr.message);
      }
    } else {
      console.log('未传入 phoneCode（个人账号无法获取动态令牌），仅使用 OPENID 登录');
    }

    // ====== 组装返回 ======
    const userInfo = {
      openid: openid,
      phoneNumber: phoneNumber,
      nickName: nickname || '玩家',
      avatarUrl: avatarUrl || ''
    };

    console.log('登录成功, userInfo:', JSON.stringify(userInfo));

    return {
      success: true,
      openid: openid,
      phoneNumber: phoneNumber,
      userInfo: userInfo
    };

  } catch (err) {
    console.error('登录异常:', err);
    return {
      success: false,
      error: err.message || '登录失败'
    };
  }
};
