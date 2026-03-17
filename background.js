chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.method === "POST" && details.url.includes("ajaxDoQuery")) {
            if (details.requestBody && details.requestBody.raw && details.requestBody.raw[0]) {
                try {
                    const bodyString = new TextDecoder("utf-8").decode(details.requestBody.raw[0].bytes);
                    const payload = JSON.parse(bodyString);

                    // 把攔截到的 Payload 和「真實 API 網址」一起傳給 content.js
                    chrome.tabs.sendMessage(details.tabId, {
                        type: "NEW_PAYLOAD",
                        payload: payload,
                        apiUrl: details.url
                    }).catch(() => { });
                } catch (e) {
                    console.error("解析 Payload 失敗", e);
                }
            }
        }
    },
    { urls: ["*://*.hlhouseerp.com.tw/*", "*://hlhouseerp.com.tw/*"] },
    ["requestBody"]
);