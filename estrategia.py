# estrategia.py
import re

# ============================================================
# 50+ nichos (PT-BR) — amplo, mas com proteção anti-"chute"
# ============================================================
PALAVRAS_NICHOS = {
    # --- Marketing / Ads / Vendas
    "marketing_digital": [
        "marketing digital", "conteúdo", "social media", "gestor de tráfego",
        "branding", "engajamento", "criativos", "remarketing", "pixel"
    ],
    "trafego_pago": [
        "tráfego pago", "anúncios", "campanha", "cpc", "cpa", "ctr", "conversão",
        "google ads", "meta ads", "facebook ads", "instagram ads", "tiktok ads",
        "gerenciador de anúncios", "público", "segmentação", "remarketing"
    ],
    "seo": [
        "seo", "palavra-chave", "ranking", "google search", "tráfego orgânico",
        "backlink", "serp", "on-page", "off-page"
    ],
    "copywriting": [
        "copy", "copywriting", "headline", "cta", "gatilhos mentais",
        "oferta", "proposta de valor", "vsl", "script de vendas"
    ],
    "funil_vendas": [
        "funil", "landing page", "página de vendas", "checkout", "upsell",
        "downsell", "lead", "captura", "webinar", "remarketing"
    ],
    "vendas": [
        "vendas", "fechamento", "objeção", "prospecção", "crm", "pipeline",
        "cliente", "negociação"
    ],
    "ecommerce": [
        "ecommerce", "loja virtual", "shopify", "woocommerce", "carrinho",
        "frete", "dropshipping", "marketplace", "produto físico"
    ],

    # --- IA / Tech
    "inteligencia_artificial": [
        "inteligência artificial", "machine learning", "aprendizado de máquina",
        "modelo", "llm", "prompt", "engenharia de prompt", "chatgpt",
        "automação", "agentes", "ia generativa"
    ],
    "programacao": [
        "programação", "python", "javascript", "java", "c#", "c++", "backend",
        "frontend", "api", "git", "github", "framework"
    ],
    "data_science": [
        "data science", "ciência de dados", "pandas", "numpy", "jupyter",
        "estatística", "análise de dados", "dataset"
    ],
    "ciberseguranca": [
        "segurança da informação", "cibersegurança", "pentest", "hacker",
        "vulnerabilidade", "phishing", "malware", "firewall"
    ],
    "cloud_devops": [
        "cloud", "aws", "azure", "gcp", "devops", "docker", "kubernetes",
        "ci/cd", "deploy"
    ],

    # --- Negócios / carreira
    "empreendedorismo": [
        "empreender", "empreendedor", "negócio", "gestão", "escala",
        "modelo de negócios", "startup"
    ],
    "produtividade": [
        "produtividade", "gestão do tempo", "rotina", "hábitos",
        "organização", "foco", "procrastinação", "metas"
    ],
    "carreira_emprego": [
        "carreira", "emprego", "currículo", "entrevista", "linkedin",
        "processo seletivo", "vaga", "networking"
    ],
    "faculdade_academico": [
        "faculdade", "universidade", "tcc", "monografia", "artigo científico",
        "abnt", "pesquisa", "bibliografia", "estudo"
    ],
    "educacao_estudos": [
        "estudar", "aprendizado", "memorização", "concentração",
        "provas", "aulas", "estudos"
    ],
    "concursos": [
        "concurso", "edital", "prova", "aprovado", "aprovação",
        "banca", "questões", "simulado"
    ],
    "idiomas": [
        "inglês", "espanhol", "idioma", "fluência", "pronúncia",
        "vocabulary", "grammar", "conversação"
    ],

    # --- Finanças
    "financas_pessoais": [
        "finanças", "renda", "dinheiro", "orçamento", "economizar",
        "dívida", "cartão de crédito", "nome limpo"
    ],
    "investimentos": [
        "investir", "investimento", "ações", "bolsa", "renda fixa",
        "tesouro", "cdb", "cripto", "bitcoin", "dividendos"
    ],
    "negocios_online": [
        "ganhar dinheiro", "renda extra", "negócio online", "afiliado",
        "hotmart", "monetizze", "kiwify", "eduzz", "infoproduto"
    ],

    # --- Saúde / bem-estar
    "emagrecimento": [
        "emagrecer", "perder peso", "dieta", "barriga", "queimar gordura",
        "definir", "hipertrofia", "massa muscular"
    ],
    "fitness_treino": [
        "treino", "academia", "musculação", "cardio", "personal",
        "hipertrofia", "força", "exercícios"
    ],
    "nutricao": [
        "nutrição", "alimentação", "macros", "calorias", "dieta",
        "reeducação alimentar", "suplemento"
    ],
    "saude_mental": [
        "ansiedade", "depressão", "terapia", "psicologia", "autoconhecimento",
        "mindfulness", "estresse"
    ],
    "sono": [
        "sono", "insônia", "dormir", "qualidade do sono", "melatonina"
    ],

    # --- Beleza / estética
    "estetica_beleza": [
        "estética", "cosmética", "cosméticos", "beleza", "pele",
        "estética facial", "estética corporal", "tratamento", "procedimentos",
        "limpeza de pele", "massagem", "spa", "dermato"
    ],
    "cabelos": [
        "cabelo", "cabelos", "progressiva", "hidratação", "cronograma capilar",
        "corte", "barba", "salão"
    ],
    "maquiagem": [
        "maquiagem", "make", "base", "contorno", "delineado", "batom", "skincare"
    ],
    "skincare": [
        "skincare", "rotina de pele", "ácido", "retinol", "protetor solar",
        "manchas", "acne"
    ],

    # --- Relacionamentos e família
    "relacionamento": [
        "relacionamento", "casamento", "conquista", "namoro",
        "ciúmes", "comunicação", "romance"
    ],
    "parentalidade": [
        "pais", "mães", "criança", "educação infantil", "birra",
        "maternidade", "paternidade"
    ],

    # --- Casa / hobbies / lifestyle
    "culinaria": [
        "culinária", "receitas", "cozinha", "bolo", "doces", "sobremesa",
        "pão", "confeitaria"
    ],
    "artesanato": [
        "artesanato", "crochê", "tricô", "bordado", "costura",
        "moldes", "patchwork"
    ],
    "musica": [
        "música", "violão", "guitarra", "piano", "canto", "teoria musical"
    ],
    "fotografia_video": [
        "fotografia", "edição de vídeo", "premiere", "capcut", "reels",
        "youtube", "tiktok", "conteúdo"
    ],
    "design": [
        "design", "canva", "photoshop", "illustrator", "identidade visual",
        "logo", "layout"
    ],
    "jogos_games": [
        "games", "jogo", "fps", "rank", "lol", "valorant", "free fire",
        "minecraft", "steam"
    ],
    "viagem_turismo": [
        "viagem", "turismo", "passagem", "hotel", "roteiro", "milhas"
    ],
    "moda": [
        "moda", "look", "estilo", "roupa", "consultoria de imagem",
        "personal stylist"
    ],

    # --- Espiritualidade / desenvolvimento pessoal
    "espiritualidade": [
        "espiritualidade", "fé", "oração", "biblia", "religião",
        "meditação", "energia", "lei da atração"
    ],
    "desenvolvimento_pessoal": [
        "autoconhecimento", "mindset", "motivação", "autoestima",
        "hábitos", "disciplina"
    ],

    # --- Profissões específicas / cursos técnicos
    "saude_profissoes": [
        "enfermagem", "fisioterapia", "odontologia", "farmácia",
        "saúde", "clínica", "paciente"
    ],
    "direito": [
        "direito", "advocacia", "oab", "petição", "processo", "jurídico"
    ],
    "contabilidade": [
        "contabilidade", "contador", "balanço", "imposto", "fiscal",
        "tributário", "me"
    ],
    "engenharia": [
        "engenharia", "cálculo", "projeto", "obra", "civil",
        "autocad", "revit"
    ],
    "marketing_afiliados": [
        "afiliado", "comissão", "hotmart", "monetizze", "kiwify", "eduzz",
        "link de afiliado", "coprodutor"
    ],

    # --- Pets
    "pets": [
        "cachorro", "gato", "pet", "adestramento", "ração",
        "veterinário", "banho e tosa"
    ],

    # --- Idiomas extras
    "idioma_frances": ["francês", "français", "french"],
    "idioma_alemao": ["alemão", "deutsch", "german"],
    "idioma_italiano": ["italiano", "italian"],

    # --- Outros nichos comuns
    "imobiliario": [
        "imóvel", "imobiliário", "corretor", "aluguel", "financiamento",
        "casa", "apartamento"
    ],
    "automotivo": [
        "carro", "moto", "mecânica", "oficina", "habilitação",
        "dirigir", "detailing"
    ],
    "financas_empresariais": [
        "fluxo de caixa", "capital de giro", "precificação",
        "margem", "contas a pagar", "contas a receber"
    ],
    "eventos_festas": [
        "festas", "eventos", "decoração", "buffet", "cerimonial",
        "casamento", "aniversário"
    ],
    "beleza_unhas": [
        "unhas", "manicure", "pedicure", "alongamento", "gel",
        "nail designer"
    ],
    "barbearia": [
        "barbearia", "barbeiro", "barba", "corte masculino",
        "fade", "navalha"
    ],
    "profissionalizantes": [
        "curso profissionalizante", "certificado", "capacitação",
        "carreira", "mercado de trabalho"
    ],
    "criacao_conteudo": [
        "criação de conteúdo", "reels", "shorts", "viral", "roteiro",
        "story", "feed"
    ],
    "fintech_bancos": [
        "banco", "fintech", "cartão", "empréstimo", "consignado",
        "score", "serasa"
    ],
}

