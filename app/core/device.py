import os
import torch

def get_device(requested_device: str = "cuda") -> str:
    """
    Retorna o dispositivo a ser utilizado ('cuda' ou 'cpu').
    Faz fallback transparente para 'cpu' se 'cuda' foi solicitado mas não está disponível.
    """
    if requested_device.lower() == "cuda":
        if torch.cuda.is_available():
            return "cuda"
        return "cpu"
    return "cpu"

def configure_torch_threads():
    """Configura o número de threads para execução otimizada em CPU."""
    threads = os.cpu_count() or 4
    torch.set_num_threads(threads)
