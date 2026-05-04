// 适配现有表结构: id, author, content, (timestamp 可选)
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      if (url.pathname !== '/api/comments') {
        return jsonResponse({ error: 'Not Found' }, 404);
      }

      if (!env.DB) {
        return jsonResponse({ error: 'D1 database not bound' }, 500);
      }

      // 确保 timestamp 列存在
      await ensureTimestampColumn(env);

      // GET 获取留言
      if (request.method === 'GET') {
        const comments = await getComments(env);
        return jsonResponse(comments, 200);
      }

      // POST 添加留言
      if (request.method === 'POST') {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400);
        }
        const { name, content } = body;
        if (!content || content.trim() === '') {
          return jsonResponse({ error: '内容不能为空' }, 400);
        }
        const author = sanitize(name?.trim() || '匿名');
        const cleanContent = sanitize(content.trim());
        const success = await addComment(env, author, cleanContent);
        return success
          ? jsonResponse({ success: true }, 201)
          : jsonResponse({ error: '数据库写入失败' }, 500);
      }

      return jsonResponse({ error: 'Method Not Allowed' }, 405);
    } catch (err: any) {
      console.error('Worker error:', err);
      return jsonResponse({ error: 'Internal Server Error', details: err.message }, 500);
    }
  },
};

async function ensureTimestampColumn(env: Env) {
  try {
    const { results } = await env.DB.prepare(`PRAGMA table_info(comments)`).all<{ name: string }>();
    const hasTimestamp = results.some(col => col.name === 'timestamp');
    if (!hasTimestamp) {
      await env.DB.exec(`ALTER TABLE comments ADD COLUMN timestamp INTEGER DEFAULT (strftime('%s', 'now'))`);
    }
  } catch (e) {
    console.error('ensureTimestampColumn error:', e);
  }
}

async function getComments(env: Env) {
  // 如果没有 timestamp 列，则按 id 倒序；如果有则按 timestamp 倒序
  const { results } = await env.DB.prepare(`
    SELECT id, author as name, content, COALESCE(timestamp, id) as timestamp
    FROM comments
    ORDER BY timestamp DESC
  `).all();
  return results;
}

async function addComment(env: Env, author: string, content: string) {
  const timestamp = Date.now();
  const { success } = await env.DB.prepare(
    `INSERT INTO comments (author, content, timestamp) VALUES (?, ?, ?)`
  ).bind(author, content, timestamp).run();
  return success;
}

function sanitize(str: string): string {
  if (!str) return '';
  return str
    .replace(/[&<>]/g, (m) => {
      if (m === '&') return '&amp;';
      if ( m === '<') return '&lt;';
      if ( m === '>') return '&gt;';
      return m;
    })
    .substring(0, 500);
}

function jsonResponse(data: any, status: number): Response {
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

// 环境类型声明（放在文件顶部或单独 .d.ts，但为了完整性直接写在这里）
interface Env {
  DB: D1Database;
}
