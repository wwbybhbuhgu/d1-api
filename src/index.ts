// 适配你现有表结构的 Worker 代码
// 表字段: id, author, content, timestamp (需确认 timestamp 是否存在)
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

      if (path !== '/api/comments') {
        return jsonResponse({ error: 'Not Found' }, 404);
      }

      if (!env.DB) {
        return jsonResponse({ error: 'D1 database not bound.' }, 500);
      }

      // 确保表结构中有 timestamp 字段（如果没有则自动添加）
      await ensureTimestampColumn(env);

      if (request.method === 'GET') {
        const comments = await getComments(env);
        return jsonResponse(comments, 200);
      }

      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return jsonResponse({ error: 'Invalid JSON' }, 400);
        }
        let { name, content } = body;  // 前端传的是 name，映射为 author
        if (!content || content.trim() === '') {
          return jsonResponse({ error: '内容不能为空' }, 400);
        }
        const author = sanitize(name?.trim() || '匿名');
        const contentSanitized = sanitize(content.trim());
        const success = await addComment(env, author, contentSanitized);
        if (success) {
          return jsonResponse({ success: true }, 201);
        } else {
          return jsonResponse({ error: '数据库写入失败' }, 500);
        }
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      console.error('Worker error:', err);
      return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
    }
  },
};

// 确保 timestamp 字段存在
async function ensureTimestampColumn(env) {
  try {
    // 检查是否存在 timestamp 列
    const { results } = await env.DB.prepare(
      "PRAGMA table_info(comments)"
    ).all();
    const hasTimestamp = results.some(col => col.name === 'timestamp');
    if (!hasTimestamp) {
      // 添加 timestamp 列（默认值设为当前时间戳）
      await env.DB.exec(
        "ALTER TABLE comments ADD COLUMN timestamp INTEGER DEFAULT (strftime('%s', 'now'))"
      );
    }
  } catch (e) {
    console.error('ensureTimestampColumn error:', e);
  }
}

async function getComments(env) {
  // 如果 timestamp 列不存在，则按 id 排序
  const { results } = await env.DB.prepare(
    `SELECT id, author as name, content, 
            COALESCE(timestamp, id) as timestamp 
     FROM comments 
     ORDER BY timestamp DESC`
  ).all();
  return results;
}

async function addComment(env, author, content) {
  const timestamp = Date.now();
  const { success } = await env.DB.prepare(
    'INSERT INTO comments (author, content, timestamp) VALUES (?, ?, ?)'
  ).bind(author, content, timestamp).run();
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
