const avatars = require('./player-avatars');

const SEED_KEY = 'mj_default_profile_seed';

const legacyNames = [
  '东风闲人', '南风老友', '西风听牌', '北风小将', '红中高手', '发财先生', '白板姑娘', '杠上花开',
  '清一色侠', '碰碰胡王', '海底捞月', '自摸星人', '听牌达人', '立直玩家', '雀神预备', '牌桌诗人',
  '春日摸牌', '夏夜听风', '秋水胡牌', '冬雪起手', '橘子茶客', '桂花乌龙', '山城牌友', '江城雀客',
  '西湖听雨', '锦城慢打', '江南小胡', '川麻行家', '红中旅人', '方城过客', '牌局主角', '桌边笑匠',
  '小满自摸', '惊蛰碰牌', '谷雨清听', '立夏开杠', '白露等胡', '寒露收分', '青梅煮茶', '竹影听牌',
  '云上摸风', '月下看牌', '星河坐庄', '晨光起手', '晚风收官', '晴天胡了', '雨夜连庄', '松间小局',
  '梅子熟了', '荷叶听雨', '桂香满桌', '雪落牌声', '小南风', '小西风', '小北风', '小东风',
  '胡牌小队长', '记分小能手', '好运常在', '手气在线', '慢慢起飞', '今天很胡', '稳住能赢', '轻松上桌'
];

const names = [
  '东风寄月', '南风入局', '西窗听牌', '北巷摸鱼', '红中有喜', '发财醒醒', '白板不白', '春风坐庄',
  '一筒望月', '二条听雨', '三万归山', '四喜临门', '五饼半甜', '六六顺手', '七对成诗', '八面来风',
  '九莲灯影', '十拿九稳', '杠上春山', '海底捞星', '河底听泉', '岭上开花', '门前清风', '断幺小侠',
  '清一色梦', '混一色客', '碰碰有声', '平胡不平', '自摸发光', '听牌装忙', '胡了再说', '先碰为敬',
  '小满开胡', '芒种听牌', '白露自摸', '寒露收官', '立夏开杠', '惊蛰碰牌', '谷雨摸鱼', '霜降连庄',
  '春山慢打', '夏夜偷胡', '秋水做牌', '冬雪起手', '月下看牌', '星河坐庄', '松间小局', '竹影听牌',
  '西湖听雨', '锦城摸牌', '江城红中', '山城血流', '姑苏清听', '岭南快胡', '长安坐稳', '江南小番',
  '茶馆牌仙', '巷口雀友', '楼上等胡', '窗边观牌', '牌桌诗人', '手气书生', '摸牌浪子', '听牌少女',
  '不慌先生', '稳住姑娘', '今晚有胡', '好运在手', '轻轻一碰', '慢慢成牌', '悄悄上听', '偷偷加番',
  '小胡同学', '大番预备', '连庄小王', '收分掌柜', '记分先生', '逆风翻盘', '顺手牵分', '笑着胡牌',
  '摸到春天', '碰出彩虹', '杠来好运', '番数会说话', '起手有光', '牌运在线', '今天很胡', '下把更胡',
  '小东风醒了', '小南风来了', '小西风等等', '小北风别跑', '红中眨眼', '发财点头', '白板开窍', '骰子会唱歌'
];

function hashString(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function getLocalProfileSeed() {
  try {
    let seed = wx.getStorageSync(SEED_KEY);
    if (!seed) {
      seed = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      wx.setStorageSync(SEED_KEY, seed);
    }
    return seed;
  } catch (e) {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function pickProfile(seed, offset = 0) {
  const base = hashString(`${seed || getLocalProfileSeed()}:${offset}`);
  const nameIndex = base % names.length;
  const avatarIndex = Math.floor(base / names.length) % avatars.length;
  return {
    nickName: names[nameIndex],
    avatarUrl: avatars[avatarIndex],
    defaultProfileKey: `${nameIndex}-${avatarIndex}`
  };
}

function isDefaultName(value) {
  const name = String(value || '').trim();
  return names.indexOf(name) !== -1 || legacyNames.indexOf(name) !== -1 || /^玩家\d*$/.test(name) || name === '微信用户';
}

function isDefaultAvatar(value) {
  return avatars.indexOf(String(value || '')) !== -1;
}

function applyDefaultUserProfile(userInfo = {}, seed) {
  const user = { ...userInfo };
  const profile = pickProfile(seed || user.openid || user.phoneNumber || user.defaultProfileSeed || getLocalProfileSeed());

  if (!user.nickNameCustomized && (!user.nickName || isDefaultName(user.nickName) || user.defaultProfileAuto)) {
    user.nickName = profile.nickName;
  }

  if (!user.avatarCustomized && (!user.avatarUrl || isDefaultAvatar(user.avatarUrl) || user.defaultProfileAuto)) {
    user.avatarUrl = profile.avatarUrl;
  }

  user.defaultProfileAuto = true;
  user.defaultProfileKey = profile.defaultProfileKey;
  user.defaultProfileSeed = seed || user.openid || user.phoneNumber || user.defaultProfileSeed || '';
  return user;
}

function createPlayerProfile(seed, index) {
  const profile = pickProfile(seed || getLocalProfileSeed(), index + 1);
  return {
    name: profile.nickName,
    avatarUrl: profile.avatarUrl,
    defaultProfileKey: profile.defaultProfileKey
  };
}

module.exports = {
  names,
  avatars,
  getLocalProfileSeed,
  pickProfile,
  applyDefaultUserProfile,
  createPlayerProfile,
  isDefaultName,
  isDefaultAvatar
};