# Sinais de "conteúdo/notícia" (mantemos, mas cuidado para não hard-fail marketplace)
DOMINIOS_NOTICIA = [
    "g1.globo.com", "globo.com", "uol.com.br", "folha.uol.com.br",
    "estadao.com.br", "terra.com.br", "cnnbrasil.com.br", "bbc.com",
]

PALAVRAS_SINAIS_NOTICIA = [
    "últimas notícias", "notícias", "reportagem", "veja também", "leia mais",
    "assista", "vídeo", "publicado em", "atualizado em", "comente",
]


def parece_noticia(resumo_pagina: dict) -> bool:
    url = (resumo_pagina.get("url") or "").lower()
    titulo = (resumo_pagina.get("title") or "").lower()
    texto = (resumo_pagina.get("texto") or "").lower()

    for d in DOMINIOS_NOTICIA:
        if d in url:
            return True

    sinais = " ".join([titulo, texto[:2000]])
    for s in PALAVRAS_SINAIS_NOTICIA:
        if s in sinais:
            return True

    return False


def detectar_nicho(texto: str) -> dict:
    """
    Retorna:
    - nicho_final (ou 'indefinido' se pouca confiança)
    - top_nichos (top 5) com pontuação (pra auditoria)
    """
    texto = (texto or "").lower()
    pontuacao = {}

    for nicho, palavras in PALAVRAS_NICHOS.items():
        pts = 0
        for p in palavras:
            if p in texto:
                pts += 3 if " " in p else 1
        pontuacao[nicho] = pts

    # Bônus mínimo para "IA" como palavra inteira (não define nicho sozinho)
    if re.search(r"\bia\b", texto):
        pontuacao["inteligencia_artificial"] = pontuacao.get("inteligencia_artificial", 0) + 1

    ordenado = sorted(pontuacao.items(), key=lambda x: x[1], reverse=True)
    melhor_nicho, melhor_pts = ordenado[0] if ordenado else ("indefinido", 0)

    # mínimo de confiança: evita chutar nicho com pouco texto
    MIN_PONTOS = 4
    nicho_final = melhor_nicho if melhor_pts >= MIN_PONTOS else "indefinido"

    return {
        "nicho_final": nicho_final,
        "top_nichos": ordenado[:5],
        "pontos_melhor_nicho": melhor_pts,
    }


