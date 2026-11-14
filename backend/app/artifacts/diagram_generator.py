import html
import struct
import zlib
from typing import Any, Dict, List


class DiagramGenerator:
    """Deterministic SVG architecture topology and PNG raster image generator."""

    @staticmethod
    def generate_svg(
        title: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
    ) -> bytes:
        if not nodes:
            nodes = [
                {"id": "api", "label": "FastAPI Gateway", "tier": "Edge"},
                {"id": "gov", "label": "Resource Governor", "tier": "Control"},
                {"id": "db", "label": "Neon PostgreSQL", "tier": "Persistence"},
                {"id": "s3", "label": "Artifact Object Store", "tier": "Storage"},
            ]

        box_elements: List[str] = []
        coords: Dict[str, tuple[int, int]] = {}
        for idx, node in enumerate(nodes[:8]):
            col = idx % 4
            row = idx // 4
            x = 60 + col * 210
            y = 110 + row * 140
            nid = str(node.get("id") or f"n{idx}")
            coords[nid] = (x + 85, y + 36)
            label = html.escape(str(node.get("label") or nid)[:22])
            tier = html.escape(str(node.get("tier") or "Service")[:18])
            box_elements.append(
                f'<g transform="translate({x},{y})">'
                f'<rect width="170" height="72" rx="8" fill="#1B2028" stroke="#4778D0" stroke-width="1.5"/>'
                f'<text x="14" y="28" fill="#737D8C" font-family="monospace" font-size="10">{tier}</text>'
                f'<text x="14" y="48" fill="#E8EBF0" font-family="sans-serif" font-weight="600" font-size="13">{label}</text>'
                f"</g>"
            )

        edge_elements: List[str] = []
        for edge in edges:
            src = coords.get(str(edge.get("from")))
            dst = coords.get(str(edge.get("to")))
            if src and dst:
                edge_elements.append(
                    f'<line x1="{src[0]}" y1="{src[1]}" x2="{dst[0]}" y2="{dst[1]}" stroke="#299B83" stroke-width="2" stroke-dasharray="4 4"/>'
                )

        svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 420" width="920" height="420">
  <rect width="920" height="420" fill="#101216"/>
  <text x="60" y="54" fill="#E8EBF0" font-family="sans-serif" font-weight="700" font-size="18">{html.escape(title)}</text>
  <text x="60" y="76" fill="#A5ACB8" font-family="monospace" font-size="11">PROJECT FORGE 3.0 — Verified System Architecture Artifact</text>
  {"".join(edge_elements)}
  {"".join(box_elements)}
</svg>"""
        return svg.encode("utf-8")

    @staticmethod
    def generate_png(width: int = 320, height: int = 180) -> bytes:
        """Generates a valid binary PNG chart/diagram preview using standard zlib + struct."""
        raw_rows = bytearray()
        for y in range(height):
            raw_rows.append(0)  # Filter type 0 (None)
            for x in range(width):
                # Enterprise dark slate gradient with accent grid lines
                is_border = x in (0, width - 1) or y in (0, height - 1)
                is_grid = (x % 40 == 0) or (y % 30 == 0)
                if is_border:
                    r, g, b = (71, 120, 208)  # #4778D0
                elif is_grid:
                    r, g, b = (34, 38, 46)    # #22262E
                else:
                    r, g, b = (16, 18, 22)    # #101216
                raw_rows.extend((r, g, b))

        def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
            crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
            return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

        ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
        idat = zlib.compress(bytes(raw_rows), level=6)
        return (
            b"\x89PNG\r\n\x1a\n"
            + _png_chunk(b"IHDR", ihdr)
            + _png_chunk(b"IDAT", idat)
            + _png_chunk(b"IEND", b"")
        )
