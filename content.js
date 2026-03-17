(function () {
    if (document.getElementById('hl-side-btn')) return;

    // ==========================================
    // 1. 建立側邊浮動 UI
    // ==========================================
    const sideBtn = document.createElement('div');
    sideBtn.id = 'hl-side-btn';
    sideBtn.innerHTML = "📥";
    sideBtn.style.cssText = `
        position: fixed; top: 50%; right: 0; transform: translateY(-50%);
        width: 40px; height: 50px; background: #28a745; color: white;
        border-radius: 10px 0 0 10px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 20px; box-shadow: -2px 0 5px rgba(0,0,0,0.2);
        z-index: 999999; transition: 0.2s;
    `;

    const panel = document.createElement('div');
    panel.id = 'hl-panel';
    panel.style.cssText = `
        position: fixed; top: 50%; right: 50px; transform: translateY(-50%);
        width: 220px; background: white; border: 2px solid #28a745; border-radius: 10px;
        padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 999998; font-family: sans-serif; display: none; text-align: center;
    `;

    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #333;">房地產下載器</div>
        <div id="hl-progress-wrapper" style="display: none; justify-content: center; margin: 15px 0;">
            <div id="hl-circle" style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(#eee 100%, #eee 0); display: flex; align-items: center; justify-content: center;">
                <div style="width: 65px; height: 65px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #28a745;" id="hl-circle-text">
                    0%
                </div>
            </div>
        </div>
        <div id="hl-status" style="font-size: 12px; color: #d9534f; margin-bottom: 15px; font-weight: bold;">請在網頁上點擊一次【搜尋】來綁定條件</div>
        <button id="hl-start-btn" disabled style="
            width: 100%; padding: 10px; background: #6c757d; color: white;
            border: none; border-radius: 5px; font-weight: bold; cursor: not-allowed;
        ">等待條件中</button>
    `;

    document.body.appendChild(sideBtn);
    document.body.appendChild(panel);

    sideBtn.addEventListener('click', () => {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // ==========================================
    // 2. 接收 Background 傳來的 Payload 與 真實API網址
    // ==========================================
    let activePayload = null;
    let activeApiUrl = ""; // 新增：用來記錄真實的 API 網址

    const startBtn = document.getElementById('hl-start-btn');
    const statusText = document.getElementById('hl-status');

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "NEW_PAYLOAD") {
            activePayload = msg.payload;
            activeApiUrl = msg.apiUrl; // 儲存真實網址

            statusText.style.color = "#28a745";
            statusText.innerText = "✅ 已成功攔截篩選條件！";
            startBtn.innerText = "開始下載";
            startBtn.disabled = false;
            startBtn.style.background = "#28a745";
            startBtn.style.cursor = "pointer";
        }
    });

    // ==========================================
    // 3. 定義兩個頁面的欄位轉換邏輯
    // ==========================================
    function formatSellingPriceData(allData) {
        const headers = ["案名", "地址", "總建坪", "地坪", "成交價(萬)", "單價(萬/坪)", "成交日期", "建築型態", "使用分區", "臨路(米)", "屋齡(年)", "登錄店家"];
        const csvContent = allData.map(row => {
            const cleanAddress = (row.ES_ESTAddressFull || "").replace(/<[^>]*>?/gm, '').trim();
            const rowData = [
                row.ES_ESTName || "", cleanAddress, row.ES_ESTTLArea || "", row.ES_ESTLDArea || "",
                row.ES_ESTDealMillion || "", row.ES_ESTDealUPMillion || "", row.ES_ESTDealDate || "",
                row.ES_ESTType || "", row.ES_ESTAreaTypeName || "", row.ES_ESTRWidth || "",
                row.ES_ESTHouseAge || "", row.ES_SIMName || ""
            ];
            return rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        return { headers, csvContent, prefix: "成交行情" };
    }

    function formatCommissionedData(allData) {
        const headers = ["店", "案件編號", "案名", "地址", "總建坪", "地坪", "總價(萬)", "單價(萬/坪)", "月租(萬)", "案別", "物件類別", "使用用途", "委託狀態"];
        const caseTypeMap = { "1": "專任", "2": "一般", "3": "租賃" };
        const categoryMap = { "01": "成屋中古屋", "02": "土地", "03": "預售屋", "04": "車位" };
        const statusMap = { "00": "有效" };

        const csvContent = allData.map(row => {
            const cleanAddress = (row.ES_ESTAddressFull || "").replace(/<[^>]*>?/gm, '').trim();
            const rowData = [
                row.ES_SIMNameS || "",
                row.ES_DOMDeedNo || "",
                row.ES_ESTName || "",
                cleanAddress,
                row.ES_ESTTLArea || "",
                row.ES_ESTLDArea || "",
                row.ES_ESTTotalPrice || "",
                row.ES_ESTUPrice || "",
                row.ES_ESTRent || "",
                caseTypeMap[row.ES_ESTCaseType] || row.ES_ESTCaseType || "",
                categoryMap[row.ES_ESTCategory] || row.ES_ESTCategory || "",
                row.ES_ESTPurposesName || "",
                statusMap[row.ES_ESTStatus] || row.ES_ESTStatus || ""
            ];
            return rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        return { headers, csvContent, prefix: "委託物件" };
    }

    // ==========================================
    // 4. API 抓取主邏輯
    // ==========================================
    const progressWrapper = document.getElementById('hl-progress-wrapper');
    const circle = document.getElementById('hl-circle');
    const circleText = document.getElementById('hl-circle-text');

    startBtn.addEventListener('click', async () => {
        if (!activePayload || !activeApiUrl) return;

        startBtn.disabled = true;
        startBtn.style.background = "#ccc";
        startBtn.innerText = "抓取中...";
        progressWrapper.style.display = "flex";
        statusText.innerText = "連線中...";

        let allData = [];
        let displayStart = 0;
        const displayLength = 100;

        let qPageInfo = JSON.parse(activePayload.QPageInfo);

        while (true) {
            qPageInfo.find(p => p.name === "iDisplayStart").value = displayStart;
            qPageInfo.find(p => p.name === "iDisplayLength").value = displayLength;
            activePayload.QPageInfo = JSON.stringify(qPageInfo);

            try {
                // 【關鍵修改】：直接使用攔截到的真實 API 網址！
                const response = await fetch(activeApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                        "Accept": "application/json, text/javascript, */*; q=0.01",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: JSON.stringify(activePayload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const textRes = await response.text();
                let jsonRes = JSON.parse(textRes);
                let rawData = typeof jsonRes.d === 'string' ? JSON.parse(jsonRes.d) : jsonRes.d;
                const records = rawData.data || rawData.aaData;

                if (!records || records.length === 0) break;

                allData = allData.concat(records);
                displayStart += displayLength;

                let totalRecords = rawData.recordsTotal || rawData.iTotalRecords || allData.length;
                let percent = Math.floor((allData.length / totalRecords) * 100);
                if (percent > 100) percent = 100;

                circle.style.background = `conic-gradient(#28a745 ${percent}%, #eee 0)`;
                circleText.innerText = `${percent}%`;
                statusText.innerText = `進度：${allData.length} / ${totalRecords} 筆`;

                await new Promise(r => setTimeout(r, 400));

            } catch (e) {
                console.error("API 請求錯誤:", e);
                statusText.innerText = "❌ 發生錯誤，請看 Console";
                break;
            }
        }

        if (allData.length > 0) {
            circleText.innerText = "完成";
            statusText.innerText = `✅ 共下載 ${allData.length} 筆`;

            // 【關鍵修改】：用攔截到的真實網址來判斷應該套用哪一種格式
            const isCommissionedPage = activeApiUrl.includes("CommissionedEstate_Q.aspx");
            const formatResult = isCommissionedPage ? formatCommissionedData(allData) : formatSellingPriceData(allData);

            const finalCsv = "\uFEFF" + formatResult.headers.join(',') + '\n' + formatResult.csvContent.join('\n');
            const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${formatResult.prefix}篩選結果_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        startBtn.innerText = "重新下載";
        startBtn.disabled = false;
        startBtn.style.background = "#28a745";
    });
})();