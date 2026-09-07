"""
Sprite sheet 校正工具

產圖工具輸出的動畫表很少能直接用：畫布留白過多、排距不等分、格子不是正方形，
有時還會把格線和編號畫進圖裡。更麻煩的是**三段動畫各自是不同比例畫的** ——
同一隻柯基在 START 和 IDLE 裡佔畫面的比例不一樣，播放時就會忽大忽小。

所以這支腳本一次處理全部三張，而不是一張一張跑：

  1. 依指定的欄／排把每張畫布切格（排距優先用內容帶偵測，因為常常不等分）
  2. （選用）剝掉格線與編號
  3. 量出每張 sheet 內所有影格的內容範圍，取聯集當成該 sheet 的「作用區」
  4. 以作用區裁切每一格 —— 用同一個矩形裁全部，影格之間的相對位移才會保留，
     角色在段落內的移動（例如 START 從畫面外升起）不會被抹平
  5. 跨 sheet 統一縮放：以「頭寬的中位數」為基準。
     頭寬取每一格內容上緣 30% 那一段的寬度，只涵蓋耳朵與額頭。
     取中位數而不是最大值，因為 START 有一格是雙掌舉到頭邊，最大值會被
     那格灌水；取整格全寬也不行，會被前腳張開的姿勢拉偏。
     這是實測五種基準並排比對後最接近的一種，但仍無法完全對齊 ——
     三張素材本來就是各自用不同比例與裁切畫的，後製只能逼近。
     根治要從產圖端統一，見 art/PROMPT.md。
  6. 統一對齊：作用區底緣（也就是「窗台」那條線）對到格子裡的同一個高度

用法：
    python scripts/normalize-sprites.py                       # 三張分開的素材
    python scripts/normalize-sprites.py --single art/raw/corgi-all.png --cols 8 --rows 6

--single 是給「三段畫在同一張圖上」的素材用的（見 art/PROMPT.md）。
那種素材的角色比例天然一致，不必跨 sheet 校正，只要依影格數切成三段即可，
品質也遠比三張分開產的好。

原圖從 art/raw/ 讀、結果寫回 public/sprites/。校正是破壞性的，拿校正過的
結果再校正一次只會愈跑愈糟，所以來源永遠是備份。
"""

import argparse
import os
import shutil
import statistics

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, "..", "art", "raw")
OUT_DIR = os.path.join(HERE, "..", "public", "sprites")

ALPHA_THRESHOLD = 16

# 輸出的單格尺寸。頭寬會被縮到佔這個寬度的 TARGET_FILL，留下的邊距讓圓角
# 裁切不會啃到耳朵。
CELL = 256
TARGET_FILL = 0.62
# 作用區底緣要對到的位置，離格子底部留一點空隙
BOTTOM_MARGIN = 10
# 作用區最多佔格子的比例。留邊是必要的 —— 格子有圓角又會裁切，
# 貼到邊就會啃掉耳朵。頭寬對齊之後某些 sheet 的整體輪廓仍可能偏寬，
# 這道上限確保它們一律再縮進來。
MAX_UNION_FILL = 0.88

# 每張 sheet 的切法。cols/rows 要跟素材實際排版一致。
SHEETS = [
    {"file": "corgi-start.png", "cols": 6, "rows": 2},
    {"file": "corgi-idle.png", "cols": 12, "rows": 1},
    {"file": "corgi-loop.png", "cols": 6, "rows": 4, "strip_grid": 3, "strip_label": (95, 62)},
]


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

    merged = []
    for band in bands:
        if merged and band[0] - merged[-1][1] - 1 < min_gap:
            merged[-1][1] = band[1]
        else:
            merged.append(band)
    return [tuple(b) for b in merged]


def row_ranges(alpha, height, rows):
    """
    決定每一排的 y 範圍。優先用內容帶 —— 產圖工具的排距未必等分，
    實測有一張的兩排相距 339px 但畫布高度對半是 362，平均分割會把第一排的
    下緣切進第二排，畫面上就憑空多出一條橫槓。
    """
    bands = find_row_bands(alpha)
    if len(bands) == rows:
        return bands
    return [(round(r * height / rows), round((r + 1) * height / rows) - 1) for r in range(rows)]


def content_bbox(alpha):
    ys = np.nonzero((alpha > ALPHA_THRESHOLD).sum(axis=1))[0]
    xs = np.nonzero((alpha > ALPHA_THRESHOLD).sum(axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]), int(ys[-1])


# 頭部大約佔內容高度的上面這一段。取太多會吃到前腳，取太少在側面姿勢會抓不到耳朵。
HEAD_BAND = 0.30


def head_width(alpha, box):
    """量頭寬：只看內容上半部的最大寬度，避開前腳與身體。"""
    if box is None:
        return 0
    x0, y0, x1, y1 = box
    band_bottom = y0 + max(1, int((y1 - y0 + 1) * HEAD_BAND))
    band = alpha[y0:band_bottom, x0 : x1 + 1]
    xs = np.nonzero((band > ALPHA_THRESHOLD).sum(axis=0))[0]
    return int(xs[-1] - xs[0] + 1) if len(xs) else 0


