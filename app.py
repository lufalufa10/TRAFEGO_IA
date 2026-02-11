import json
import textwrap
from datetime import datetime

import streamlit as st

from web_reader import ler_pagina
from estrategia import gerar_estrategia
from classificador import classificar_produto
from pontuador import pontuar_produto


# =========================
# CONFIG
# =========================
st.set_page_config(
    page_title="ADTRIX • Validação de Produtos",
    page_icon="🚀",
    layout="wide",
)

st.markdown(
    textwrap.dedent(
        """
        <style>
        /* Layout: remove o "corte" / listra escura no topo */
        .block-container { padding-top: 2.1rem; padding-bottom: 2.6rem; max-width: 1240px; }

        .stApp {
          background:
              radial-gradient(1200px 600px at 15% -10%, rgba(124, 58, 237, 0.16), rgba(0,0,0,0) 55%),
              radial-gradient(900px 500px at 85% 0%, rgba(59, 130, 246, 0.12), rgba(0,0,0,0) 55%),
              linear-gradient(180deg, rgba(2, 6, 23, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%);
        }

        h1, h2, h3, h4 { letter-spacing: -0.02em; }

        .small { opacity: 0.82; font-size: 0.92rem; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

        hr { border: none; border-top: 1px solid rgba(148,163,184,0.25); margin: 1rem 0; }

        .card {
          border: 1px solid rgba(148,163,184,0.16);
          border-radius: 18px;
          padding: 14px 16px;
          background: rgba(15, 23, 42, 0.55);
          box-shadow: 0 16px 40px rgba(0,0,0,0.20);
          backdrop-filter: blur(10px);
        }

        .card-soft {
          border: 1px solid rgba(148,163,184,0.14);
          border-radius: 16px;
          padding: 14px 16px;
          background: rgba(15, 23, 42, 0.38);
        }

        .hero {
          border: 1px solid rgba(124, 58, 237, 0.26);
          background:
              radial-gradient(900px 400px at 15% 10%, rgba(124,58,237,0.22), rgba(0,0,0,0) 60%),
              radial-gradient(900px 400px at 85% 0%, rgba(56,189,248,0.14), rgba(0,0,0,0) 65%),
              rgba(15, 23, 42, 0.56);
        }

        .badge {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 0.90rem;
          font-weight: 750;
          border: 1px solid rgba(255,255,255,0.12);
          white-space: nowrap;
        }
        .badge-ok { background: rgba(34, 197, 94, 0.18); }
        .badge-warn { background: rgba(245, 158, 11, 0.18); }
        .badge-bad { background: rgba(239, 68, 68, 0.18); }
        .badge-neutral { background: rgba(148, 163, 184, 0.16); }

        .tag {
          display:inline-block;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.18);
          background: rgba(148,163,184,0.08);
          margin-right: 6px;
          margin-bottom: 6px;
          font-size: 0.92rem;
        }

        /* Sidebar */
        div[data-testid="stSidebar"] > div:first-child {
          background: radial-gradient(900px 400px at 10% 0%, rgba(124,58,237,0.20), rgba(0,0,0,0) 55%),
                      rgba(2, 6, 23, 0.90);
          border-right: 1px solid rgba(148,163,184,0.14);
        }

        /* Tabs */
        div[data-testid="stTabs"] button { font-weight: 750 !important; }

        /* Inputs */
        div[data-baseweb="input"] input {
          border-radius: 14px !important;
        }
        div[data-baseweb="select"] > div {
          border-radius: 14px !important;
        }

        /* Dataframe */
        div[data-testid="stDataFrame"] {
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.14);
          background: rgba(15, 23, 42, 0.35);
        }

        /* Buttons */
        .stButton > button {
          border-radius: 14px !important;
          font-weight: 800 !important;
        }

        /* Destaque do botão principal (analisar) */
        div[data-testid="stFormSubmitButton"] > button {
          border-radius: 14px !important;
          font-weight: 900 !important;
          border: 1px solid rgba(124,58,237,0.35) !important;
          background: rgba(124,58,237,0.18) !important;
        }
        div[data-testid="stFormSubmitButton"] > button:hover {
          border: 1px solid rgba(124,58,237,0.55) !important;
          background: rgba(124,58,237,0.26) !important;
        }
        </style>
        """
    ),
    unsafe_allow_html=True,
)


