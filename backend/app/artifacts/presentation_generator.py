import html
import io
import zipfile
from typing import Any, Dict, List


class PresentationGenerator:
    """Deterministic Office Open XML (.pptx) presentation deck generator."""

    @staticmethod
    def generate_pptx(
        title: str,
        subtitle: str,
        slides: List[Dict[str, Any]],
        author: str = "PROJECT FORGE Autonomous Workforce",
    ) -> bytes:
        if not slides:
            slides = [
                {
                    "title": title,
                    "bullets": [
                        subtitle or "Executive architecture and delivery briefing.",
                        "Generated deterministically by PROJECT FORGE 3.0 Artifact Engine.",
                    ],
                }
            ]

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            # 1. [Content_Types].xml
            slide_overrides = "\n".join(
                f'  <Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
                for i in range(1, len(slides) + 1)
            )
            content_types = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
{slide_overrides}
</Types>"""
            zf.writestr("[Content_Types].xml", content_types)

            # 2. _rels/.rels
            root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>"""
            zf.writestr("_rels/.rels", root_rels)

            # 3. ppt/presentation.xml
            sld_id_entries = "\n".join(
                f'    <p:sldId id="{255 + i}" r:id="rId{i + 2}"/>'
                for i in range(1, len(slides) + 1)
            )
            presentation_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
{sld_id_entries}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"""
            zf.writestr("ppt/presentation.xml", presentation_xml)

            # 4. ppt/_rels/presentation.xml.rels
            pres_rels_items = "\n".join(
                f'  <Relationship Id="rId{i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>'
                for i in range(1, len(slides) + 1)
            )
            pres_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
{pres_rels_items}
</Relationships>"""
            zf.writestr("ppt/_rels/presentation.xml.rels", pres_rels)

            # 5. Slide Master, Layout & Theme
            zf.writestr(
                "ppt/slideMasters/slideMaster1.xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>""",
            )
            zf.writestr(
                "ppt/slideMasters/_rels/slideMaster1.xml.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>""",
            )
            zf.writestr(
                "ppt/slideLayouts/slideLayout1.xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="titleAndObj">
  <p:cSld name="Title and Content"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
</p:sldLayout>""",
            )
            zf.writestr(
                "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>""",
            )
            zf.writestr(
                "ppt/theme/theme1.xml",
                f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="{html.escape(author)}">
  <a:themeElements/>
</a:theme>""",
            )

            # 6. Individual Slides
            for idx, slide in enumerate(slides, start=1):
                stitle = html.escape(str(slide.get("title") or f"Slide {idx}"))
                bullets = slide.get("bullets") or slide.get("points") or []
                if isinstance(bullets, str):
                    bullets = [bullets]

                paragraphs = [
                    f'<a:p><a:r><a:rPr lang="en-US" sz="2800" b="1"/><a:t>{stitle}</a:t></a:r></a:p>'
                ]
                for b in bullets:
                    b_esc = html.escape(str(b))
                    paragraphs.append(
                        f'<a:p><a:r><a:rPr lang="en-US" sz="1800"/><a:t>• {b_esc}</a:t></a:r></a:p>'
                    )
                paragraphs_xml = "\n            ".join(paragraphs)

                slide_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="SlideContent_{idx}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="685800"/>
            <a:ext cx="10820400" cy="5486400"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square"/>
          <a:lstStyle/>
            {paragraphs_xml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>"""
                zf.writestr(f"ppt/slides/slide{idx}.xml", slide_xml)
                zf.writestr(
                    f"ppt/slides/_rels/slide{idx}.xml.rels",
                    """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>""",
                )

        return buf.getvalue()
