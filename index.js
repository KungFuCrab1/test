export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("僅接受 POST", { status: 405 });

    try {
      const data = await request.json();
      
      // 1. 同步資料到 GitHub (維持現有功能)
      const fileName = "recycling_log.json";
      const filePath = `https://api.github.com/repos/${env.GH_REPO}/contents/${fileName}`;
      let sha = "";
      const getFile = await fetch(filePath, {
        headers: { "Authorization": `token ${env.GH_TOKEN}`, "User-Agent": "CF-Worker" }
      });
      if (getFile.status === 200) {
        const fileData = await getFile.json();
        sha = fileData.sha;
      }
      await fetch(filePath, {
        method: "PUT",
        headers: { "Authorization": `token ${env.GH_TOKEN}`, "Content-Type": "application/json", "User-Agent": "CF-Worker" },
        body: JSON.stringify({
          message: `Recycle Update: ${data.count}`,
          content: btoa(JSON.stringify(data, null, 2)),
          sha: sha
        })
      });

      // 2. 呼叫 LINE Messaging API
      if (data.count >= 5) {
        const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.LINE_ACCESS_TOKEN}`
          },
          body: JSON.stringify({
            to: env.LINE_USER_ID,
            messages: [
              {
                type: "text",
                text: `📢 回收箱提醒\n目前回收量已達：${data.count} 個\n請儘速前往清理餐盒！♻️`
              }
            ]
          })
        });

        const lineResult = await lineResponse.text();
        console.log("LINE API 狀態:", lineResult);
      }

      return new Response("成功上傳並發送 LINE 訊息", { status: 200 });
    } catch (err) {
      return new Response("錯誤: " + err.message, { status: 500 });
    }
  }
};
