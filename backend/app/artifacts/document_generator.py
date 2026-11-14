import html
import io
import zipfile
from typing import Any, Dict, List


class DocumentGenerator:
    """Deterministic Office Open XML (.docx) technical specification & dossier generator."""

    @staticmethod
    def generate_docx(
        title: str,
        sections: List[Dict[str, Any]],
        author: str = "PROJECT FORGE Autonomous Workforce",
    ) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>""",
            )
            zf.writestr(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>""",
            )

            paragraphs = [
                f'<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>{html.escape(title)}</w:t></w:r></w:p>',
                f'<w:p><w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr><w:t>Prepared by {html.escape(author)}</w:t></w:r></w:p>',
            ]
            for sec in sections:
                heading = html.escape(str(sec.get("heading") or sec.get("title") or "Section"))
                body = html.escape(str(sec.get("content") or sec.get("body") or ""))
                paragraphs.append(
                    f'<w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>{heading}</w:t></w:r></w:p>'
                )
                if body:
                    paragraphs.append(
                        f'<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>{body}</w:t></w:r></w:p>'
                    )
                for item in sec.get("bullets", []):
                    paragraphs.append(
                        f'<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>• {html.escape(str(item))}</w:t></w:r></w:p>'
                    )

            body_xml = "\n    ".join(paragraphs)
            doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body_xml}
  </w:body>
</w:document>"""
            zf.writestr("word/document.xml", doc_xml)

        return buf.getvalue()
