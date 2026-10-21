"""Reframe the existing approved artwork; no generation or recoloring.

Usage: python scripts/generate-android-icon.py [--sync-native]
Requires Pillow, already used by corrigir_icones.py.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def generate(sync_native=False):
    original = Image.open(ROOT / "assets/wallet-icon.png").convert("RGBA")
    # Original wallet bounds: x132..246, y95..236, on a 388px canvas.
    # Center at (189.5, 166), rather than at the original image center (194,194).
    # Keep the approved tile/texture and let Android apply its own launcher mask.
    artwork = original.crop((36, 12, 344, 320))
    foreground = artwork.resize((1024, 1024), Image.Resampling.LANCZOS)
    foreground.save(ROOT / "assets/wallet-adaptive-foreground.png")
    if not sync_native:
        return
    resources = ROOT / "android/app/src/main/res"
    # Update only existing generated launcher assets. Never run prebuild here:
    # this checkout contains local native changes from beta 1.0.2.
    for density, scale in [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]:
        directory = resources / f"mipmap-{density}"
        for name, dp in [("ic_launcher_foreground", 108), ("ic_launcher", 48), ("ic_launcher_round", 48)]:
            target = directory / f"{name}.webp"
            if not target.is_file():
                continue
            # Legacy icons contain the masked 72dp viewport of the 108dp layer.
            source = foreground if dp == 108 else foreground.crop((171, 171, 853, 853))
            icon = source.resize((round(dp * scale), round(dp * scale)), Image.Resampling.LANCZOS)
            if name == "ic_launcher_round":
                mask = Image.new("L", icon.size)
                ImageDraw.Draw(mask).ellipse((0, 0, icon.width - 1, icon.height - 1), fill=255)
                icon.putalpha(mask)
            icon.save(target, "WEBP", lossless=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sync-native", action="store_true")
    generate(parser.parse_args().sync_native)
