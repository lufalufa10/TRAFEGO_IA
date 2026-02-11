# pontuador.py
import re

# =========================
# SINAIS (melhorados)
# =========================

# sinais de que é uma página de venda / conversão
SINAIS_CTA = [
    "comprar", "compre", "inscreva-se", "inscrever", "matricule-se",
    "quero", "garanta", "garantir", "acessar", "acesso imediato",
    "checkout", "pague", "oferta", "vagas", "bônus", "bonus",
    "clique aqui", "assinar", "assinatura", "entrar", "inscrição", "inscricao",
    "aproveite", "últimas vagas", "ultima vaga", "quero me inscrever",
]

# sinais fortes de venda (ajudam a diferenciar de institucional)
SINAIS_VENDA_FORTE = [
    "garantia", "7 dias", "15 dias", "30 dias",
    "depoimentos", "depoimento", "avaliacoes", "avaliações",
    "bônus", "bonus", "aulas", "módulos", "modulos",
    "certificado", "acesso vitalício", "acesso vitalicio",
    "vitalício", "vitalicio", "turma", "vagas",
    "parcelas", "parcelamento", "pix", "cartão", "cartao",
]

# institucional / rodapé (muitas páginas têm 1 ou 2 disso — NÃO pode ser hard fail sozinho)
SINAIS_INSTITUCIONAL = [
    "nossa história", "nossa historia",
    "carreiras", "imprensa", "investidores", "ri", "governança",
    "política de privacidade", "politica de privacidade",
    "termos de uso", "termos", "lgpd",
    "fale conosco", "contato", "trabalhe conosco",
    "sustentabilidade", "ouvidoria", "cnpj", "endereço", "endereco",
]

# notícia / portal / conteúdo jornalístico
SINAIS_NOTICIA = [
    "últimas notícias", "ultimas noticias", "veja também", "leia mais",
    "publicado", "atualizado", "reportagem", "assista", "vídeo", "video",
    "autor:", "por ", "comentários", "comentarios", "categoria:", "tags:",
]

# =========================
# HELPERS
# =========================
def _norm(texto: str) -> str:
    return (texto or "").lower()

def _tem_sinal(texto: str, lista: list[str]) -> bool:
    t = _norm(texto)
    return any(s in t for s in lista)

def _conta_sinais(texto: str, lista: list[str]) -> int:
    t = _norm(texto)
    return sum(1 for s in lista if s in t)

def _tem_preco(texto: str) -> bool:
    """
    Detecta sinais clássicos de preço/checkout.
    """
    t = _norm(texto)
    if "r$" in t:
        return True
    # Ex: 12x de 49,90 | 49.90 | 199,00
    if re.search(r"\b\d{1,3}\s*x\s*de\s*\d{1,4}[,.]\d{2}\b", t):
        return True
    if re.search(r"\b\d{1,5}[,.]\d{2}\b", t):
        # evita falso positivo demais, mas é um bom sinal em landing page
        return True
    return False

def _conteudo_insuficiente(texto: str) -> bool:
    """
    Se o leitor pegou pouco texto, o score tende a ficar errado.
    Em vez de dar 10 sempre, avisamos.
    """
    t = (texto or "").strip()
    # Ajuste fino: abaixo de ~1200 caracteres geralmente é pouca coisa
    return len(t) < 1200


