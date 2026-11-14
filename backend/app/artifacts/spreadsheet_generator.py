import html
import io
import zipfile
from typing import Any, List


class SpreadsheetGenerator:
    """Deterministic Office Open XML (.xlsx) workbook generator."""

    @staticmethod
    def generate_xlsx(
        sheet_name: str,
        headers: List[str],
        rows: List[List[Any]],
    ) -> bytes:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                "[Content_Types].xml",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>""",
            )
            zf.writestr(
                "_rels/.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>""",
            )
            safe_sheet = html.escape((sheet_name or "Sheet1")[:31])
            zf.writestr(
                "xl/workbook.xml",
                f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="{safe_sheet}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>""",
            )
            zf.writestr(
                "xl/_rels/workbook.xml.rels",
                """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>""",
            )

            all_rows = [headers] + rows
            row_xml_list: List[str] = []
            for r_idx, r_vals in enumerate(all_rows, start=1):
                cells: List[str] = []
                for c_idx, val in enumerate(r_vals):
                    col_letter = chr(65 + (c_idx % 26))
                    cell_ref = f"{col_letter}{r_idx}"
                    if isinstance(val, (int, float)) and not isinstance(val, bool):
                        cells.append(f'<c r="{cell_ref}"><v>{val}</v></c>')
                    else:
                        esc = html.escape(str(val))
                        cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{esc}</t></is></c>')
                row_xml_list.append(f'    <row r="{r_idx}">{"".join(cells)}</row>')

            rows_joined = "\n".join(row_xml_list)
            sheet_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
{rows_joined}
  </sheetData>
</worksheet>"""
            zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)

        return buf.getvalue()