# =========================
# CORE
# =========================
def analisar_url(url: str) -> dict:
    resumo = ler_pagina(url)

    if resumo.get("erro"):
        erro_msg = resumo.get("erro")
        return {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "url": url,
            "title": "",
            "h1": [],
            "estrategia": {
                "nicho": "erro",
                "promessa": "",
                "canais_recomendados": [],
                "status": "erro ao ler página",
                "top_nichos": [],
            },
            "decisao_pre": {"decisao": "ERRO", "motivo": erro_msg},
            "decisao_final": {"decisao": "ERRO", "motivo": erro_msg},
            "score": {"score": 0, "classificacao": "ERRO", "detalhes": [erro_msg]},
        }

    estrategia = gerar_estrategia(resumo)
    decisao = classificar_produto(estrategia)
    score = pontuar_produto(estrategia, decisao, resumo)

    decisao_final = dict(decisao)
    if score.get("classificacao") == "DESCARTAR":
        detalhes = score.get("detalhes", [])
        decisao_final["decisao"] = "DESCARTAR"
        decisao_final["motivo"] = f"Pontuador: {detalhes[0]}" if detalhes else "Pontuador: hard fail"

    return {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "url": url,
        "title": resumo.get("title", ""),
        "h1": resumo.get("h1", []),
        "estrategia": estrategia,
        "decisao_pre": decisao,
        "decisao_final": decisao_final,
        "score": score,
    }