def load_tiles(spec):
    """把一張 sheet 切成影格清單，並回傳每格的內容範圍（格內座標）。"""
    path = os.path.join(RAW_DIR, spec["file"])
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    cols, rows = spec["cols"], spec["rows"]
    strip_grid = spec.get("strip_grid", 0)
    strip_label = spec.get("strip_label")

    bands = row_ranges(np.array(image)[:, :, 3], height, rows)
    tiles = []

    for r, (y0, y1) in enumerate(bands):
        for c in range(cols):
            x0 = round(c * width / cols)
            x1 = round((c + 1) * width / cols)
            tile = image.crop((x0 + strip_grid, y0 + strip_grid, x1 - strip_grid, y1 + 1 - strip_grid))
            if strip_label:
                lw, lh = strip_label
                blank = Image.new("RGBA", (min(lw, tile.width), min(lh, tile.height)), (0, 0, 0, 0))
                tile.paste(blank, (0, 0))
            tiles.append(tile)

    boxes = [content_bbox(np.array(t)[:, :, 3]) for t in tiles]
    return image, tiles, boxes, bands


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    prepared = []

    # 第一輪：切格、量尺寸
    for spec in SHEETS:
        raw_path = os.path.join(RAW_DIR, spec["file"])
        if not os.path.exists(raw_path):
            # 沒有備份就先把 public 裡的當原圖存起來
            live = os.path.join(OUT_DIR, spec["file"])
            if not os.path.exists(live):
                raise SystemExit("找不到 %s" % spec["file"])
            os.makedirs(RAW_DIR, exist_ok=True)
            shutil.copy2(live, raw_path)
            print("原圖備份到 %s" % raw_path)

        _, tiles, boxes, bands = load_tiles(spec)
        alphas = [np.array(t)[:, :, 3] for t in tiles]
        heads = [head_width(a, b) for a, b in zip(alphas, boxes) if b]
        reference_width = statistics.median(heads)

        # 作用區：這張 sheet 所有影格內容的聯集。用同一個矩形裁全部，
        # 影格之間的相對位移才會保留。
        lefts = [b[0] for b in boxes if b]
        tops = [b[1] for b in boxes if b]
        rights = [b[2] for b in boxes if b]
        bottoms = [b[3] for b in boxes if b]
        union = (min(lefts), min(tops), max(rights), max(bottoms))

        prepared.append(
            {
                "spec": spec,
                "tiles": tiles,
                "union": union,
                "reference_width": reference_width,
                "bands": bands,
            }
        )
        print(
            "%-18s %d 欄 × %d 排　排區間 %s"
            % (spec["file"], spec["cols"], spec["rows"], bands)
        )
        print(
            "                   頭寬中位數 %.0f　作用區 %dx%d"
            % (reference_width, union[2] - union[0] + 1, union[3] - union[1] + 1)
        )

    # 第二輪：用共同的目標寬度換算各自的縮放比，再輸出
    target_width = CELL * TARGET_FILL
    print("\n目標：柯基寬度統一縮到 %.0f px（單格 %d）" % (target_width, CELL))

    for item in prepared:
        spec = item["spec"]
        cols, rows = spec["cols"], spec["rows"]
        ux0, uy0, ux1, uy1 = item["union"]
        scale = target_width / item["reference_width"]

        union_w = ux1 - ux0 + 1
        union_h = uy1 - uy0 + 1
        out_w = max(1, round(union_w * scale))
        out_h = max(1, round(union_h * scale))

        limit_w = CELL * MAX_UNION_FILL
        limit_h = (CELL - BOTTOM_MARGIN) * MAX_UNION_FILL
        if out_w > limit_w or out_h > limit_h:
            # 超過上限就整體再縮，寧可小一點也不要被圓角啃掉
            shrink = min(limit_w / out_w, limit_h / out_h)
            scale *= shrink
            out_w = max(1, round(union_w * scale))
            out_h = max(1, round(union_h * scale))

        sheet = Image.new("RGBA", (CELL * cols, CELL * rows), (0, 0, 0, 0))
        dx = (CELL - out_w) // 2
        dy = CELL - BOTTOM_MARGIN - out_h

        for index, tile in enumerate(item["tiles"]):
            r, c = divmod(index, cols)
            # 每一格都用同一個作用區矩形裁，相對位移因此完整保留
            cropped = tile.crop((ux0, uy0, ux1 + 1, uy1 + 1)).resize((out_w, out_h), Image.LANCZOS)
            sheet.paste(cropped, (c * CELL + dx, r * CELL + dy), cropped)

        out_path = os.path.join(OUT_DIR, spec["file"])
        sheet.save(out_path)
        print(
            "  %-18s 縮放 %.3f → 作用區 %dx%d，輸出 %dx%d"
            % (spec["file"], scale, out_w, out_h, sheet.width, sheet.height)
        )


