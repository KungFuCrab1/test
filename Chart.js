<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>餐盒回收監測面板</title>
    <!-- 引入 Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; background: #f4f4f9; }
        .container { width: 80%; max-width: 800px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 50px; }
        h2 { color: #333; }
    </style>
</head>
<body>

    <div class="container">
        <h2>♻️ 餐盒回收數量趨勢圖</h2>
        <canvas id="recyclingChart"></canvas>
    </div>

    <script>
        async function fetchAndRenderChart() {
            try {
                // 1. 從你的 Cloudflare Worker API 抓取資料
                const response = await fetch('https://test.a0966391569.workers.dev/api/data');
                const rawData = await response.json();

                // 2. 處理資料（API 給的是最新的在前面，圖表需要時間由舊到新，所以要 .reverse()）
                const sortedData = rawData.reverse();
                
                // 格式化時間標籤 (只顯示小時:分鐘)
                const labels = sortedData.map(item => {
                    const date = new Date(item.timestamp);
                    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                });
                
                const counts = sortedData.map(item => item.count);

                // 3. 繪製圖表
                const ctx = document.getElementById('recyclingChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line', // 使用折線圖
                    data: {
                        labels: labels,
                        datasets: [{
                            label: '回收次數',
                            data: counts,
                            borderColor: '#4bc0c0',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderWidth: 3,
                            tension: 0.3, // 讓線條圓滑一點
                            fill: true,
                            pointRadius: 5,
                            pointBackgroundColor: '#4bc0c0'
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: '數量 (個)' }
                            },
                            x: {
                                title: { display: true, text: '時間' }
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('抓取資料失敗:', error);
            }
        }

        // 執行繪圖
        fetchAndRenderChart();
    </script>
</body>
</html>
