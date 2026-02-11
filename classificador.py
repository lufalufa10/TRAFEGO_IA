# classificador.py

def classificar_produto(estrategia: dict) -> dict:
    nicho = estrategia.get("nicho", "indefinido")
    promessa = estrategia.get("promessa", "").strip()
    canais = estrategia.get("canais_recomendados", [])

    # Regras de decisão
    if nicho == "indefinido":
        return {
            "decisao": "AJUSTAR",
            "motivo": "Nicho não identificado claramente"
        }

    if not promessa or len(promessa) < 40:
        return {
            "decisao": "AJUSTAR",
            "motivo": "Promessa fraca ou pouco clara"
        }

    if not canais:
        return {
            "decisao": "AJUSTAR",
            "motivo": "Canais de tráfego não definidos"
        }

    # Caso negativo explícito (exemplo simples)
    if "grátis" in promessa.lower() and "vendas" not in promessa.lower():
        return {
            "decisao": "DESCARTAR",
            "motivo": "Promessa não orientada a conversão"
        }

    return {
        "decisao": "TESTAR",
        "motivo": "Nicho identificado, promessa clara e canais definidos"
    }
