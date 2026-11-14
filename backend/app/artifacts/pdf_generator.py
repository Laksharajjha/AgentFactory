from typing import Any, Dict, List


class PDFGenerator:
    """Deterministic PDF 1.4 binary document generator with valid xref and trailer."""

    @staticmethod
    def _escape_pdf_text(text: str) -> str:
        clean = "".join(c if 32 <= ord(c) <= 126 else " " for c in text)
        return clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    @classmethod
    def generate_pdf(
        cls,
        title: str,
        subtitle: str,
        sections: List[Dict[str, Any]],
    ) -> bytes:
        lines: List[str] = []
        lines.append(f"BT /F1 18 Tf 50 750 Td ({cls._escape_pdf_text(title[:70])}) Tj ET")
        if subtitle:
            lines.append(f"BT /F1 11 Tf 50 730 Td ({cls._escape_pdf_text(subtitle[:90])}) Tj ET")

        y = 700
        for sec in sections:
            if y < 90:
                break
            heading = str(sec.get("heading") or sec.get("title") or "Section")
            lines.append(f"BT /F1 13 Tf 50 {y} Td ({cls._escape_pdf_text(heading[:80])}) Tj ET")
            y -= 18
            body = str(sec.get("content") or sec.get("body") or "")
            if body:
                for chunk_start in range(0, min(len(body), 360), 85):
                    chunk = body[chunk_start : chunk_start + 85]
                    lines.append(f"BT /F1 10 Tf 60 {y} Td ({cls._escape_pdf_text(chunk)}) Tj ET")
                    y -= 14
            for bullet in sec.get("bullets", [])[:6]:
                b_str = f"- {bullet}"[:85]
                lines.append(f"BT /F1 10 Tf 65 {y} Td ({cls._escape_pdf_text(b_str)}) Tj ET")
                y -= 14
            y -= 8

        content_stream = "\n".join(lines).encode("latin-1", errors="ignore")

        objects: List[bytes] = [
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
            b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
            f"5 0 obj\n<< /Length {len(content_stream)} >>\nstream\n".encode("ascii")
            + content_stream
            + b"\nendstream\nendobj\n",
        ]

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: List[int] = []
        for obj in objects:
            offsets.append(len(out))
            out.extend(obj)

        xref_offset = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode("ascii"))
        for off in offsets:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

        out.extend(
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
                "ascii"
            )
        )
        return bytes(out)
