# web_reader.py
import re
import requests
from bs4 import BeautifulSoup


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}


def baixar_html(url: str, timeout: int = 18) -> str:
    """
    Baixa HTML com headers básicos e redirecionamentos.
    NÃO deve explodir o app: se der ruim, levantamos exceção aqui e tratamos em ler_pagina().
    """
    r = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout, allow_redirects=True)
    r.raise_for_status()
    # tenta usar encoding correto
    if not r.encoding:
        r.encoding = "utf-8"
    return r.text


def _limpar_texto(txt: str) -> str:
    txt = re.sub(r"\s+", " ", (txt or "")).strip()
    return txt


def _extrair_texto_visivel(html: str) -> tuple[str, list[str], str]:
    soup = BeautifulSoup(html, "html.parser")

    # remove lixo
    for tag in soup(["script", "style", "noscript", "svg", "img", "header", "footer", "nav", "aside"]):
        tag.decompose()

    title = soup.title.get_text(" ", strip=True) if soup.title else ""

    # H1 até 10, devolvemos só os primeiros depois no app
    h1_tags = soup.find_all("h1")
    h1 = []
    for t in h1_tags[:10]:
        h = t.get_text(" ", strip=True)
        if h:
            h1.append(h)

    # texto bruto
    texto = soup.get_text(" ", strip=True)
    texto = _limpar_texto(texto)

    return texto, h1, title


def ler_pagina(url: str) -> dict:
    """
    Retorna um resumo SEMPRE em dict.
    Nunca deve levantar exceção pro Streamlit.
    """
    try:
        html = baixar_html(url)
        texto, h1, title = _extrair_texto_visivel(html)

        # “pouco texto” é muito comum em sites com JS pesado ou bloqueio
        if len(texto) < 400:
            return {
                "url": url,
                "title": title,
                "h1": h1,
                "texto": texto,
                "erro": "Conteúdo muito curto (site pode usar JS pesado ou bloquear scraping).",
            }

        return {
            "url": url,
            "title": title,
            "h1": h1,
            "texto": texto,
        }

    except requests.exceptions.HTTPError as e:
        code = getattr(e.response, "status_code", None)
        return {
            "url": url,
            "title": "",
            "h1": [],
            "texto": "",
            "erro": f"Erro HTTP ao acessar a página ({code}). Pode ser link inválido, expirado ou bloqueado.",
        }

    except requests.exceptions.Timeout:
        return {
            "url": url,
            "title": "",
            "h1": [],
            "texto": "",
            "erro": "Timeout ao acessar a página (demorou demais). Tente novamente ou use outra URL.",
        }

    except requests.exceptions.RequestException as e:
        return {
            "url": url,
            "title": "",
            "h1": [],
            "texto": "",
            "erro": f"Falha ao acessar a página: {type(e).__name__}",
        }

    except Exception as e:
        return {
            "url": url,
            "title": "",
            "h1": [],
            "texto": "",
            "erro": f"Erro inesperado ao ler a página: {type(e).__name__}",
        }