def detect_bands(profile, min_gap):
    """從一維的內容剖面找出連續區段，間隔小於 min_gap 的併回去。"""
    out, start = [], None
    for i, on in enumerate(profile):
        if on and start is None:
            start = i
        elif not on and start is not None:
            out.append([start, i - 1])
            start = None
    if start is not None:
        out.append([start, len(profile) - 1])

    merged = []
    for band in out:
        if merged and band[0] - merged[-1][1] - 1 < min_gap:
            merged[-1][1] = band[1]
        else:
            merged.append(band)
    return [tuple(b) for b in merged]


def band_edges(bands, limit):
    """把相鄰兩段的中線當作格線，頭尾延伸到圖的邊緣。"""
    edges = [0]
    for a, b in zip(bands, bands[1:]):
        edges.append((a[1] + b[0]) // 2)
    edges.append(limit)
    return edges


# 三段的切分。每一項是 (輸出檔名, 佔幾排, 輸出時每排幾欄)。
# 排數與素材的版面對應：第 1 排是登場、2–3 排待機、4–5 排嗅聞。
SEGMENTS = [
    ("corgi-start.png", 1, 8),
    ("corgi-idle.png", 2, 8),
    ("corgi-loop.png", 2, 8),
]


def split_single(path, min_gap=4):
    """
    把「三段畫在同一張圖」的素材切成三個 sheet。

    這種素材不需要跨 sheet 縮放校正 —— 所有影格畫在同一張圖上，角色比例與
    窗台高度本來就一致。這裡只做三件事：
      1. 用內容帶偵測真正的格線（產圖工具的格距未必等分，平均分割會切歪）
      2. 用全圖的作用區統一裁切，讓所有影格的取景完全相同
      3. 依排數切成三段輸出
    """
    image = Image.open(path).convert("RGBA")
    alpha = np.array(image)[:, :, 3]
    height, width = alpha.shape

    col_bands = detect_bands((alpha > ALPHA_THRESHOLD).sum(axis=0) > 0, min_gap)
    row_bands = detect_bands((alpha > ALPHA_THRESHOLD).sum(axis=1) > 0, min_gap)
    cols, rows = len(col_bands), len(row_bands)
    print("偵測格線：%d 欄 × %d 排 = %d 格（來源 %dx%d）" % (cols, rows, cols * rows, width, height))

    expected_rows = sum(seg[1] for seg in SEGMENTS)
    if rows != expected_rows:
        raise SystemExit(
            "排數不符：偵測到 %d 排，但 SEGMENTS 需要 %d 排。請確認素材版面或調整 SEGMENTS。"
            % (rows, expected_rows)
        )

    xs = band_edges(col_bands, width)
    ys = band_edges(row_bands, height)

    tiles = []
    for r in range(rows):
        for c in range(cols):
            tiles.append(image.crop((xs[c], ys[r], xs[c + 1], ys[r + 1])))

    boxes = [content_bbox(np.array(t)[:, :, 3]) for t in tiles]
    valid = [b for b in boxes if b]
    if not valid:
        raise SystemExit("整張圖都是空的")

    # 作用區用「格內座標」的聯集。所有影格用同一個矩形裁，取景才會完全一致，
    # 角色在段落內的移動（例如登場時從窗台下升起）也會完整保留。
    union = (
        min(b[0] for b in valid),
        min(b[1] for b in valid),
        max(b[2] for b in valid),
        max(b[3] for b in valid),
    )
    ux0, uy0, ux1, uy1 = union
    union_w, union_h = ux1 - ux0 + 1, uy1 - uy0 + 1

    scale = min((CELL * MAX_UNION_FILL) / union_w, ((CELL - BOTTOM_MARGIN) * MAX_UNION_FILL) / union_h)
    out_w, out_h = max(1, round(union_w * scale)), max(1, round(union_h * scale))
    dx, dy = (CELL - out_w) // 2, CELL - BOTTOM_MARGIN - out_h
    print("  作用區 %dx%d，縮放 %.3f → %dx%d，單格 %d" % (union_w, union_h, scale, out_w, out_h, CELL))

    cropped = [
        t.crop((ux0, uy0, ux1 + 1, uy1 + 1)).resize((out_w, out_h), Image.LANCZOS) for t in tiles
    ]

    row_cursor = 0
    for name, seg_rows, seg_cols in SEGMENTS:
        frames = cropped[row_cursor * cols : (row_cursor + seg_rows) * cols]
        row_cursor += seg_rows
        out_rows = -(-len(frames) // seg_cols)
        sheet = Image.new("RGBA", (CELL * seg_cols, CELL * out_rows), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            r, c = divmod(i, seg_cols)
            sheet.paste(frame, (c * CELL + dx, r * CELL + dy), frame)
        sheet.save(os.path.join(OUT_DIR, name))
        print(
            "  %-18s %2d 格 = %d 欄 × %d 排，輸出 %dx%d"
            % (name, len(frames), seg_cols, out_rows, sheet.width, sheet.height)
        )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--single", help="三段畫在同一張圖的素材路徑")
    ap.add_argument("--min-gap", type=int, default=4, help="格線偵測時視為分隔的最小空白寬度")
    args = ap.parse_args()

    if args.single:
        os.makedirs(OUT_DIR, exist_ok=True)
        split_single(args.single, args.min_gap)
    else:
        main()