# =========================
# PONTUADOR
# =========================
def pontuar_produto(estrategia: dict, decisao: dict, resumo_pagina: dict) -> dict:
    """
    Score rigoroso (0-100).
    100 deve ser MUITO raro.
    """
    score = 0
    detalhes = []

    texto = (resumo_pagina.get("texto") or "")
    titulo = (resumo_pagina.get("title") or "")
    tudo = f"{titulo} {texto}"

    # 0) Conteúdo insuficiente (não é hard fail, mas derruba)
    if _conteudo_insuficiente(tudo):
        detalhes.append("Conteúdo insuficiente (pouco texto coletado) (-15)")
        score -= 15

    # 1) Contagem de sinais (usado pra hard fail inteligente)
    cta_count = _conta_sinais(tudo, SINAIS_CTA)
    venda_forte_count = _conta_sinais(tudo, SINAIS_VENDA_FORTE)
    inst_count = _conta_sinais(tudo, SINAIS_INSTITUCIONAL)
    noticia_count = _conta_sinais(tudo, SINAIS_NOTICIA)
    tem_preco = _tem_preco(tudo)

    # 2) Hard fail NOTÍCIA (precisa ser "cara" de notícia, não 1 palavra solta)
    # regra: 3+ sinais de notícia e quase nada de venda
    if noticia_count >= 3 and (cta_count + venda_forte_count) <= 1 and not tem_preco:
        return {
            "score": 0,
            "classificacao": "DESCARTAR",
            "detalhes": ["Página parece notícia/conteúdo (hard fail)"],
        }

    # 3) Hard fail INSTITUCIONAL inteligente
    # regra: 3+ sinais institucionais E pouquíssima venda
    # (rodapé sozinho NÃO deve derrubar)
    if inst_count >= 3 and (cta_count + venda_forte_count) <= 1 and not tem_preco:
        return {
            "score": 10,
            "classificacao": "DESCARTAR",
            "detalhes": ["Página parece institucional (hard fail)"],
        }

    # =========================
    # PONTOS POSITIVOS
    # =========================

    # 4) Nicho (máx 20)
    nicho = estrategia.get("nicho", "indefinido")
    if nicho and nicho != "indefinido" and nicho != "erro":
        score += 20
        detalhes.append("Nicho identificado (+20)")
    else:
        detalhes.append("Nicho indefinido (+0)")

    # 5) Promessa (máx 20) — menos “injusta”
    promessa = (estrategia.get("promessa") or "").strip()
    if promessa and len(promessa) >= 70:
        score += 20
        detalhes.append("Promessa forte (>=70 chars) (+20)")
    elif promessa and len(promessa) >= 40:
        score += 12
        detalhes.append("Promessa média (>=40 chars) (+12)")
    elif promessa and len(promessa) >= 18:
        score += 6
        detalhes.append("Promessa fraca (>=18 chars) (+6)")
    else:
        detalhes.append("Promessa muito fraca (+0)")

    # 6) Intenção de compra / CTA (máx 28)
    # agora considera CTA + sinais fortes + preço
    venda_total = cta_count + venda_forte_count + (2 if tem_preco else 0)

    if venda_total >= 8:
        score += 28
        detalhes.append("Sinais fortes de venda/CTA (muitos) (+28)")
    elif venda_total >= 5:
        score += 20
        detalhes.append("Sinais bons de venda/CTA (+20)")
    elif venda_total >= 3:
        score += 12
        detalhes.append("Sinais moderados de venda/CTA (+12)")
    elif venda_total >= 1:
        score += 5
        detalhes.append("Poucos sinais de venda/CTA (+5)")
    else:
        detalhes.append("Nenhum sinal claro de venda/CTA (+0)")

    # 7) Canais definidos (máx 10)
    canais = estrategia.get("canais_recomendados", []) or []
    if canais:
        score += 10
        detalhes.append("Canais definidos (+10)")
    else:
        detalhes.append("Sem canais definidos (+0)")

    # 8) Decisão do classificador (máx 14) — reduz impacto
    decisao_final = (decisao.get("decisao") or "").upper()
    if decisao_final == "TESTAR":
        score += 14
        detalhes.append("Classificador liberou TESTAR (+14)")
    elif decisao_final == "AJUSTAR":
        score += 6
        detalhes.append("Classificador pediu AJUSTAR (+6)")
    else:
        detalhes.append("Classificador não liberou (+0)")

    # =========================
    # PENALIDADES (soft)
    # =========================
    penal = 0

    # penalidade proporcional ao “cheiro” institucional, mas NÃO hard fail
    if inst_count >= 1:
        penal += min(12, inst_count * 4)  # 1 sinal = -4, 2 = -8, 3 = -12
        detalhes.append(f"Sinais institucionais detectados (-{min(12, inst_count * 4)})")

    # termos que costumam indicar institucionalidade / generalidade
    t = _norm(tudo)
    if "empresa" in t:
        penal += 4
        detalhes.append("Termo 'empresa' (-4)")
    if "clientes" in t:
        penal += 3
        detalhes.append("Termo 'clientes' (-3)")
    if "prêmio" in t or "premio" in t:
        penal += 2
        detalhes.append("Termo 'prêmio/premio' (-2)")

    if penal:
        score = score - penal

    # clamp
    score = int(max(0, min(100, score)))

    # Classificação final
    if score >= 75:
        classificacao = "TESTAR"
    elif score >= 45:
        classificacao = "AJUSTAR"
    else:
        classificacao = "DESCARTAR"

    return {"score": score, "classificacao": classificacao, "detalhes": detalhes}
