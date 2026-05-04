// 增强版留言板 Worker（带错误捕获）
export default {
  async fetch(request, env, ctx) {
    try {
      // CORS 预检
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // 只处理 /api/comments
      if (path !== '/api/comments') {
        return jsonResponse({ error: 'Not Found' }, 404);
      }

      // 确保 DB 已绑定
      if (!env.DB) {
        return jsonResponse({ error: 'D1 database not bound. Please bind DB variable.' }, 500);
      }

      // 初始化表（自动创建）
      await initDB(env);

      // GET 请求
      if (request.method === 'GET') {
        const comments = await getComments(env);
        return jsonResponse(comments, 200);
      }

      // POST 请求
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return jsonResponse({ error: 'Invalid JSON' }, 400);
        }
        let { name, content } = body;
        if (!content || content.trim() === '') {
          return jsonResponse({ error: '内容不能为空' }, 400);
        }
        name = sanitize(name?.trim() || '匿名');
        content = sanitize(content.trim());
        const success = await addComment(env, name, content);
        if (success) {
          return jsonResponse({ success: true }, 201);
        } else {
          return jsonResponse({ error: '数据库写入失败' }, 500);
        }
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      // 捕获所有未预料的异常并返回错误详情
      console.error('Worker error:', err);
      return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
    }
  },
};

async function initDB(env) {
  try {
    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT DEFAULT '匿名',
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_timestamp ON comments(timestamp);
    `);
  } catch (e) {
    console.error('initDB error:', e);
    throw new Error(`Failed to init DB: ${e.message}`);
  }
}

async function getComments(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, content, timestamp FROM comments ORDER BY timestamp DESC'
  ).all();
  return results;
}

async function addComment(env, name, content) {
  const timestamp = Date.now();
  const { success } = await env.DB.prepare(
    'INSERT INTO comments (name, content, timestamp) VALUES (?, ?, ?)'
  ).bind(name, content, timestamp).run();
  return success;
}

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).substring(0, 500);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
