const https = require('https');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const DEFAULT_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions';
const DEFAULT_MODEL = 'agnes-2.0-flash';

function postJson(url, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 45000
    }, (response) => {
      let raw = '';

      response.on('data', (chunk) => {
        raw += chunk;
      });

      response.on('end', () => {
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch (err) {
          reject(new Error(`AI返回内容解析失败：${raw.slice(0, 120)}`));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = parsed.error && parsed.error.message
            ? parsed.error.message
            : `AI接口请求失败，状态码 ${response.statusCode}`;
          reject(new Error(message));
          return;
        }

        resolve(parsed);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('AI接口请求超时'));
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function buildMessages(imageUrl, text) {
  const userText = text || '请根据这张麻将手牌照片，只分析当前麻将出牌。判断现在应该打哪张牌；如果已经听牌，请说明听哪些牌，以及哪张更好。';

  const systemPrompt = [
    '你是一个只处理麻将出牌的助手。你的任务范围被严格限制为：识别麻将手牌、桌面副露、牌河中明显可见的麻将信息，并给出当前出牌建议。',
    '安全边界：如果图片不是麻将牌、麻将手牌、麻将牌桌、牌河或相关记分牌，请直接回复“这张图片不是麻将牌面，我只能分析麻将出牌。”不要描述图片中的人物、物品、地点、证件、屏幕内容或其他非麻将信息。',
    '如果用户只输入文字，也必须先判断文字是否在描述麻将手牌或麻将规则；不是麻将内容时，同样拒绝分析。',
    '如果图片中有麻将但牌面模糊、被遮挡、角度过斜或无法辨认关键牌，不要硬猜。说明哪些牌看不清，并建议重新拍摄。',
    '分析顺序：1. 识别手牌和副露；2. 判断适用规则或指出规则未知；3. 判断是否已经胡牌或听牌；4. 若未听牌，估算向听方向和有效进张；5. 比较候选弃牌的效率、保留搭子价值、对子价值、危险度和本地规则影响；6. 给出一张最推荐弃牌。',
    '策略原则：优先保留成型面子和两面搭子；谨慎拆对子和复合搭子；字牌、孤张、边张和嵌张按牌局阶段与规则综合判断；若用户提到缺门、血战/血流、红中、财神、赖子等规则，必须纳入判断。',
    '输出格式固定为：牌面识别、建议出牌、听牌判断、推荐理由、备选打法、注意事项。每项用短句，适合小程序阅读。',
    '不要输出模型名称、接口信息、免责声明长篇大论。'
  ].join('\n');

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  if (imageUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: userText });
  }

  return messages;
}

exports.main = async (event) => {
  const apiKey = process.env.AGNES_API_KEY || process.env.AGNES_KEY;
  const endpoint = process.env.AGNES_API_BASE_URL || DEFAULT_ENDPOINT;
  const model = process.env.AGNES_MODEL || DEFAULT_MODEL;
  const imageUrl = event && typeof event.imageUrl === 'string' ? event.imageUrl.trim() : '';
  const text = event && typeof event.text === 'string' ? event.text.trim() : '';

  if (!apiKey) {
    return {
      success: false,
      error: '云函数未配置 AGNES_API_KEY'
    };
  }

  if (!imageUrl && !text) {
    return {
      success: false,
      error: '请上传麻将手牌图片，或输入手牌描述'
    };
  }

  try {
    const response = await postJson(endpoint, apiKey, {
      model,
      messages: buildMessages(imageUrl, text),
      temperature: 0.15,
      max_tokens: 1200
    });

    const choice = response.choices && response.choices[0];
    const message = choice && choice.message;
    const content = message && message.content;

    if (!content) {
      return {
        success: false,
        error: 'AI未返回有效分析结果'
      };
    }

    return {
      success: true,
      content,
      usage: response.usage || null
    };
  } catch (err) {
    console.error('Agnes AI调用失败:', err && err.message ? err.message : err);
    return {
      success: false,
      error: err && err.message ? err.message : 'AI分析失败，请稍后重试'
    };
  }
};
