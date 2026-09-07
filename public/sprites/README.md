# 柯基動畫素材

**這個資料夾的三個 PNG 是產物，不要手動編輯。** 它們由 `art/raw/corgi-all.png`
切出來：

```bash
python scripts/normalize-sprites.py --single art/raw/corgi-all.png
```

原始素材的規格、以及可直接貼給圖像模型的提示詞，都在 `art/PROMPT.md`。

## 目前的三個檔案

| 檔名 | 排版 | 影格數 | 長度 | 說明 |
| --- | --- | --- | --- | --- |
| `corgi-start.png` | 8×1 | 8 | 0.5s | 從窗台下方升起、吐一下舌頭。放下柯基時播一次 |
| `corgi-idle.png` | 8×2 | 16 | 1.0s | 待機、眨眼 |
| `corgi-loop.png` | 8×2 | 16 | 1.2s | 往上嗅、轉頭側嗅、回正 |

播放順序：`START →（IDLE → LOOP）→（IDLE → LOOP）→ …`，三段都約 16 fps。

檔案不在時遊戲會退回 `src/ui/CorgiDrawing.tsx` 的手繪 SVG，照常能玩 ——
美術與程式的時程因此可以分開。

## 換素材的流程

1. 新圖放進 `art/raw/corgi-all.png`（舊的先刪掉或改名，那裡是校正的唯一來源）
2. 跑上面那行指令。格線靠內容帶自動偵測，不必指定欄數排數；偵測到的排數與
   腳本裡的 `SEGMENTS` 對不上會直接報錯，不會默默切出錯位的結果
3. 對照腳本印出的格數，更新兩處設定：
   - `src/ui/sprites.ts` 的 `SHEETS.frames`
   - `scripts/normalize-sprites.py` 的 `SEGMENTS`（每段佔幾排）

## 前端對這三個檔案的要求

排版不用固定，程式會從圖檔長寬比自動推算幾欄幾排（原理見 `sprites.ts` 的
`deriveLayout`）。校正腳本的輸出天然滿足下列條件，這裡列出來是為了萬一要
手工替換時有依據：

- 每格**正方形**、**等大**，排成**完整的矩形網格**，由左至右、由上而下
- 網格必須**填滿**：欄數 × 排數 要正好等於影格數
- 整張圖**不能有多餘留白**，邊緣切齊格線
- **背景透明**（PNG-32）。格子底色是區域顏色，白底會變成一個白方塊
- 角色在每格中的位置要對齊，否則播放時會抖動
- 單格 128×128 到 256×256 之間（9×9 盤面上一格約 40–90 px）

## 換成其他格式

`sprites.ts` 只認檔名與影格數，換成 `.webp` 之類的只要改 `SHEETS` 的 `file`。
若素材是每格一張獨立圖檔而不是 sheet，`CorgiSprite` 的 `background-position`
逐格捲動就不適用，需要改成預載一組 URL 再逐格切換。
