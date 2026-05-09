export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. Dashboard 資料讀取 API (GET) ---
    // 供前端圖表從 /api/data 抓取 D1 紀錄
    if (url.pathname === "/api/data" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare(
          "SELECT count, timestamp FROM recycling_logs ORDER BY timestamp DESC LIMIT 50"
        ).all();
        
        return new Response(JSON.stringify(results), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" // 允許跨網域存取圖表資料
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // --- 2. 接收硬體數據 (POST) ---
    if (request.method !== "POST") {
      return new Response("僅接受 POST 請求", { status: 405 });
    }

    try {
      const data = await request.json();
      const count = data.count || 0;
      const timestamp = new Date().toISOString();

      // --- A. 寫入 D1 資料庫 (紀錄時間與次數) ---
      // 用於後續 Dashboard 繪製趨勢圖
      await env.DB.prepare(
        "INSERT INTO recycling_logs (count, timestamp) VALUES (?, ?)"
      ).bind(count, timestamp).run();

      // --- B. 備份至 GitHub (JSON 存檔) ---
      // 使用 GitHub API 更新指定倉庫內的檔案
      const filename = "recycling_log.json";
      const getFileUrl = `https://api.github.com/repos/${env.GH_REPO}/contents/${filename}`;
      
      let sha = "";
      const getFile = await fetch(getFileUrl, {
        headers: { 
          "Authorization": `token ${env.GH_TOKEN}`, 
          "User-Agent": "Cloudflare-Worker" 
        }
      });

      if (getFile.status === 200) {
        const fileData = await getFile.json();
        sha = fileData.sha;
      }

      const newContent = JSON.stringify({ last_count: count, last_update: timestamp });
      const updateGithub = await fetch(getFileUrl, {
        method: "PUT",
        headers: {
          "Authorization": `token ${env.GH_TOKEN}`,
          "User-Agent": "Cloudflare-Worker",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Update count: ${count} at ${timestamp}`,
          content: btoa(newContent),
          sha: sha
        })
      });

      // --- C. LINE Messaging API 告警 ---
      // 當回收次數達到門檻 (例如 5) 時觸發
      let lineStatus = "未達通知門檻";
      if (count >= 5) {
        const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: env.LINE_USER_ID,
            messages: [{
              type: "text",
              text: `♻️ 餐盒回收提醒：目前累積已達 ${count} 個！`
            }]
          })
        });

        const lineResult = await lineRes.json();
        lineStatus = lineRes.status === 200 ? "成功送達" : `失敗: ${JSON.stringify(lineResult)}`;
      }

      // 回傳最終處理結果給 ESP32 或測試端
      return new Response(JSON.stringify({
        status: "success",
        data_logged: { count, timestamp },
        github: updateGithub.status === 200 || updateGithub.status === 201 ? "OK" : "Error",
        line: lineStatus
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "error",
        message: err.message
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
