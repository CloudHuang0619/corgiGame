"""
Sprite sheet 校正工具

AI 產出的動畫表很少是像素對齊的：排與排的間距不一致、底部多留白、
格子不是正方形。直接餵給前端就會錯位或被拉扁。

這支腳本以「地平線」為基準重新對齊。每一格底下都有那條橫線，而且同一排
裡的位置固定，是整張圖最可靠的錨點 —— 比用內容外框對齊穩，因為角色本身
會上下移動（START 就是從畫面外升起來的）。

流程：
  1. 用透明帶把圖切成幾排
  2. 每一排找出地平線（該排不透明像素最多的那一列）
  3. 量出所有影格相對地平線的最大上緣與下緣
  4. 用這個尺寸開一張正方形畫布，把每一格的內容依地平線對齊放進去
  5. 輸出格線切齊、正方形、無多餘留白的新表

用法：
    python scripts/normalize-sprites.py public/sprites/corgi-start.png --frames 20

原圖會先備份到 art/raw/，然後就地覆寫成校正後的版本。
"""

import argparse
import math
import os
import shutil

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(HERE, "..", "art", "raw")

ALPHA_THRESHOLD = 16


def find_row_bands(alpha, min_gap=4):
    """用整列全透明的空白帶，把圖切成幾排。回傳 [(y0, y1), ...]。"""
    row_has_content = (alpha > ALPHA_THRESHOLD).sum(axis=1) > 0
    bands = []
    start = None
    for y, filled in enumerate(row_has_content):
        if filled and start is None:
            start = y
        elif not filled and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, len(row_has_content) - 1))

    # 角色身上的細縫也會產生空白列，把靠得太近的段落併回去
    merged = []
    for band in bands:
        if merged and band[0] - merged[-1][1] - 1 < min_gap:
            merged[-1] = (merged[-1][0], band[1])
        else:
            merged.append(band)
    return merged


def find_ground_line(alpha, y0, y1):
    """在這一排裡找地平線：不透明像素最多的那一列，通常也是最靠下的尖峰。"""
    counts = (alpha[y0 : y1 + 1] > ALPHA_THRESHOLD).sum(axis=1)
    peak = int(counts.max())
    # 取最靠下、且接近尖峰的那一列 —— 角色本身也可能有很寬的一列
    candidates = [i for i, c in enumerate(counts) if c >= peak * 0.95]
    return y0 + candidates[-1]


def normalize(path, frames, out_path):
    image = Image.open(path).convert("RGBA")
    pixels = np.array(image)
    alpha = pixels[:, :, 3]
    height, width = alpha.shape

    bands = find_row_bands(alpha)
    rows = len(bands)
    cols = math.ceil(frames / rows)
    if cols * rows != frames:
        print("  !! %d 排 × %d 欄 = %d，與影格數 %d 不符" % (rows, cols, rows * cols, frames))
    cell_w = width // cols
    print("  偵測：%d 欄 × %d 排，單格寬 %d，排區間 %s" % (cols, rows, cell_w, bands))

    grounds = [find_ground_line(alpha, y0, y1) for (y0, y1) in bands]
    print("  地平線 y：%s" % grounds)

    # 量出所有影格相對地平線的最大上緣／下緣
    above = 0
    below = 0
    for r, (y0, y1) in enumerate(bands):
        for c in range(cols):
            sub = alpha[y0 : y1 + 1, c * cell_w : (c + 1) * cell_w]
            filled = np.nonzero((sub > ALPHA_THRESHOLD).sum(axis=1))[0]
            if len(filled) == 0:
                continue
            top = y0 + int(filled[0])
            bottom = y0 + int(filled[-1])
            above = max(above, grounds[r] - top)
            below = max(below, bottom - grounds[r])

    # 正方形格子，長寬取所需的最大值
    cell = max(cell_w, above + below + 1)
    if cell % 2:
        cell += 1
    ground_offset = above + (cell - (above + below + 1)) // 2
    print("  內容上緣 %d、下緣 %d → 單格 %dx%d，地平線置於第 %d 列" % (above, below, cell, cell, ground_offset))

    sheet = Image.new("RGBA", (cell * cols, cell * rows), (0, 0, 0, 0))
    x_pad = (cell - cell_w) // 2

    for r, (y0, y1) in enumerate(bands):
        for c in range(cols):
            index = r * cols + c
            if index >= frames:
                break
            # 以地平線對齊：來源要取的上緣就是「地平線往上 ground_offset」
            src_top = grounds[r] - ground_offset
            src_bottom = src_top + cell
            # 夾在本排的範圍內，避免抓到隔壁排的內容
            clip_top = max(src_top, y0 if r > 0 else 0)
            clip_bottom = min(src_bottom, y1 + 1 if r < rows - 1 else height)

            frame = image.crop((c * cell_w, clip_top, (c + 1) * cell_w, clip_bottom))
            sheet.paste(frame, (c * cell + x_pad, r * cell + (clip_top - src_top)), frame)

    sheet.save(out_path)
    print("  輸出 %s（%dx%d，%d 欄 × %d 排）" % (out_path, sheet.width, sheet.height, cols, rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="要校正的 sprite sheet")
    ap.add_argument("--frames", type=int, required=True, help="影格總數")
    ap.add_argument("--out", help="輸出路徑（預設就地覆寫，原圖備份到 art/raw/）")
    args = ap.parse_args()

    src = os.path.abspath(args.path)
    out = os.path.abspath(args.out) if args.out else src

    if out == src:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        backup = os.path.join(BACKUP_DIR, os.path.basename(src))
        if not os.path.exists(backup):
            shutil.copy2(src, backup)
            print("原圖備份到 %s" % backup)

    print("校正 %s" % src)
    normalize(src, args.frames, out)


if __name__ == "__main__":
    main()
