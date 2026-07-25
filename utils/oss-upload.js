// 头像上传到后端 OSS（阿里云），返回公开可访问的 URL
// 后端接口：POST /api/common/oss-upload （免登录，需携带 ts+sign 签名校验）
const api = require('./api');

// ---------- MD5（标准实现，用于生成上传签名） ----------
function md5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    var lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
    var lX4 = lX & 0x40000000, lY4 = lY & 0x40000000;
    var lX16 = lX & 0x3FFFFFFF, lY16 = lY & 0x3FFFFFFF;
    lX = (lX16 << 1) | (lX4 >> 30);
    lY = (lY16 << 1) | (lY4 >> 30);
    var lResult = (lX16 + lY16) & 0x3FFFFFFF;
    if (lX8 & lY8) return (lResult ^ 0x80000000 ^ lX8 ^ lY8) >>> 0;
    if (lX8 | lY8) {
      if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8) >>> 0;
      return (lResult ^ 0x40000000 ^ lX8 ^ lY8) >>> 0;
    }
    return (lResult ^ lX8 ^ lY8) >>> 0;
  }
  function fF(x, y, z) { return (x & y) | ((~x) & z); }
  function fG(x, y, z) { return (x & z) | (y & (~z)); }
  function fH(x, y, z) { return (x ^ y ^ z); }
  function fI(x, y, z) { return (y ^ (x | (~z))); }
  function fFF(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(fF(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function fGG(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(fG(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function fHH(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(fH(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function fII(a, b, c, d, x, s, ac) { a = addUnsigned(a, addUnsigned(addUnsigned(fI(b, c, d), x), ac)); return addUnsigned(rotateLeft(a, s), b); }
  function convertToWordArray(str) {
    var lWordCount = str.length >> 2;
    var lByteCount = (str.length & 3) * 8;
    var lWordArray = new Array(lWordCount + 1);
    for (var i = 0; i < lWordCount; i++) {
      lWordArray[i] = (str.charCodeAt(i * 4) & 0xFF) |
        ((str.charCodeAt(i * 4 + 1) & 0xFF) << 8) |
        ((str.charCodeAt(i * 4 + 2) & 0xFF) << 16) |
        ((str.charCodeAt(i * 4 + 3) & 0xFF) << 24);
    }
    lWordArray[lWordCount] = (str.charCodeAt(lWordCount * 4) & 0xFF) |
      ((str.charCodeAt(lWordCount * 4 + 1) & 0xFF) << 8) |
      ((str.charCodeAt(lWordCount * 4 + 2) & 0xFF) << 16) |
      (lByteCount << 24);
    lWordArray.push(0x80);
    while (lWordArray.length % 16 != 14) lWordArray.push(0);
    lWordArray.push(lByteCount);
    lWordArray.push(str.length >> 29);
    return lWordArray;
  }
  function wordToHex(lValue) {
    var wordToHexValue = "", wordToHexValueTemp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValueTemp = "0" + lByte.toString(16);
      wordToHexValue += wordToHexValueTemp.substr(wordToHexValueTemp.length - 2, 2);
    }
    return wordToHexValue;
  }
  var x = convertToWordArray(string);
  var a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  for (var k = 0; k < x.length; k += 16) {
    var AA = a, BB = b, CC = c, DD = d;
    a = fFF(a, b, c, d, x[k], 7, -680876936);
    d = fFF(d, a, b, c, x[k + 1], 12, -389564586);
    c = fFF(c, d, a, b, x[k + 2], 17, 606105819);
    b = fFF(b, c, d, a, x[k + 3], 22, -1044525330);
    a = fFF(a, b, c, d, x[k + 4], 7, -176418897);
    d = fFF(d, a, b, c, x[k + 5], 12, 1200080426);
    c = fFF(c, d, a, b, x[k + 6], 17, -1473231341);
    b = fFF(b, c, d, a, x[k + 7], 22, -45705983);
    a = fFF(a, b, c, d, x[k + 8], 7, 1770035416);
    d = fFF(d, a, b, c, x[k + 9], 12, -1958414417);
    c = fFF(c, d, a, b, x[k + 10], 17, -42063);
    b = fFF(b, c, d, a, x[k + 11], 22, -1990404162);
    a = fFF(a, b, c, d, x[k + 12], 7, 1804603682);
    d = fFF(d, a, b, c, x[k + 13], 12, -40341101);
    c = fFF(c, d, a, b, x[k + 14], 17, -1502002290);
    b = fFF(b, c, d, a, x[k + 15], 22, 1236535329);
    a = fGG(a, b, c, d, x[k + 1], 5, -165796510);
    d = fGG(d, a, b, c, x[k + 6], 9, -1069501632);
    c = fGG(c, d, a, b, x[k + 11], 14, 643717713);
    b = fGG(b, c, d, a, x[k], 20, -373897302);
    a = fGG(a, b, c, d, x[k + 5], 5, -701558691);
    d = fGG(d, a, b, c, x[k + 10], 9, 38016083);
    c = fGG(c, d, a, b, x[k + 15], 14, -660478335);
    b = fGG(b, c, d, a, x[k + 4], 20, -405537848);
    a = fGG(a, b, c, d, x[k + 9], 5, 568446438);
    d = fGG(d, a, b, c, x[k + 14], 9, -1019803690);
    c = fGG(c, d, a, b, x[k + 3], 14, -187363961);
    b = fGG(b, c, d, a, x[k + 8], 20, 1163531501);
    a = fGG(a, b, c, d, x[k + 13], 5, -1444681467);
    d = fGG(d, a, b, c, x[k + 2], 9, -51403784);
    c = fGG(c, d, a, b, x[k + 7], 14, 1735328473);
    b = fGG(b, c, d, a, x[k + 12], 20, -1926607734);
    a = fHH(a, b, c, d, x[k + 5], 4, -378558);
    d = fHH(d, a, b, c, x[k + 8], 11, -2022574463);
    c = fHH(c, d, a, b, x[k + 11], 16, 1839030562);
    b = fHH(b, c, d, a, x[k + 14], 23, -35309556);
    a = fHH(a, b, c, d, x[k + 1], 4, -1530992060);
    d = fHH(d, a, b, c, x[k + 4], 11, 1272893353);
    c = fHH(c, d, a, b, x[k + 7], 16, -155497632);
    b = fHH(b, c, d, a, x[k + 10], 23, -1094730640);
    a = fHH(a, b, c, d, x[k + 13], 4, 681279174);
    d = fHH(d, a, b, c, x[k], 11, -358537222);
    c = fHH(c, d, a, b, x[k + 3], 16, -722521979);
    b = fHH(b, c, d, a, x[k + 6], 23, 76029189);
    a = fHH(a, b, c, d, x[k + 9], 4, -640364487);
    d = fHH(d, a, b, c, x[k + 12], 11, -421815835);
    c = fHH(c, d, a, b, x[k + 15], 16, 530742520);
    b = fHH(b, c, d, a, x[k + 2], 23, -995338651);
    a = fII(a, b, c, d, x[k], 6, -198630844);
    d = fII(d, a, b, c, x[k + 7], 10, 1126891415);
    c = fII(c, d, a, b, x[k + 14], 15, -1416354905);
    b = fII(b, c, d, a, x[k + 5], 21, -57434055);
    a = fII(a, b, c, d, x[k + 12], 6, 1700485571);
    d = fII(d, a, b, c, x[k + 3], 10, -1894986606);
    c = fII(c, d, a, b, x[k + 10], 15, -1051523);
    b = fII(b, c, d, a, x[k + 1], 21, -2054922799);
    a = fII(a, b, c, d, x[k + 8], 6, 1873313359);
    d = fII(d, a, b, c, x[k + 15], 10, -30611744);
    c = fII(c, d, a, b, x[k + 6], 15, -1560198380);
    b = fII(b, c, d, a, x[k + 13], 21, 1309151649);
    a = fII(a, b, c, d, x[k + 4], 6, -145523070);
    d = fII(d, a, b, c, x[k + 11], 10, -1120210379);
    c = fII(c, d, a, b, x[k + 2], 15, 718787259);
    b = fII(b, c, d, a, x[k + 9], 21, -343485551);
    a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

// 上传盐，需与后端一致
var UPLOAD_SALT = '1027zgm';

function uploadAvatar(tempFilePath) {
  // 时间戳 + 盐 生成签名，后端校验签名与时间窗
  var ts = String(Date.now());
  var sign = md5(ts + UPLOAD_SALT);
  return new Promise(function (resolve, reject) {
    wx.uploadFile({
      url: api.API_BASE + '/api/common/oss-upload',
      filePath: tempFilePath,
      name: 'file',
      formData: { ts: ts, sign: sign },
      success: function (res) {
        try {
          var body = JSON.parse(res.data);
          if (body && body.code === 0) {
            resolve(body.data);
          } else {
            reject(new Error((body && body.message) || '上传失败'));
          }
        } catch (e) {
          reject(new Error('上传结果解析失败'));
        }
      },
      fail: function (err) {
        reject(new Error((err && err.errMsg) || '上传失败'));
      }
    });
  });
}

module.exports = { uploadAvatar: uploadAvatar };
