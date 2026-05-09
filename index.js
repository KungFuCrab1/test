export default {
  async fetch(request, env) {
    // 1. 僅允許 POST 請求
    if (request.method !== "POST") {
      return new Response("僅接受 POST 請求", { status: 405 });
    }

    try {
      const data = await request.json();
      const count = data.count || 0;
      const timestamp = new Date().toISOString();

      // --- 核心邏輯 A: 存檔至 GitHub ---
      const filename = "recycling_log.json";
      const getFileUrl = `https://api.github.com/repos/${env.GH_REPO}/contents/${filename}`;
      
      // 先取得 GitHub 原有的檔案 (獲取 sha 才能更新)
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

      // 準備存入的內容
      const newContent = JSON.stringify({ last_count: count, last_update: timestamp });
      const updateFile = await fetch(getFileUrl, {
        method: "PUT",
        headers: {
          "Authorization": `token ${env.GH_TOKEN}`,
          "User-Agent": "Cloudflare-Worker",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Update recycling count: ${count}`,
          content: btoa(newContent), // Base64 編碼
          sha: sha
        })
      });

      // --- 核心邏輯 B: LINE 告警 (當次數 >= 5 時) ---
      let lineStatusMessage = "未達通知門檻";
      
      if (count >= 5) {
        const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: env.LINE_USER_ID,
            messages: [{
              type: "text",
              text: `♻️ 餐盒回收通知：目前量已達 ${count} 個，請記得清理！`
            }]
          })
        });

        const lineResult = await lineResponse.json();
        
        if (lineResponse.status === 200) {
          lineStatusMessage = "LINE 訊息已成功送達";
        } else {
          // 如果 LINE 回報錯誤，將錯誤訊息回傳給測試者
          lineStatusMessage = `LINE 傳送失敗: ${JSON.stringify(lineResult)}`;
        }
      }

      return new Response(JSON.stringify({
        status: "success",
        github_status: updateFile.status === 200 || updateFile.status === 201 ? "OK" : "Error",
        line_status: lineStatusMessage
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
