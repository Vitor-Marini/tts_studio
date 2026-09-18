import csv
import io
import re
from pathlib import Path
from typing import List, Dict, Tuple, Any

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
    """Inspeciona o arquivo CSV e retorna colunas, delimitador, contagem e prévia."""
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
        "preview": rows
    }

def sanitize_filename(name: str, target_format: str = "wav") -> str:
    """Sanitiza o nome de arquivo para evitar caracteres ilegais e path traversal."""
    name = str(name).strip()
    # Remove caracteres ilegais
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    # Remove tentativas de path traversal
    clean = clean.replace("..", "").strip()
    if not clean:
        clean = "audio"
    
    target_ext = f".{target_format.lower().lstrip('.')}"
    current_ext = Path(clean).suffix.lower()
    
    if current_ext in [".wav", ".mp3"]:
        clean = Path(clean).stem + target_ext
    else:
        clean = clean + target_ext
        
    return clean
