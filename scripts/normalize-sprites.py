"""
Sprite sheet 校正工具

產圖工具輸出的動畫表很少能直接用：畫布留白過多、排與排沒對齊、格子不是
正方形，有時還會把格線和編號畫進圖裡。這支腳本把它們整成前端要的格式。

作法是「切格 → 取內容 → 重新對齊」：
  1. 依指定的欄數／排數把畫布均分成格
  2. （選用）先剝掉格線與編號
  3. 量出每一格裡實際有畫東西的範圍
  4. 開一張正方形畫布，把每格內容以「底部對齊、水平置中」放進去
  5. 輸出格線切齊、正方形、無多餘留白的新表

底部對齊是因為這組動畫都是「趴上窗台往外看」—— 角色被下緣切斷，那條切線
就是最穩定的基準。用內容中心對齊反而會讓角色在播放時上下漂。

用法：
    python scripts/normalize-sprites.py public/sprites/corgi-start.png --cols 6 --rows 2
    python scripts/normalize-sprites.py public/sprites/corgi-loop.png --cols 6 --rows 4 \
        --strip-grid 3 --strip-label 90x60

原圖會先備份到 art/raw/，然後就地覆寫成校正後的版本。
"""

import argparse
import os
import shutil

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(HERE, "..", "art", "raw")

ALPHA_THRESHOLD = 16


def find_row_bands(alpha, min_gap=8):
    """用整列全透明的空白帶，找出每一排實際佔用的 y 範圍。"""
    filled = (alpha > ALPHA_THRESHOLD).sum(axis=1) > 0
    bands = []
    start = None
    for y, on in enumerate(filled):
        if on and start is None:
            start = y
        elif not on and start is not None:
            bands.append([start, y - 1])
            start = None
    if start is not None:
        bands.append([start, len(filled) - 1])

    # 角色身上的細縫也會產生空白列，把靠太近的段落併回去
    merged = []
    for band in bands:
        if merged and band[0] - merged[-1][1] - 1 < min_gap:
            merged[-1][1] = band[1]
        else:
            merged.append(band)
    return [tuple(b) for b in merged]


def row_ranges(alpha, height, rows):
    """
    決定每一排的 y 範圍。

    優先用內容帶，因為產圖工具排版時排距未必等分 —— 實測有一張的兩排相距
    339px，但畫布高度對半是 362，平均分割會把第一排的下緣切進第二排，
    在畫面上就是憑空多出一條橫槓。帶數對不上時才退回平均分割。
    """
    bands = find_row_bands(alpha)
    if len(bands) == rows:
        print("  排距由內容帶決定：%s" % (bands,))
        return bands
    print("  內容帶有 %d 段、需要 %d 排，改用平均分割" % (len(bands), rows))
    return [(round(r * height / rows), round((r + 1) * height / rows) - 1) for r in range(rows)]


def cell_boxes(width, cols, bands):
    """欄用平均分割（產圖工具的欄距一向是準的），排用傳進來的範圍。"""
    for r, (y0, y1) in enumerate(bands):
        for c in range(cols):
            x0 = round(c * width / cols)
            x1 = round((c + 1) * width / cols)
            yield (r, c, x0, y0, x1, y1 + 1)


def content_bbox(alpha):
    """這一格裡實際有畫東西的範圍；整格空白回傳 None。"""
    ys = np.nonzero((alpha > ALPHA_THRESHOLD).sum(axis=1))[0]
    xs = np.nonzero((alpha > ALPHA_THRESHOLD).sum(axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])


def normalize(path, cols, rows, out_path, strip_grid=0, strip_label=None, pad=0.04):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    frames = cols * rows
    print("  來源 %dx%d，切成 %d 欄 × %d 排 = %d 格" % (width, height, cols, rows, frames))

    bands = row_ranges(np.array(image)[:, :, 3], height, rows)

    # 先把每一格裁出來，順便剝掉格線與編號
    tiles = []
    for r, c, x0, y0, x1, y1 in cell_boxes(width, cols, bands):
        tile = image.crop((x0 + strip_grid, y0 + strip_grid, x1 - strip_grid, y1 - strip_grid))
        if strip_label:
            # 編號畫在每格左上角的空白處，整塊清成透明
            lw, lh = strip_label
            eraser = Image.new("RGBA", (min(lw, tile.width), min(lh, tile.height)), (0, 0, 0, 0))
            tile.paste(eraser, (0, 0))
        tiles.append(((r, c), tile))

    # 量出所有格子裡內容的最大寬高，決定共用的格子尺寸
    boxes = []
    for key, tile in tiles:
        box = content_bbox(np.array(tile)[:, :, 3])
        boxes.append((key, tile, box))
        if box is None:
            print("  !! 第 %d 格是空的" % (key[0] * cols + key[1] + 1))

    widths = [b[2] - b[0] + 1 for _, _, b in boxes if b]
    heights = [b[3] - b[1] + 1 for _, _, b in boxes if b]
    if not widths:
        raise SystemExit("整張圖都是空的")

    cell = max(max(widths), max(heights))
    cell = int(round(cell * (1 + pad)))
    if cell % 2:
        cell += 1
    print(
        "  內容最大 %dx%d → 單格 %dx%d（含 %d%% 邊距）"
        % (max(widths), max(heights), cell, cell, round(pad * 100))
    )

    sheet = Image.new("RGBA", (cell * cols, cell * rows), (0, 0, 0, 0))
    # 底部留一點空隙，角色才不會緊貼格子下緣
    bottom_margin = (cell - max(heights)) // 2

    for (r, c), tile, box in boxes:
        if box is None:
            continue
        cropped = tile.crop((box[0], box[1], box[2] + 1, box[3] + 1))
        dx = c * cell + (cell - cropped.width) // 2
        dy = r * cell + cell - bottom_margin - cropped.height
        sheet.paste(cropped, (dx, dy), cropped)

    sheet.save(out_path)
    print("  輸出 %s（%dx%d）" % (out_path, sheet.width, sheet.height))


def parse_size(text):
    w, h = text.lower().split("x")
    return int(w), int(h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", type=int, required=True)
    ap.add_argument("--strip-grid", type=int, default=0, help="每格四周先裁掉幾像素（去格線）")
    ap.add_argument("--strip-label", type=parse_size, default=None, help="清掉左上角編號的區域，例如 90x60")
    ap.add_argument("--out")
    args = ap.parse_args()

    target = os.path.abspath(args.path)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    backup = os.path.join(BACKUP_DIR, os.path.basename(target))

    # art/raw/ 是原始檔的唯一來源。校正是破壞性的，若拿已經校正過的結果再校正
    # 一次只會愈跑愈糟，所以永遠從備份讀、寫回 public/sprites/。
    if not os.path.exists(backup):
        shutil.copy2(target, backup)
        print("原圖備份到 %s" % backup)
    src = backup
    out = os.path.abspath(args.out) if args.out else target

    print("校正 %s → %s" % (src, out))
    normalize(src, args.cols, args.rows, out, args.strip_grid, args.strip_label)


if __name__ == "__main__":
    main()