def salvar_historico(registro: dict, arquivo: str = "historico.jsonl") -> None:
    with open(arquivo, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")


def carregar_historico(arquivo: str = "historico.jsonl", limite: int = 100) -> list:
    try:
        with open(arquivo, "r", encoding="utf-8") as f:
            linhas = f.readlines()
        linhas = linhas[-limite:]
        return [json.loads(l) for l in linhas if l.strip()]
    except FileNotFoundError:
        return []


# =========================
# UI HELPERS
# =========================
def _escape_html(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#039;")
    )


def render_tags(values: list[str]) -> None:
    if not values:
        st.write("—")
        return
    html = "".join([f'<span class="tag">{_escape_html(v)}</span>' for v in values])
    st.markdown(html, unsafe_allow_html=True)


def format_top_nichos(top_nichos) -> list[str]:
    out = []
    for item in (top_nichos or []):
        try:
            nicho, pts = item
        except Exception:
            continue
        out.append(f"{nicho} — {pts}")
    return out


def score_label(score_num: int) -> str:
    if score_num >= 75:
        return "Forte"
    if score_num >= 45:
        return "Médio"
    return "Fraco"


def _clamp_score(score_obj: dict) -> int:
    try:
        v = int(score_obj.get("score", 0) or 0)
    except Exception:
        v = 0
    return min(max(v, 0), 100)


def badge_decisao(decisao: str) -> str:
    d = (decisao or "").upper()
    if d in ("TESTAR", "APROVAR", "OK"):
        return '<span class="badge badge-ok">✅ TESTAR</span>'
    if d in ("AJUSTAR",):
        return '<span class="badge badge-warn">⚠️ AJUSTAR</span>'
    if d in ("DESCARTAR", "REPROVAR"):
        return '<span class="badge badge-bad">⛔ DESCARTAR</span>'
    if d in ("ERRO",):
        return '<span class="badge badge-bad">🚫 ERRO</span>'
    return f'<span class="badge badge-neutral">{_escape_html(d or "—")}</span>'


def badge_score(score: int) -> str:
    try:
        s = int(score)
    except Exception:
        s = 0
    if s >= 75:
        cls = "badge-ok"
        ico = "🔥"
    elif s >= 45:
        cls = "badge-warn"
        ico = "🟡"
    else:
        cls = "badge-bad"
        ico = "🔻"
    return f'<span class="badge {cls}">{ico} Score {s}</span>'


def resumo_veredito(score_num: int, detalhes: list[str], decisao_final: str) -> str:
    if (decisao_final or "").upper() == "ERRO":
        return "Não foi possível analisar esta página."
    if detalhes:
        return detalhes[0]
    if score_num >= 75:
        return "Boa página para tráfego: promessa e estrutura coerentes."
    if score_num >= 45:
        return "Página com potencial, mas precisa ajustes antes de anunciar."
    return "Página fraca para tráfego: baixa clareza/estrutura ou sinais de risco."


def historico_para_linhas(hist: list[dict]) -> list[dict]:
    linhas = []
    for item in hist:
        score_obj = item.get("score", {}) or {}
        decisao = (item.get("decisao_final") or {}).get("decisao", "") or ""
        est = item.get("estrategia", {}) or {}
        linhas.append(
            {
                "timestamp": item.get("timestamp", ""),
                "titulo": item.get("title", "") or "",
                "url": item.get("url", "") or "",
                "decisao": decisao.upper(),
                "score": _clamp_score(score_obj),
                "nicho": est.get("nicho", "") or "",
                "promessa": (est.get("promessa", "") or "")[:180],
            }
        )
    return linhas


def gerar_csv(linhas: list[dict]) -> str:
    cols = ["timestamp", "decisao", "score", "nicho", "titulo", "url", "promessa"]
    def esc(v):
        s = str(v).replace('"', '""')
        return f'"{s}"'
    out = [",".join(cols)]
    for row in linhas:
        out.append(",".join([esc(row.get(c, "")) for c in cols]))
    return "\n".join(out)


def _stats_hist(linhas: list[dict]) -> dict:
    if not linhas:
        return {"total": 0, "media": 0, "testar": 0, "ajustar": 0, "descartar": 0}
    scores = [int(l.get("score", 0) or 0) for l in linhas]
    media = round(sum(scores) / max(len(scores), 1))
    testar = sum(1 for l in linhas if (l.get("decisao") or "").upper() in ("TESTAR", "APROVAR", "OK"))
    ajustar = sum(1 for l in linhas if (l.get("decisao") or "").upper() == "AJUSTAR")
    descartar = sum(1 for l in linhas if (l.get("decisao") or "").upper() in ("DESCARTAR", "REPROVAR"))
    return {"total": len(linhas), "media": media, "testar": testar, "ajustar": ajustar, "descartar": descartar}


# =========================
# STATE
# =========================
if "ja_analisou" not in st.session_state:
    st.session_state["ja_analisou"] = False


# =========================
# HEADER (novo nome + promessa realista)
# =========================
st.markdown(
    '<div class="card hero">'
    '<div style="display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap;">'
    '<div>'
    '<div style="font-size:1.75rem; font-weight:900; letter-spacing:-0.03em;">🚀 ADTRIX</div>'
    '<div class="small">Validação inteligente de produtos para tráfego pago • nicho • promessa • decisão • score rigoroso</div>'
    '</div>'
    '<div class="small mono" style="opacity:0.75;">v0.1 • MVP Afiliados</div>'
    '</div>'
    '</div>',
    unsafe_allow_html=True,
)
st.write("")


# =========================
# SIDEBAR
# =========================
with st.sidebar:
    st.markdown("### Painel")
    salvar_auto = st.toggle("Salvar automaticamente", value=True)
    limite_hist = st.slider("Itens no histórico", 20, 300, 120, 20)
    st.divider()

    hist_sidebar = carregar_historico(limite=limite_hist)
    total_itens = len(hist_sidebar)

    if total_itens:
        scores = []
        for item in hist_sidebar:
            scores.append(_clamp_score((item.get("score") or {})))
        try:
            media = round(sum(scores) / max(len(scores), 1))
        except Exception:
            media = 0

        st.markdown(
            f'<div class="card-soft">'
            f'<div class="small">Análises salvas</div>'
            f'<div style="font-size:1.7rem; font-weight:900;">{total_itens}</div>'
            f'<div class="small" style="margin-top:8px;">Média de score</div>'
            f'<div style="font-size:1.25rem; font-weight:850;">{media} / 100</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<div class="card-soft">'
            '<div style="font-weight:850;">Sem histórico ainda</div>'
            '<div class="small">Faça sua primeira análise e salve para criar base.</div>'
            '</div>',
            unsafe_allow_html=True,
        )

    st.caption("Arquivo local: historico.jsonl")


# =========================
# TABS
# =========================
tab1, tab2 = st.tabs(["🔍 Analisar", "📜 Histórico"])


# =========================
# TAB 1 - ANALISAR
# =========================
with tab1:
    st.markdown("### Análise rápida")
    st.caption("Cole a URL do produto e gere um veredito com score rigoroso.")

    # Onboarding (aparece até a primeira análise)
    if not st.session_state["ja_analisou"]:
        st.markdown(
            '<div class="card-soft">'
            '<div style="font-weight:900; font-size:1.05rem;">Comece em 3 passos</div>'
            '<div class="small" style="margin-top:6px;">'
            '1) Cole a URL da página de vendas • '
            '2) Clique em <b>Analisar</b> • '
            '3) Siga o veredito: <b>TESTAR</b>, <b>AJUSTAR</b> ou <b>DESCARTAR</b>'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )
        st.write("")

    with st.form("form_analisar", clear_on_submit=False):
        c1, c2 = st.columns([4, 1])
        with c1:
            url = st.text_input(
                "URL",
                value="",
                placeholder="Cole aqui a URL da página de vendas… (https://...)",
                label_visibility="collapsed",
            )
        with c2:
            rodar = st.form_submit_button("Analisar", use_container_width=True)

    if rodar:
        if not url.strip():
            st.error("Cole uma URL válida (com https://).")
        else:
            with st.spinner("Analisando..."):
                resultado = analisar_url(url.strip())

            st.session_state["ja_analisou"] = True

            if salvar_auto:
                salvar_historico(resultado)

            st.markdown("<hr/>", unsafe_allow_html=True)

            score_obj = resultado.get("score", {}) or {}
            score_num = _clamp_score(score_obj)
            classif = (score_obj.get("classificacao", "—") or "—").upper()
            detalhes = score_obj.get("detalhes", []) or []

            final = resultado.get("decisao_final", {}) or {}
            decisao_final = (final.get("decisao", "—") or "—").upper()
            motivo_final = final.get("motivo", "—") or "—"

            titulo = resultado.get("title", "") or "—"
            url_show = resultado.get("url", "") or "—"

            resumo = resumo_veredito(score_num, detalhes, decisao_final)

            # Feedback pós-análise (banner moderno + ação)
            acao = "Você pode iniciar testes controlados de tráfego." if decisao_final == "TESTAR" else \
                   "Ajuste a promessa/estrutura antes de investir." if decisao_final == "AJUSTAR" else \
                   "Evite investir agora. Busque outra oferta ou ajuste pesado."

            st.markdown(
                '<div class="card hero">'
                f'<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">'
                f'<div style="min-width:260px;">'
                f'<div class="small" style="opacity:0.78;">VEREDITO</div>'
                f'<div style="font-size:2.1rem; font-weight:950; letter-spacing:-0.03em; margin-top:2px;">{_escape_html(decisao_final)}</div>'
                f'<div class="small" style="margin-top:8px;">{_escape_html(acao)}</div>'
                f'</div>'
                f'<div style="display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">'
                f'{badge_decisao(decisao_final)} {badge_score(score_num)}'
                f'</div>'
                f'</div>'
                '</div>',
                unsafe_allow_html=True,
            )
            st.write("")

            st.markdown('<div class="card hero">', unsafe_allow_html=True)

            top_left, top_right = st.columns([1.6, 1.0], gap="large")

            with top_left:
                st.markdown("**Página analisada**")
                st.write(titulo)
                st.markdown(f'<div class="small mono">{_escape_html(url_show)}</div>', unsafe_allow_html=True)

                st.write("")
                st.markdown("**Resumo**")
                st.write(resumo)

            with top_right:
                st.markdown("**Score**")
                st.markdown(
                    f'<div style="display:flex; align-items:baseline; gap:10px;">'
                    f'<div style="font-size:3.0rem; font-weight:900; letter-spacing:-0.04em; line-height:1;">{score_num}</div>'
                    f'<div style="opacity:0.55; font-weight:800; font-size:1.15rem;">/ 100</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
                st.markdown(
                    f'<div class="small">{score_label(score_num)} • {_escape_html(classif)}</div>',
                    unsafe_allow_html=True,
                )
                st.progress(score_num)

                st.write("")
                st.markdown(
                    f'{badge_decisao(decisao_final)} {badge_score(score_num)}',
                    unsafe_allow_html=True,
                )
                st.markdown('<div class="small" style="margin-top:10px;">Motivo final</div>', unsafe_allow_html=True)
                st.write(motivo_final)

            st.markdown("</div>", unsafe_allow_html=True)
            st.write("")

            left, right = st.columns([1.15, 0.85], gap="large")

            with left:
                st.markdown("#### Estratégia")
                st.markdown('<div class="card">', unsafe_allow_html=True)

                estrategia = resultado.get("estrategia", {}) or {}
                st.write("**Nicho:**", estrategia.get("nicho", "—"))

                promessa = estrategia.get("promessa", "") or ""
                st.write("**Promessa:**", promessa if promessa else "—")

                canais = estrategia.get("canais_recomendados", []) or []
                st.write("**Canais recomendados:**")
                if canais:
                    render_tags([c.replace("_", " ") for c in canais])
                else:
                    st.write("—")

                top = estrategia.get("top_nichos", []) or []
                st.write("**Top nichos:**")
                top_fmt = format_top_nichos(top)
                if top_fmt:
                    for linha in top_fmt:
                        st.write(f"- {linha}")
                else:
                    st.write("—")

                st.markdown("</div>", unsafe_allow_html=True)

                st.markdown("#### Decisão (pré vs final)")
                st.markdown('<div class="card-soft">', unsafe_allow_html=True)

                pre = resultado.get("decisao_pre", {}) or {}
                st.write("**Pré-pontuação:**", pre.get("decisao", "—"))
                st.write("**Motivo:**", pre.get("motivo", "—"))

                st.write("—")
                st.write("**Final:**", decisao_final)
                st.write("**Motivo:**", motivo_final)

                st.markdown("</div>", unsafe_allow_html=True)

            with right:
                st.markdown("#### Score (detalhes)")
                st.markdown('<div class="card">', unsafe_allow_html=True)

                st.write(f"**Score:** {score_num} • {score_label(score_num)}")
                st.progress(score_num)

                if detalhes:
                    st.write("**Principal:**", detalhes[0])
                else:
                    st.write("**Principal:** —")

                if len(detalhes) > 1:
                    st.write("**Detalhes:**")
                    for d in detalhes[1:]:
                        st.write(f"- {d}")

                st.markdown("</div>", unsafe_allow_html=True)

                st.markdown("#### H1 (até 3)")
                st.markdown('<div class="card-soft">', unsafe_allow_html=True)
                h1 = resultado.get("h1", []) or []
                if h1:
                    for item in h1[:3]:
                        st.write(f"• {item}")
                else:
                    st.write("—")
                st.markdown("</div>", unsafe_allow_html=True)


# =========================
# TAB 2 - HISTÓRICO (Premium)
# =========================
with tab2:
    hist = carregar_historico(limite=limite_hist)
    linhas = historico_para_linhas(hist)

    st.markdown("### Histórico (premium)")
    st.caption("Filtre, ordene e exporte para CSV.")

    if not linhas:
        st.info("Ainda não há histórico. Faça uma análise e salve.")
    else:
        stats = _stats_hist(linhas)
        m1, m2, m3, m4, m5 = st.columns([1, 1, 1, 1, 1])
        m1.metric("Total", stats["total"])
        m2.metric("Média score", f'{stats["media"]} / 100')
        m3.metric("TESTAR", stats["testar"])
        m4.metric("AJUSTAR", stats["ajustar"])
        m5.metric("DESCARTAR", stats["descartar"])

        st.write("")

        # Filtros
        f1, f2, f3 = st.columns([1, 1, 1.2])
        with f1:
            decisao_filtro = st.multiselect(
                "Decisão",
                options=sorted(list({l["decisao"] for l in linhas})),
                default=[],
                placeholder="Selecione…",
            )
        with f2:
            score_min = st.slider("Score mínimo", 0, 100, 0, 5)
        with f3:
            busca = st.text_input("Buscar (título/URL/nicho)", value="", placeholder="ex: emagrecimento")

        filtrado = []
        b = (busca or "").strip().lower()
        for l in linhas:
            if decisao_filtro and l["decisao"] not in decisao_filtro:
                continue
            if l["score"] < score_min:
                continue
            if b:
                blob = f'{l["titulo"]} {l["url"]} {l["nicho"]}'.lower()
                if b not in blob:
                    continue
            filtrado.append(l)

        # Ordenação (PT-BR)
        o1, o2 = st.columns([1, 1.2])
        with o1:
            ordenar_por = st.selectbox("Ordenar por", ["score", "timestamp"], index=0)
        with o2:
            ordem = st.radio("Ordem", ["↓ Maior → Menor", "↑ Menor → Maior"], horizontal=True, index=0)

        reverse = True if ordem.startswith("↓") else False
        filtrado = sorted(filtrado, key=lambda x: x.get(ordenar_por, ""), reverse=reverse)

        # Export CSV
        csv = gerar_csv(filtrado)
        st.download_button(
            "⬇️ Baixar CSV (filtrado)",
            data=csv.encode("utf-8"),
            file_name="historico_adtrix.csv",
            mime="text/csv",
            use_container_width=False,
        )

        st.write("")

        # Tabela bonita
        st.dataframe(
            filtrado,
            use_container_width=True,
            hide_index=True,
            column_config={
                "timestamp": st.column_config.TextColumn("Data/Hora"),
                "decisao": st.column_config.TextColumn("Decisão"),
                "score": st.column_config.NumberColumn("Score"),
                "nicho": st.column_config.TextColumn("Nicho"),
                "titulo": st.column_config.TextColumn("Título"),
                "url": st.column_config.TextColumn("URL"),
                "promessa": st.column_config.TextColumn("Promessa (resumo)"),
            },
        )

        st.write("")
        st.markdown("### Detalhes (últimos itens)")
        st.caption("Se quiser ver detalhes completos, expanda um item abaixo.")

        for item in reversed(hist[-10:]):
            decisao = (item.get("decisao_final") or {}).get("decisao", "")
            score = (item.get("score") or {}).get("score", 0)
            titulo = item.get("title", "") or "(sem título)"
            url_item = item.get("url", "")
            header = f"{item.get('timestamp','')} • {titulo}"

            with st.expander(header):
                st.markdown(
                    f'<div class="card">'
                    f'<div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">'
                    f'<div style="min-width:280px;">'
                    f'<div class="small">URL</div>'
                    f'<div class="mono" style="opacity:0.90;">{_escape_html(url_item)}</div>'
                    f'</div>'
                    f'<div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">'
                    f'{badge_decisao(decisao)} {badge_score(score)}'
                    f'</div>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

                est = item.get("estrategia", {}) or {}
                st.write("**Nicho:**", est.get("nicho", "—"))
                st.write("**Promessa:**", est.get("promessa", "—") or "—")

