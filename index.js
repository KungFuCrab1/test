#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- 設定區塊 ---
const char* ssid     = "你的WiFi名稱";
const char* password = "你的WiFi密碼";
// 填入你的 Cloudflare Worker URL
const char* serverName = "https://your-worker.your-name.workers.dev";

// 腳位定義 (根據接線修改)
const int trigPin = 5;
const int echoPin = 6;

// 邏輯參數
const int thresholdDist = 10; // 偵測門檻 (公分)
int count = 0;                // 當前計數
bool detected = false;        // 狀態鎖定，防止單次投入重複計數
// ----------------

void sendToCloudflare(int currentCount) {
  WiFiClientSecure client;
  client.setInsecure(); // 跳過 SSL 驗證以節省效能

  HTTPClient http;
  if (http.begin(client, serverName)) {
    http.addHeader("Content-Type", "application/json");

    // 封裝 JSON 資料
    JsonDocument doc;
    doc["device"] = "ESP32S3_Recycle_Bin";
    doc["count"] = currentCount;
    doc["timestamp"] = millis();

    String requestBody;
    serializeJson(doc, requestBody);

    Serial.print("正在傳送資料至 Cloudflare...");
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      Serial.printf(" 成功！回應代碼: %d\n", httpResponseCode);
      Serial.println("回應內容: " + http.getString());
    } else {
      Serial.printf(" 失敗，錯誤代碼: %d\n", httpResponseCode);
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // 連接 WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void loop() {
  // 1. 超聲波測距邏輯
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH);
  float distance = duration * 0.034 / 2;

  // 2. 判斷是否有餐盒投入
  // 距離小於門檻且之前處於「未偵測」狀態才觸發
  if (distance > 0 && distance < thresholdDist && !detected) {
    count++;
    detected = true; // 鎖定狀態
    Serial.printf("偵測到餐盒投入！目前累計: %d 次\n", count);

    // 3. 達 5 次時觸發雲端通知
    if (count % 5 == 0) {
      Serial.println("已達 5 次，觸發 LINE 通知...");
      sendToCloudflare(count);
    }
    delay(500); // 物理性消抖
  } 
  
  // 當物體離開（距離大於門檻）時，解鎖狀態
  else if (distance > thresholdDist + 2) { 
    detected = false;
  }

  delay(100); // 掃描頻率
}
