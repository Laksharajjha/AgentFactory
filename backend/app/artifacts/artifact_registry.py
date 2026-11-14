from typing import Dict

ARTIFACT_MIME_TYPES: Dict[str, str] = {
    "PPTX": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "XLSX": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "PDF": "application/pdf",
    "CSV": "text/csv",
    "MARKDOWN": "text/markdown",
    "SOURCE_CODE": "text/plain",
    "ZIP": "application/zip",
    "SVG": "image/svg+xml",
    "PNG": "image/png",
}

ARTIFACT_EXTENSIONS: Dict[str, str] = {
    "PPTX": ".pptx",
    "DOCX": ".docx",
    "XLSX": ".xlsx",
    "PDF": ".pdf",
    "CSV": ".csv",
    "MARKDOWN": ".md",
    "SOURCE_CODE": ".py",
    "ZIP": ".zip",
    "SVG": ".svg",
    "PNG": ".png",
}
