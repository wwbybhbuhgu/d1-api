export default {
  async fetch(request, env) {
    try {
      // 处理 CORS 预检
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
      if (url.pathname !== '/api/comments') {
        return jsonResponse({ error: 'Not Found' }, 404);
      }
      if (!env.DB) {
        return jsonResponse({ error: 'D1 database not bound' }, 500);
      }

      // GET：获取留言列表（按 id 倒序，id 越大越新）
      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT id, author as name, content FROM comments ORDER BY id DESC`
        ).all();
        // 为兼容前端可能期望的 timestamp 字段，用 id 代替（或留空）
        const comments = results.map(row => ({
          ...row,
          timestamp: row.id
        }));
        return jsonResponse(comments, 200);
      }

      // POST：添加留言
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400);
        }
        let { name, content } = body;
        if (!content || content.trim() === '') {
          return jsonResponse({ error: '内容不能为空' }, 400);
        }
        const author = sanitize(name?.trim() || '匿名');
        const cleanContent = sanitize(content.trim());
        // 插入新留言（不写入 timestamp 列，因为表中没有）
        await env.DB.prepare(
          `INSERT INTO comments (author, content) VALUES (?, ?)`
        ).bind(author, cleanContent).run();
        return jsonResponse({ success: true }, 201);
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err) {
      console.error(err);
      return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
    }
  }
};

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
