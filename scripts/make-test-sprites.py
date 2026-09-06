"""
產生測試用的 sprite sheet，用來驗證逐格播放機制。

正式素材進來之前，這個腳本讓我們可以確認 CorgiSprite 真的有逐格前進、
三段有正確接力。每一格畫上大大的編號與一條會移動的色條，肉眼就能判斷
現在停在第幾格、有沒有跳格或錯位。

    python scripts/make-test-sprites.py          # 產生到 public/sprites/
    python scripts/make-test-sprites.py --clean  # 刪掉測試圖，恢復手繪備援

注意：這些是測試圖，不是美術素材。正式素材放進同一個資料夾即可覆蓋。
"""

import argparse
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "public", "sprites")

# 與 src/ui/sprites.ts 的 SHEETS 一致
SHEETS = [
    ("corgi-start.png", 24, (232, 138, 69)),
    ("corgi-idle.png", 24, (124, 199, 95)),
    ("corgi-loop.png", 36, (107, 168, 232)),
]

CELL = 128


def build(name, frames, colour):
    sheet = Image.new("RGBA", (CELL * frames, CELL), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sheet)

    for i in range(frames):
        x0 = i * CELL
        # 圓角底 + 編號，一眼看得出目前是第幾格
        draw.rounded_rectangle(
            [x0 + 8, 8, x0 + CELL - 8, CELL - 8], radius=18, fill=colour + (255,)
        )
        label = str(i + 1)
        # 內建字型很小，放大成一個粗方塊條來代替，比字更好判讀
        draw.text((x0 + 14, 12), label, fill=(255, 255, 255, 255))

        # 會隨影格往下移動的橫條：播放時應該平順下移，跳格會看得很清楚
        bar_y = 24 + int((CELL - 64) * i / max(1, frames - 1))
        draw.rectangle(
            [x0 + 24, bar_y, x0 + CELL - 24, bar_y + 14], fill=(255, 255, 255, 235)
        )

    path = os.path.join(OUT_DIR, name)
    sheet.save(path)
    print("寫入 %s（%d 格，%dx%d）" % (path, frames, sheet.width, sheet.height))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", action="store_true", help="刪除測試圖")
    args = ap.parse_args()

    if args.clean:
        for name, _, _ in SHEETS:
            path = os.path.join(OUT_DIR, name)
            if os.path.exists(path):
                os.remove(path)
                print("刪除 %s" % path)
        return

    for name, frames, colour in SHEETS:
        build(name, frames, colour)


if __name__ == "__main__":
    main()
