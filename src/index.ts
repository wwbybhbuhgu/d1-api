// 完整的留言板 Worker 代码
// 绑定 D1 数据库时变量名必须为 DB
// 访问路径：/api/comments

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
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

    // 只处理 /api/comments 路径
    if (path !== '/api/comments') {
      return jsonResponse({ error: 'Not Found' }, 404);
    }

    // 初始化数据库表（自动创建）
    await initDB(env);

    // GET：获取留言列表
    if (request.method === 'GET') {
      const comments = await getComments(env);
      return jsonResponse(comments, 200);
    }

    // POST：添加留言
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

      // 简单防 XSS 和长度限制
      name = sanitize(name?.trim() || '匿名');
      content = sanitize(content.trim());

      const success = await addComment(env, name, content);
      if (success) {
        return jsonResponse({ success: true }, 201);
      } else {
        return jsonResponse({ error: '数据库写入失败' }, 500);
      }
    }

    // 其他方法不允许
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  },
};

// 初始化 D1 表
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
  }
}

// 获取所有留言（按时间倒序）
async function getComments(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, content, timestamp FROM comments ORDER BY timestamp DESC'
  ).all();
  return results;
}

// 添加留言
async function addComment(env, name, content) {
  const timestamp = Date.now();
  const { success } = await env.DB.prepare(
    'INSERT INTO comments (name, content, timestamp) VALUES (?, ?, ?)'
  ).bind(name, content, timestamp).run();
  return success;
}

// 简单的 XSS 过滤 （只转义基本字符）
function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).substring(0, 500); // 限制长度
}

// 统一 JSON 响应
function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}      try {
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

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};

// 初始化 D1 表
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
  }
}

// 获取留言列表（按时间倒序）
async function getComments(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, content, timestamp FROM comments ORDER BY timestamp DESC'
  ).all();
  return results;
}

// 添加留言
async function addComment(env, name, content) {
  const timestamp = Date.now();
  const { success } = await env.DB.prepare(
    'INSERT INTO comments (name, content, timestamp) VALUES (?, ?, ?)'
  ).bind(name, content, timestamp).run();
  return success;
}

// 防 XSS 简单过滤
function sanitize(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).substring(0, 500);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}
