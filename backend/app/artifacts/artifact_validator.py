import io
import zipfile
from typing import Dict, Any


class ArtifactValidator:
    """Deterministic binary & structural validator for generated artifacts."""

    @staticmethod
    def validate(artifact_type: str, filename: str, data: bytes) -> Dict[str, Any]:
        fmt = artifact_type.upper()
        if not data or len(data) == 0:
            return {"valid": False, "status": "INVALID", "reason": "Empty artifact payload (0 bytes)."}

        if fmt in ("PPTX", "DOCX", "XLSX", "ZIP"):
            buf = io.BytesIO(data)
            if not zipfile.is_zipfile(buf):
                return {"valid": False, "status": "INVALID", "reason": f"{fmt} is not a valid ZIP/OOXML container."}
            with zipfile.ZipFile(buf, "r") as zf:
                names = set(zf.namelist())
                if fmt == "PPTX" and ("ppt/presentation.xml" not in names or "[Content_Types].xml" not in names):
                    return {"valid": False, "status": "INVALID", "reason": "Missing ppt/presentation.xml in PPTX."}
                if fmt == "DOCX" and ("word/document.xml" not in names or "[Content_Types].xml" not in names):
                    return {"valid": False, "status": "INVALID", "reason": "Missing word/document.xml in DOCX."}
                if fmt == "XLSX" and ("xl/workbook.xml" not in names or "[Content_Types].xml" not in names):
                    return {"valid": False, "status": "INVALID", "reason": "Missing xl/workbook.xml in XLSX."}
            return {"valid": True, "status": "VALID", "byte_size": len(data), "container": "OOXML/ZIP"}

        if fmt == "PDF":
            if not data.startswith(b"%PDF-1.") or b"%%EOF" not in data:
                return {"valid": False, "status": "INVALID", "reason": "Invalid PDF header or missing %%EOF marker."}
            return {"valid": True, "status": "VALID", "byte_size": len(data), "container": "PDF-1.4"}

        if fmt == "PNG":
            if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                return {"valid": False, "status": "INVALID", "reason": "Invalid PNG signature."}
            return {"valid": True, "status": "VALID", "byte_size": len(data), "container": "PNG"}

        if fmt == "SVG":
            text = data.decode("utf-8", errors="ignore")
            if "<svg" not in text or "</svg>" not in text:
                return {"valid": False, "status": "INVALID", "reason": "Invalid SVG root element."}
            return {"valid": True, "status": "VALID", "byte_size": len(data), "container": "SVG+XML"}

        # CSV, MARKDOWN, SOURCE_CODE
        return {"valid": True, "status": "VALID", "byte_size": len(data), "container": fmt}
