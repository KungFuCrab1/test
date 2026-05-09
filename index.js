export default {
  async fetch(request, env, ctx) {
    // 檢查是否為 POST 請求
    if (request.method !== "POST") {
      return new Response("請使用 POST 請求", { status: 405 });
    }

    try {
      // 讀取 ESP32 傳來的 JSON 數據
      const esp32Data = await request.json();
      
      // 設定儲存在 GitHub 的檔名 (例如 data.json)
      const fileName = "data.json";
      const filePath = `https://api.github.com/repos/${env.GH_REPO}/contents/${fileName}`;

      // 1. 先獲取檔案目前的 SHA (更新檔案必須提供舊檔案的 SHA)
      let sha = "";
      const getFile = await fetch(filePath, {
        headers: {
          "Authorization": `token ${env.GH_TOKEN}`,
          "User-Agent": "Cloudflare-Worker"
        }
      });

      if (getFile.status === 200) {
        const fileData = await getFile.json();
        sha = fileData.sha;
      }

      // 2. 將內容轉為 Base64 格式 (GitHub API 要求)
      const content = btoa(JSON.stringify(esp32Data, null, 2));

      // 3. 提交 PUT 請求到 GitHub
      const putFile = await fetch(filePath, {
        method: "PUT",
        headers: {
          "Authorization": `token ${env.GH_TOKEN}`,
          "User-Agent": "Cloudflare-Worker",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `ESP32 Data Update: ${new Date().toISOString()}`,
          content: content,
          sha: sha 
        })
      });

      if (putFile.ok) {
        return new Response("成功：數據已同步至 GitHub!", { status: 200 });
      } else {
        const errorMsg = await putFile.text();
        return new Response("失敗：" + errorMsg, { status: 500 });
      }

    } catch (err) {
      return new Response("系統錯誤：" + err.message, { status: 500 });
    }
  }
};
