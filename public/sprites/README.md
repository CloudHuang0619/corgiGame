# 柯基動畫素材

把三張 sprite sheet 放進這個資料夾，遊戲會自動偵測並改用它們。
檔案不在時會退回 `src/ui/CorgiDrawing.tsx` 的手繪 SVG，遊戲照常能玩。

## 需要的檔案

| 檔名 | 排版 | 影格數 | 長度 | 說明 |
| --- | --- | --- | --- | --- |
| `corgi-start.png` | 6×2 | 12 | 0.5s | 從下方彈出、吐一下舌頭。放下柯基時播一次 |
| `corgi-idle.png` | 12×1 | 12 | 1.0s | 待機 |
| `corgi-loop.png` | 6×4 | 24 | 1.5s | 嗅聞 |

播放順序：`START →（IDLE → LOOP）→（IDLE → LOOP）→ …`
要改影格數或長度，改 `src/ui/sprites.ts` 的 `SHEETS`。

## 格式要求

**排版不用固定**。單排、兩排、三排都可以，程式會從圖檔的長寬比自動推算出
幾欄幾排（原理見 `sprites.ts` 的 `deriveLayout`），所以匯出時不必遷就特定格式。

必須遵守的只有這些：

- 每格**正方形**、**等大**，排成**完整的矩形網格**，由左至右、由上而下
- 網格必須**填滿**：欄數 × 排數 要正好等於影格數，最後一排不能有空格
- 整張圖**不能有多餘留白**，邊緣要切齊格線
- **背景透明**（PNG-32）。格子底色是區域顏色，白底會變成一個白方塊
- **不要有外框線、編號、標題**。那些都會跟著被畫進遊戲裡
- 角色在每格中的位置要對齊，否則播放時會抖動
- 建議單格 128×128 或 256×256（9×9 盤面上一格約 40–90 px，128 已經夠用）

## 對不齊也沒關係

實際收到的三張都不符合上面的要求（畫布留白過多、排距不等分、格線與編號被
畫進圖裡），所以有一支校正腳本負責把它們整乾淨：

```bash
python scripts/normalize-sprites.py public/sprites/corgi-start.png --cols 6 --rows 2
python scripts/normalize-sprites.py public/sprites/corgi-idle.png  --cols 12 --rows 1
python scripts/normalize-sprites.py public/sprites/corgi-loop.png  --cols 6 --rows 4     --strip-grid 3 --strip-label 95x62
```

原圖會備份到 `art/raw/`，之後每次校正都從那裡讀 —— 拿校正過的結果再校正一次
只會愈跑愈糟。`--strip-grid` 裁掉每格四周的格線，`--strip-label` 清掉左上角的
編號。換新素材時把檔案放進 `public/sprites/`、刪掉 `art/raw/` 裡的同名舊檔，
再跑一次即可。

校正後記得確認 `src/ui/sprites.ts` 的 `frames` 與實際格數一致。

## 換成其他格式

`sprites.ts` 只認檔名與影格數，換成 `.webp` 之類的只要改 `SHEETS` 的 `file`。
若素材是每格一張獨立圖檔（不是 sheet），告訴我一聲，改成預載陣列即可。
