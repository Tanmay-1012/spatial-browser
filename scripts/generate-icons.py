"""
Generate standard PNG and SVG icons for Spatial Browser History using only Python standard library.
Produces 16x16, 32x32, 48x48, and 128x128 PNG icons plus an SVG master icon.
"""

import math
import os
import struct
import zlib

def write_png(filename, width, height, rgba_data):
    """Write an RGBA image as a valid PNG using only standard library."""
    def chunk(chunk_type, data):
        length = struct.pack(">I", len(data))
        crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    header = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr = chunk(b"IHDR", ihdr_data)

    raw_lines = bytearray()
    for y in range(height):
        raw_lines.append(0)  # Filter type 0 (None)
        start = y * width * 4
        raw_lines.extend(rgba_data[start : start + width * 4])

    idat = chunk(b"IDAT", zlib.compress(bytes(raw_lines), level=9))
    iend = chunk(b"IEND", b"")

    with open(filename, "wb") as f:
        f.write(header + ihdr + idat + iend)

def render_icon(size):
    """Render a clean spatial graph icon (root node -> 2 child nodes with connecting branches)."""
    rgba = bytearray(size * size * 4)

    # Coordinates scaled to size
    bg_radius = size * 0.46
    cx = size / 2.0
    cy = size / 2.0

    # Node positions (normalized 0..1)
    # Root node on left
    root_x = size * 0.30
    root_y = size * 0.50
    root_r = size * 0.14

    # Child node 1 (top right)
    c1_x = size * 0.72
    c1_y = size * 0.30
    c1_r = size * 0.11

    # Child node 2 (bottom right)
    c2_x = size * 0.72
    c2_y = size * 0.70
    c2_r = size * 0.11

    # Line thickness
    line_w = max(1.5, size * 0.055)

    def dist_to_segment(px, py, x1, y1, x2, y2):
        dx = x2 - x1
        dy = y2 - y1
        l2 = dx * dx + dy * dy
        if l2 == 0:
            return math.hypot(px - x1, py - y1)
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / l2))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return math.hypot(px - proj_x, py - proj_y)

    for y in range(size):
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            idx = (y * size + x) * 4

            # Rounded container background (smooth rounded square or soft squircle)
            dx = abs(px - cx)
            dy = abs(py - cy)
            corner_r = size * 0.22
            half_inner = size * 0.44 - corner_r
            if dx > half_inner and dy > half_inner:
                d_corner = math.hypot(dx - half_inner, dy - half_inner)
                dist_bg = d_corner - corner_r
            else:
                dist_bg = max(dx, dy) - size * 0.44

            # Anti-aliasing alpha for background
            if dist_bg > 0.5:
                continue
            bg_alpha = 1.0 if dist_bg < -0.5 else 0.5 - dist_bg

            # Background color: modern deep indigo / slate (#1E293B -> [30, 41, 59])
            r, g, b = 30, 41, 59

            # Draw edge lines
            d_line1 = dist_to_segment(px, py, root_x, root_y, c1_x, c1_y)
            d_line2 = dist_to_segment(px, py, root_x, root_y, c2_x, c2_y)
            min_line_d = min(d_line1, d_line2)

            if min_line_d < line_w + 0.5:
                line_alpha = 1.0 if min_line_d < line_w - 0.5 else (line_w + 0.5 - min_line_d)
                # Cyan/sky branch color (#38BDF8 -> [56, 189, 248])
                lr, lg, lb = 56, 189, 248
                r = int(r * (1 - line_alpha) + lr * line_alpha)
                g = int(g * (1 - line_alpha) + lg * line_alpha)
                b = int(b * (1 - line_alpha) + lb * line_alpha)

            # Draw root node
            d_root = math.hypot(px - root_x, py - root_y)
            if d_root < root_r + 0.5:
                node_alpha = 1.0 if d_root < root_r - 0.5 else (root_r + 0.5 - d_root)
                # Pure white / light sky node
                nr, ng, nb = 248, 250, 252
                r = int(r * (1 - node_alpha) + nr * node_alpha)
                g = int(g * (1 - node_alpha) + ng * node_alpha)
                b = int(b * (1 - node_alpha) + nb * node_alpha)

            # Draw child nodes
            d_c1 = math.hypot(px - c1_x, py - c1_y)
            if d_c1 < c1_r + 0.5:
                node_alpha = 1.0 if d_c1 < c1_r - 0.5 else (c1_r + 0.5 - d_c1)
                nr, ng, nb = 56, 189, 248
                r = int(r * (1 - node_alpha) + nr * node_alpha)
                g = int(g * (1 - node_alpha) + ng * node_alpha)
                b = int(b * (1 - node_alpha) + nb * node_alpha)

            d_c2 = math.hypot(px - c2_x, py - c2_y)
            if d_c2 < c2_r + 0.5:
                node_alpha = 1.0 if d_c2 < c2_r - 0.5 else (c2_r + 0.5 - d_c2)
                nr, ng, nb = 129, 140, 248
                r = int(r * (1 - node_alpha) + nr * node_alpha)
                g = int(g * (1 - node_alpha) + ng * node_alpha)
                b = int(b * (1 - node_alpha) + nb * node_alpha)

            a = int(bg_alpha * 255)
            rgba[idx] = r
            rgba[idx + 1] = g
            rgba[idx + 2] = b
            rgba[idx + 3] = a

    return bytes(rgba)

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "..", "src", "shared", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 32, 48, 128]
    for size in sizes:
        rgba = render_icon(size)
        out_path = os.path.join(icons_dir, f"icon-{size}.png")
        write_png(out_path, size, size, rgba)
        print(f"Generated {out_path} ({size}x{size})")

    # Generate SVG master icon
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect x="8" y="8" width="112" height="112" rx="28" fill="#1E293B"/>
  <path d="M 38 64 L 92 38" stroke="#38BDF8" stroke-width="7" stroke-linecap="round"/>
  <path d="M 38 64 L 92 90" stroke="#818CF8" stroke-width="7" stroke-linecap="round"/>
  <circle cx="38" cy="64" r="16" fill="#F8FAFC"/>
  <circle cx="92" cy="38" r="13" fill="#38BDF8"/>
  <circle cx="92" cy="90" r="13" fill="#818CF8"/>
</svg>"""
    svg_path = os.path.join(icons_dir, "icon.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Generated {svg_path}")

if __name__ == "__main__":
    main()
