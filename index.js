export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. [GET] 圖表網頁介面 ---
    if (url.pathname === "/dashboard") {
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>回收監測面板</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { font-family: sans-serif; padding: 20px; background: #f0f2f5; display: flex; justify-content: center; }
          .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 800px; }
          h2 { text-align: center; color: #333; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>♻️ 餐盒回收趨勢監測</h2>
          <canvas id="myChart"></canvas>
        </div>
        <script>
          async function loadData() {
            const r = await fetch('/api/data');
            const data = await r.json();
            const ctx = document.getElementById('myChart');
            new Chart(ctx, {
              type: 'line',
              data: {
                labels: data.reverse().map(d => new Date(d.timestamp).toLocaleTimeString()),
                datasets: [{ 
                  label: '回收數量', 
                  data: data.map(d => d.count), 
                  borderColor: '#2ecc71', 
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  fill: true,
                  tension: 0.3 
                }]
              },
              options: { scales: { y: { beginAtZero: true } } }
            });
          }
          loadData();
        </script>
      </body>
      </html>`;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // --- 2. [GET] 數據 API ---
    if (url.pathname === "/api/data") {
      try {
        const { results } = await env.DB.prepare("SELECT count, timestamp FROM recycling_logs ORDER BY id DESC LIMIT 50").all();
        return new Response(JSON.stringify(results), { 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // --- 3. [POST] 接收數據 (ESP32 / PowerShell) ---
    if (request.method === "POST") {
      try {
        const data = await request.json();
        const count = data.count || 0;
        const timestamp = new Date().toISOString();

        // 存入 D1 資料庫
        await env.DB.prepare("INSERT INTO recycling_logs (count, timestamp) VALUES (?, ?)").bind(count, timestamp).run();

        // LINE 通知
        if (count >= 5) {
          await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json", 
              "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}` 
            },
            body: JSON.stringify({ 
              to: env.LINE_USER_ID, 
              messages: [{ type: "text", text: "♻️ 數量超過囉請盡快回收：目前量已達 " + count }] 
            })
          });
        }

        return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ status: "error", message: e.message }), { status: 500 });
      }
    }

    // --- 4. 其他路徑 ---
    return new Response("請訪問 /dashboard 查看圖表", { status: 404 });
  }
};