def extrair_promessa(texto: str) -> str:
    texto = texto or ""
    texto_limpo = re.sub(r"\s+", " ", texto).strip()
    frases = re.split(r"[.!?]\s+", texto_limpo)

    gatilhos = [
        "aprenda", "descubra", "como", "método", "segredo",
        "transforme", "alcance", "automat", "usando", "com ia",
        "comece", "torne-se", "domine", "passo a passo"
    ]

    for f in frases[:35]:
        f2 = f.strip()
        if len(f2) >= 25:
            for g in gatilhos:
                if g in f2.lower():
                    return f2[:220]

    if len(texto_limpo) > 220:
        return texto_limpo[:220] + "..."
    return texto_limpo


def gerar_estrategia(resumo_pagina: dict) -> dict:
    if parece_noticia(resumo_pagina):
        return {
            "nicho": "conteudo_noticia",
            "promessa": "",
            "canais_recomendados": [],
            "status": "filtrado: página de notícia/conteúdo",
            "top_nichos": [],
        }

    texto = resumo_pagina.get("texto", "")
    nicho_info = detectar_nicho(texto)
    nicho = nicho_info["nicho_final"]
    promessa = extrair_promessa(texto)

    # Canais só se tiver nicho minimamente confiável
    canais = ["google_ads", "instagram_ads"] if nicho != "indefinido" else []

    return {
        "nicho": nicho,
        "promessa": promessa,
        "canais_recomendados": canais,
        "status": "estratégia inicial gerada com sucesso",
        "top_nichos": nicho_info["top_nichos"],
    }
