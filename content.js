(function () {
    if (document.getElementById('hl-side-btn')) return;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes hl-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        #hl-circle.hl-loading {
            background: conic-gradient(#28a745 20%, #dff3e4 20% 100%) !important;
            animation: hl-spin 0.9s linear infinite;
        }

        #hl-circle.hl-complete {
            background: conic-gradient(#28a745 100%, #28a745 0) !important;
            animation: none;
        }
    `;
    document.head.appendChild(style);

    // ==========================================
    // 1. 建立側邊浮動 UI (支援上下拖曳)
    // ==========================================
    const sideBtn = document.createElement('div');
    sideBtn.id = 'hl-side-btn';
    sideBtn.innerHTML = "📥";
    sideBtn.style.cssText = `
        position: fixed; top: 50%; right: 0; transform: translateY(-50%);
        width: 45px; height: 55px; background: #28a745; color: white;
        border-radius: 10px 0 0 10px; display: flex; align-items: center; justify-content: center;
        cursor: grab; font-size: 24px; box-shadow: -2px 0 8px rgba(0,0,0,0.2);
        z-index: 999999; user-select: none;
    `;

    const panel = document.createElement('div');
    panel.id = 'hl-panel';
    panel.style.cssText = `
        position: fixed; top: 50%; right: 60px; transform: translateY(-50%);
        width: 230px; background: white; border: 2px solid #28a745; border-radius: 12px;
        padding: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        z-index: 999998; font-family: sans-serif; display: none; text-align: center;
    `;

    // 關閉按鈕 (X)
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
        position: absolute; top: 5px; right: 12px; cursor: pointer;
        font-size: 22px; font-weight: bold; color: #aaa; line-height: 1; transition: 0.2s;
    `;
    closeBtn.addEventListener('click', () => panel.style.display = 'none');
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#333');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#aaa');

    // 面板內容 (包含圓形進度條)
    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #333; font-size: 16px;">資料下載器</div>
        
        <div id="hl-progress-wrapper" style="display: none; justify-content: center; margin: 15px 0;">
            <div id="hl-circle" style="width: 80px; height: 80px; border-radius: 50%; background: conic-gradient(#eee 100%, #eee 0); display: flex; align-items: center; justify-content: center; transition: background 0.3s;">
                <div style="width: 65px; height: 65px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: #28a745;" id="hl-circle-text">
                    0%
                </div>
            </div>
        </div>
        
        <div id="hl-status" style="font-size: 13px; color: #d9534f; margin-bottom: 15px; font-weight: bold; line-height: 1.4;">請在網頁點擊【搜尋】<br>來綁定下載條件</div>
        
        <button id="hl-start-btn" disabled style="
            width: 100%; padding: 12px; background: #6c757d; color: white;
            border: none; border-radius: 6px; font-weight: bold; cursor: not-allowed; font-size: 14px; transition: 0.3s;
        ">等待條件中</button>
    `;

    panel.appendChild(closeBtn);
    document.body.appendChild(sideBtn);
    document.body.appendChild(panel);

    // ==========================================
    // 拖曳功能實作
    // ==========================================
    let isDragging = false;
    sideBtn.addEventListener('mousedown', (e) => {
        isDragging = false;
        let startY = e.clientY;
        let startTop = parseFloat(window.getComputedStyle(sideBtn).top);
        sideBtn.style.cursor = 'grabbing';

        const onMouseMove = (moveEvent) => {
            let dy = moveEvent.clientY - startY;
            if (Math.abs(dy) > 3) isDragging = true;
            if (isDragging) {
                sideBtn.style.top = `${startTop + dy}px`;
                panel.style.top = `${startTop + dy}px`;
            }
        };

        const onMouseUp = () => {
            sideBtn.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    sideBtn.addEventListener('click', (e) => {
        if (isDragging) {
            e.stopPropagation();
            return;
        }
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // ==========================================
    // 2. 接收 Background 攔截，並重置 UI
    // ==========================================
    let activePayload = null;
    let activeApiUrl = "";
    let activeQuerySignature = "";
    let isDownloading = false;

    const startBtn = document.getElementById('hl-start-btn');
    const statusText = document.getElementById('hl-status');
    const progressWrapper = document.getElementById('hl-progress-wrapper');
    const circle = document.getElementById('hl-circle');
    const circleText = document.getElementById('hl-circle-text');

    function resetProgressIndicator() {
        circle.classList.remove('hl-loading', 'hl-complete');
        circle.style.background = 'conic-gradient(#eee 100%, #eee 0)';
        circleText.innerText = '0%';
    }

    function showLoadingIndicator() {
        panel.style.display = 'block';
        progressWrapper.style.display = 'flex';
        circle.classList.remove('hl-complete');
        circle.classList.add('hl-loading');
        circleText.innerText = '...';
    }

    function updateProgressIndicator(percent) {
        circle.classList.remove('hl-loading', 'hl-complete');
        circle.style.background = `conic-gradient(#28a745 ${percent}%, #eee 0)`;
        circleText.innerText = `${percent}%`;
    }

    function completeProgressIndicator() {
        circle.classList.remove('hl-loading');
        circle.classList.add('hl-complete');
        circleText.innerText = '完成';
    }

    function buildQuerySignature(payload, apiUrl) {
        const normalizedPayload = JSON.parse(JSON.stringify(payload || {}));

        if (typeof normalizedPayload.QPageInfo === 'string') {
            try {
                const qPageInfo = JSON.parse(normalizedPayload.QPageInfo);
                if (Array.isArray(qPageInfo)) {
                    for (const item of qPageInfo) {
                        if (item && item.name === 'iDisplayStart') item.value = '__PAGE_START__';
                        if (item && item.name === 'iDisplayLength') item.value = '__PAGE_LENGTH__';
                    }
                    normalizedPayload.QPageInfo = JSON.stringify(qPageInfo);
                }
            } catch (_) {
            }
        }

        return `${apiUrl}::${JSON.stringify(normalizedPayload)}`;
    }

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "NEW_PAYLOAD") {
            const incomingSignature = buildQuerySignature(msg.payload, msg.apiUrl);

            if (isDownloading) {
                return;
            }

            if (incomingSignature === activeQuerySignature) {
                return;
            }

            activePayload = JSON.parse(JSON.stringify(msg.payload));
            activeApiUrl = msg.apiUrl;
            activeQuerySignature = incomingSignature;

            // 重置畫面
            statusText.style.color = "#28a745";
            statusText.innerHTML = "✅ 已成功攔截最新條件！<br>隨時可開始下載";
            startBtn.innerText = "開始下載";
            startBtn.disabled = false;
            startBtn.style.background = "#28a745";
            startBtn.style.cursor = "pointer";

            // 隱藏並歸零進度條
            progressWrapper.style.display = "none";
            resetProgressIndicator();
        }
    });

    // ==========================================
    // 3. 欄位格式化邏輯
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
                row.ES_SIMNameS || "", row.ES_DOMDeedNo || "", row.ES_ESTName || "", cleanAddress,
                row.ES_ESTTLArea || "", row.ES_ESTLDArea || "", row.ES_ESTTotalPrice || "",
                row.ES_ESTUPrice || "", row.ES_ESTRent || "",
                caseTypeMap[row.ES_ESTCaseType] || row.ES_ESTCaseType || "",
                categoryMap[row.ES_ESTCategory] || row.ES_ESTCategory || "",
                row.ES_ESTPurposesName || "",
                statusMap[row.ES_ESTStatus] || row.ES_ESTStatus || ""
            ];
            return rowData.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        return { headers, csvContent, prefix: "委託物件" };
    }

    function getFormattedDate() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}${mm}${dd}_${hh}${min}`;
    }

    // ==========================================
    // 4. API 抓取主邏輯
    // ==========================================
    startBtn.addEventListener('click', async () => {
        if (!activePayload || !activeApiUrl) return;

        // 啟動時：按鈕反灰、顯示圓圈進度條
        isDownloading = true;
        startBtn.disabled = true;
        startBtn.style.background = "#ccc";
        startBtn.innerText = "資料抓取中...";
        showLoadingIndicator();
        statusText.style.color = "#333";
        statusText.innerText = "正在建立連線...";

        let allData = [];
        let displayStart = 0;
        const displayLength = 100;

        let qPageInfo = JSON.parse(activePayload.QPageInfo);

        while (true) {
            qPageInfo.find(p => p.name === "iDisplayStart").value = displayStart;
            qPageInfo.find(p => p.name === "iDisplayLength").value = displayLength;
            activePayload.QPageInfo = JSON.stringify(qPageInfo);

            try {
                const response = await fetch(activeApiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=UTF-8",
                        "Accept": "application/json, text/javascript, */*; q=0.01",
                        "X-Requested-With": "XMLHttpRequest"
                    },
                    body: JSON.stringify(activePayload)
                });

                if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

                const textRes = await response.text();
                let jsonRes = JSON.parse(textRes);
                let rawData = typeof jsonRes.d === 'string' ? JSON.parse(jsonRes.d) : jsonRes.d;
                const records = rawData.data || rawData.aaData;

                if (!records || records.length === 0) break;

                allData = allData.concat(records);
                displayStart += displayLength;

                // 畫圈圈邏輯
                let totalRecords = rawData.recordsTotal || rawData.iTotalRecords || allData.length;
                let percent = Math.floor((allData.length / totalRecords) * 100);
                if (percent > 100) percent = 100;

                updateProgressIndicator(percent);
                statusText.innerText = `已抓取：${allData.length} / ${totalRecords} 筆`;

                await new Promise(r => setTimeout(r, 400));

            } catch (e) {
                console.error("API 請求錯誤:", e);
                circle.classList.remove('hl-loading', 'hl-complete');
                statusText.style.color = "#d9534f";
                statusText.innerText = "❌ 發生錯誤，請按F12看Console";
                break;
            }
        }

        isDownloading = false;

        if (allData.length > 0) {
            completeProgressIndicator();
            statusText.style.color = "#28a745";
            statusText.innerText = `✅ 共下載 ${allData.length} 筆資料`;

            const isCommissionedPage = activeApiUrl.includes("CommissionedEstate_Q.aspx");
            const formatResult = isCommissionedPage ? formatCommissionedData(allData) : formatSellingPriceData(allData);

            const finalCsv = "\uFEFF" + formatResult.headers.join(',') + '\n' + formatResult.csvContent.join('\n');
            const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);

            link.download = `${formatResult.prefix}_${getFormattedDate()}.csv`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // 結束後按鈕恢復可點擊狀態
        startBtn.innerText = "再次下載";
        startBtn.disabled = false;
        startBtn.style.background = "#28a745";
    });
})();