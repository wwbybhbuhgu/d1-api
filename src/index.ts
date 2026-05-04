// 管理员密钥：建议通过环境变量 ADMIN_KEY 配置，若未设置则使用硬编码默认值
const ADMIN_KEY = env.ADMIN_KEY || 'your-hardcoded-secret-key-change-me';

export default {
  async fetch(request, env) {
    try {
      // CORS 预检（支持 DELETE）
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // API 文档页面
      if (path === '/api/docs') {
        return new Response(getApiDocHtml(), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // 只处理 /api/comments
      if (path !== '/api/comments') {
        return jsonResponse({ error: 'Not Found' }, 404);
      }

      if (!env.DB) {
        return jsonResponse({ error: 'D1 database not bound' }, 500);
      }

      // GET：获取留言
      if (request.method === 'GET') {
        const { results } = await env.DB.preprepare(
          'SELECT id, author as name, content FROM comments ORDER BY id DESC'
        ).all();
        const comments = results.map(row => ({ ...row, timestamp: row.id }));
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
        await env.DB.prepare('INSERT INTO comments (author, content) VALUES (?, ?)')
          .bind(author, cleanContent).run();
        return jsonResponse({ success: true }, 201);
      }

      // DELETE：删除留言（需要管理员 Key）
      if (request.method === 'DELETE') {
        const apiKey = request.headers.get('X-API-Key');
        const expectedKey = env.ADMIN_KEY || 'your-hardcoded-secret-key-change-me';
        if (!apiKey || apiKey !== expectedKey) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const id = url.searchParams.get('id');
        if (!id) {
          return jsonResponse({ error: 'Missing id parameter' }, 400);
        }
        const commentId = parseInt(id, 10);
        if (isNaN(commentId)) {
          return jsonResponse({ error: 'Invalid id' }, 400);
        }
        // 检查留言是否存在
        const { results } = await env.DB.prepare('SELECT id FROM comments WHERE id = ?')
          .bind(commentId).all();
        if (results.length === 0) {
          return jsonResponse({ error: 'Comment not found' }, 404);
        }
        await env.DB.prepare('DELETE FROM comments WHERE id = ?')
          .bind(commentId).run();
        return jsonResponse({ success: true, deletedId: commentId }, 200);
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    },
  });
}

function getApiDocHtml() {
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>留言板 API 文档</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 20px; line-height: 1.5; }
        h1 { color: #2c5e3a; }
        h2 { margin-top: 1.5rem; border-left: 4px solid #2c5e3a; padding-left: 12px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        pre { background: #f4f4f4; padding: 12px; border-radius: 8px; overflow-x: auto; }
        .endpoint { margin: 1rem 0; }
        .method { font-weight: bold; display: inline-block; width: 80px; }
        .url { font-family: monospace; background: #e9ecef; padding: 4px 8px; border-radius: 4px; }
        .note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 1rem 0; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <h1>📮 留言板 API 文档</h1>
    <p>基础地址: <code>https://d1api.wujunbo.top/api/comments</code></p>

    <h2>1. 获取所有留言</h2>
    <div class="endpoint"><span class="method">GET</span> <span class="url">/api/comments</span></div>
    <p>返回留言列表，按 id 倒序排列（最新在前）。示例响应：</p>
    <pre>[
  {
    "id": 3,
    "name": "Max",
    "content": "Keep up the good work!",
    "timestamp": 3
  }
]</pre>

    <h2>2. 添加留言</h2>
    <div class="endpoint"><span class="method">POST</span> <span class="url">/api/comments</span></div>
    <p>请求体 (JSON):</p>
    <pre>{
  "name": "昵称（可选）",
  "content": "留言内容（必填）"
}</pre>
    <p>成功响应: <code>{"success": true}</code></p>

    <h2>3. 删除留言（管理员）</h2>
    <div class="endpoint"><span class="method">DELETE</span> <span class="url">/api/comments?id=123</span></div>
    <p>需要管理员密钥，放在请求头 <code>X-API-Key: 你的密钥</code> 中。</p>
    <p>成功响应: <code>{"success": true, "deletedId": 123}</code></p>
    <p>错误响应: <code>{"error": "Unauthorized"}</code> (密钥错误) 或 <code>{"error": "Comment not found"}</code></p>

    <h2>4. 管理员密钥配置</h2>
    <p>你需要在 Cloudflare Worker 的环境变量中设置 <code>ADMIN_KEY</code>，值为一个强密码。若未设置，代码将使用硬编码默认值（<code>your-hardcoded-secret-key-change-me</code>），请务必修改！</p>
    <div class="note">
        <strong>⚠️ 重要：</strong> 请立即在 Worker → 设置 → 变量 → 环境变量 中添加 <strong>ADMIN_KEY</strong>，并替换默认值。
    </div>

    <h2>5. 前端示例（显示 + 提交）</h2>
    <p>将以下代码嵌入你的网页即可使用留言板（无需密钥）。删除功能仅管理员通过 API 工具（如 curl）调用。</p>
    <pre>&lt;div id="comments-app"&gt;
  &lt;input type="text" id="commentName" placeholder="昵称"&gt;
  &lt;textarea id="commentContent" placeholder="写点什么..."&gt;&lt;/textarea&gt;
  &lt;button onclick="postComment()"&gt;提交&lt;/button&gt;
  &lt;div id="commentList"&gt;&lt;/div&gt;
&lt;/div&gt;
&lt;script&gt;
  const API_URL = 'https://d1api.wujunbo.top/api/comments';
  async function loadComments() {
    const res = await fetch(API_URL);
    const comments = await res.json();
    const container = document.getElementById('commentList');
    if (!comments.length) { container.innerHTML = '&lt;p&gt;暂无留言&lt;/p&gt;'; return; }
    container.innerHTML = comments.map(c => \`
      &lt;div&gt;&lt;strong&gt;\${escapeHtml(c.name)}&lt;/strong&gt;: \${escapeHtml(c.content)}&lt;/div&gt;
    \`).join('');
  }
  async function postComment() {
    const name = document.getElementById('commentName').value;
    const content = document.getElementById('commentContent').value;
    if (!content.trim()) return alert('内容不能为空');
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    loadComments();
    document.getElementById('commentContent').value = '';
  }
  function escapeHtml(str) { ... }
  loadComments();
&lt;/script&gt;</pre>

    <h2>6. 管理员删除示例 (curl)</h2>
    <pre>curl -X DELETE "https://d1api.wujunbo.top/api/comments?id=3" -H "X-API-Key: 你的密钥"</pre>
</body>
</html>`;
}
