import csv
import io
import re
from pathlib import Path
from typing import List, Dict, Tuple, Any

def detect_encoding(file_path: Path) -> str:
    """Detecta a codificação (UTF-8, Latin-1, etc.) do arquivo."""
    encodings = ["utf-8", "utf-8-sig", "latin-1", "iso-8859-1", "cp1252"]
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                f.read(4096)
                return enc
        except UnicodeDecodeError:
            continue
    return "utf-8"

def detect_encoding_and_delimiter(file_path: Path) -> Tuple[str, str]:
    """Detecta a codificação (UTF-8, Latin-1) e o delimitador (, ou ;) do CSV."""
    encodings = ["utf-8", "utf-8-sig", "latin-1", "iso-8859-1", "cp1252"]
    
    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                sample = f.read(4096)
                if not sample:
                    return enc, ","
                sniffer = csv.Sniffer()
                try:
                    dialect = sniffer.sniff(sample, delimiters=[",", ";", "\t"])
                    delimiter = dialect.delimiter
                except Exception:
                    # Fallback por contagem se o sniffer falhar
                    delimiter = ";" if sample.count(";") > sample.count(",") else ","
                return enc, delimiter
        except UnicodeDecodeError:
            continue
            
    return "utf-8", ","

def inspect_csv(file_path: Path) -> Dict[str, Any]:
    """Inspeciona arquivo CSV ou TXT e retorna colunas, delimitador, contagem e prévia."""
    # Se for arquivo .txt, trata como lista de frases (uma por linha)
    if file_path.suffix.lower() == ".txt":
        encoding = detect_encoding(file_path)
        with open(file_path, "r", encoding=encoding) as f:
            lines = [l.strip() for l in f if l.strip()]
        
        preview = [{"Texto": l} for l in lines[:5]]
        return {
            "encoding": encoding,
            "delimiter": "\n",
            "columns": ["Texto"],
            "total_rows": len(lines),
            "preview": preview,
            "is_txt": True
        }

    encoding, delimiter = detect_encoding_and_delimiter(file_path)
    
    with open(file_path, "r", encoding=encoding) as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        columns = reader.fieldnames or []
        # Remove espaços em branco dos nomes das colunas
        cleaned_columns = [col.strip() for col in columns if col]
        
        rows = []
        total_rows = 0
        for row in reader:
            total_rows += 1
            if len(rows) < 5:
                rows.append({k.strip(): (v.strip() if v else "") for k, v in row.items() if k})
                
    return {
        "encoding": encoding,
        "delimiter": delimiter,
        "columns": cleaned_columns,
        "total_rows": total_rows,
        "preview": rows,
        "is_txt": False
    }

def generate_auto_filename(idx: int, target_format: str = "mp3") -> str:
    """Gera um nome de arquivo sequencial padronizado (ex: audio_001.mp3)."""
    ext = target_format.lower().lstrip(".")
    return f"audio_{idx:03d}.{ext}"

def sanitize_filename(name: str, target_format: str = "wav", fallback_idx: int = 1) -> str:
    """Sanitiza o nome de arquivo para evitar caracteres ilegais e path traversal."""
    name = str(name or "").strip()
    if not name or name in ["__auto__", "auto", "none", "null"]:
        return generate_auto_filename(fallback_idx, target_format)

    # Remove caracteres ilegais
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    # Remove tentativas de path traversal
    clean = clean.replace("..", "").strip()
    if not clean:
        return generate_auto_filename(fallback_idx, target_format)
    
    target_ext = f".{target_format.lower().lstrip('.')}"
    current_ext = Path(clean).suffix.lower()
    
    if current_ext in [".wav", ".mp3"]:
        clean = Path(clean).stem + target_ext
    else:
        clean = clean + target_ext
        
    return clean
