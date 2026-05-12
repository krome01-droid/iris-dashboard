// Iris — décorateur HTML pour le champ texte-seo Webflow.
//
// Direction esthétique v8 : "Spec Sheet — Carte d'embarquement"
//   - Palette officielle INRI'S (charte mai 2024)
//   - Typographie : inherit Webflow (Quicksand body, Montserrat titres)
//   - Sobriété maximale : violet quasi-absent, rose en éclairs, vert un seul usage
//   - Anchor : stat strip blanc bordures navy, chiffres XXL monospace
//
// Scopé sous `.iris-seo` — zero bleed sur le reste de la page Webflow.

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
}

function buildScopedStyle() {
  return `<style>
.iris-seo{
  /* Palette officielle INRI'S */
  --iris-purple:#281B59;     /* usage micro-discret seulement */
  --iris-rose:#C10058;       /* accent principal */
  --iris-vert:#00E5AC;       /* UN seul usage : note Google */
  --iris-bleu:#1F3149;       /* texte + chiffres + bordures */
  --iris-gris:#9AA6B7;       /* méta */
  --iris-bg:#F9FAFE;         /* fond doux */

  --iris-line:rgba(31,49,73,.12);
  --iris-line-strong:rgba(31,49,73,.22);
  --iris-rose-soft:rgba(193,0,88,.08);

  --iris-radius:18px;
  --iris-radius-sm:10px;
  --iris-shadow:0 1px 2px rgba(31,49,73,.04), 0 14px 40px -22px rgba(31,49,73,.28);
  --iris-shadow-hover:0 2px 4px rgba(31,49,73,.04), 0 24px 60px -22px rgba(31,49,73,.34);
  --iris-mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;

  color:var(--iris-bleu);
  line-height:1.7;
  font-size:17px;
  max-width:780px;
  margin:0 auto;
  padding:8px 0 64px;
}
.iris-seo *{box-sizing:border-box}
.iris-seo p{margin:0 0 18px;color:var(--iris-bleu)}
.iris-seo strong{font-weight:700;color:var(--iris-bleu)}
.iris-seo a{color:var(--iris-rose);text-decoration:none;border-bottom:1px solid rgba(193,0,88,.22);transition:border-color .15s ease}
.iris-seo a:hover{border-bottom-color:var(--iris-rose)}

/* ============= HERO — blanc sobre, rose en accent ============= */
.iris-hero{
  background:#fff;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius);
  padding:40px 36px 32px;
  margin:0 0 24px;
  box-shadow:var(--iris-shadow);
  position:relative;
}
.iris-hero-eyebrow{
  display:inline-flex;
  align-items:center;
  gap:10px;
  font-family:var(--iris-mono);
  font-size:0.72rem;
  letter-spacing:0.18em;
  text-transform:uppercase;
  color:var(--iris-rose);
  margin:0 0 18px;
  font-weight:700;
}
.iris-hero-eyebrow::before{
  content:"";
  width:32px;
  height:2px;
  background:var(--iris-rose);
}
.iris-hero h2{
  font-size:clamp(1.55rem,3.6vw,2.1rem);
  font-weight:800;
  line-height:1.18;
  margin:0 0 14px;
  color:var(--iris-bleu);
  letter-spacing:-0.018em;
}
.iris-hero-lead{
  font-size:1.05rem;
  color:var(--iris-bleu);
  margin:0 0 8px;
  max-width:62ch;
  line-height:1.6;
  opacity:0.92;
}
.iris-hero-lead strong{color:var(--iris-bleu);font-weight:700}
.iris-hero-meta{
  margin:24px 0 0;
  font-family:var(--iris-mono);
  font-size:0.68rem;
  letter-spacing:0.18em;
  text-transform:uppercase;
  color:var(--iris-purple);    /* SEUL usage du violet, presque invisible */
  opacity:0.65;
}

/* ============= STAT STRIP — anchor visuel, blanc bordures navy ============= */
.iris-stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:0;
  background:#fff;
  border:1.5px solid var(--iris-bleu);
  border-radius:var(--iris-radius-sm);
  overflow:hidden;
  margin:0 0 40px;
  box-shadow:0 6px 20px -14px rgba(31,49,73,.3);
}
.iris-stats .iris-stat{
  padding:24px 14px 22px;
  text-align:center;
  border-right:1px solid var(--iris-line);
  position:relative;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:4px;
}
.iris-stats .iris-stat:last-child{border-right:0}
.iris-stats .iris-stat-num{
  font-family:var(--iris-mono);
  font-size:1.7rem;
  font-weight:800;
  color:var(--iris-bleu);
  font-variant-numeric:tabular-nums;
  letter-spacing:-0.03em;
  line-height:1;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
}
.iris-stats .iris-stat-icon{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:44px;height:44px;
  color:var(--iris-bleu);
}
.iris-stats .iris-stat-icon svg{width:100%;height:100%;display:block}
.iris-stats .iris-stat.is-vert .iris-stat-num{color:#00926b}
.iris-stats .iris-stat.is-vert::after{
  content:"";
  position:absolute;
  top:8px;right:8px;
  width:6px;height:6px;
  background:var(--iris-vert);
  border-radius:50%;
  box-shadow:0 0 0 3px rgba(0,229,172,.18);
}
.iris-stats .iris-stat-lbl{
  font-size:0.68rem;
  text-transform:uppercase;
  letter-spacing:0.14em;
  color:var(--iris-gris);
  margin-top:10px;
  font-weight:600;
}
@media (max-width:600px){
  .iris-stats{grid-template-columns:repeat(2,1fr)}
  .iris-stats .iris-stat:nth-child(2){border-right:0}
  .iris-stats .iris-stat:nth-child(1),
  .iris-stats .iris-stat:nth-child(2){border-bottom:1px solid var(--iris-line)}
}

/* ============= BODY ============= */
.iris-body{
  padding:0;
  margin:0 0 40px;
}
.iris-body h2{
  font-size:1.45rem;
  font-weight:800;
  margin:44px 0 14px;
  color:var(--iris-bleu);
  letter-spacing:-0.015em;
  line-height:1.25;
  position:relative;
  padding-left:20px;
}
.iris-body h2::before{
  content:"";
  position:absolute;
  left:0;top:.32em;
  width:5px;height:1em;
  background:var(--iris-rose);   /* solide, pas gradient */
  border-radius:2px;
}
.iris-body h2:first-of-type{margin-top:0}
.iris-body h3{
  font-size:1.1rem;
  font-weight:700;
  margin:32px 0 12px;
  color:var(--iris-bleu);
  letter-spacing:-0.003em;
}
.iris-body h3::before{
  content:"›";
  display:inline-block;
  margin-right:8px;
  color:var(--iris-rose);
  font-weight:800;
}

/* ============= MAP CARD ============= */
.iris-map{
  margin:0 0 40px;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius);
  overflow:hidden;
  box-shadow:var(--iris-shadow);
  background:#fff;
  transition:box-shadow .25s ease,transform .25s ease;
}
.iris-map:hover{box-shadow:var(--iris-shadow-hover);transform:translateY(-2px)}
.iris-map-header{
  padding:16px 24px;
  background:linear-gradient(180deg,#fff 0%,var(--iris-bg) 100%);
  border-bottom:1px solid var(--iris-line);
  display:flex;
  align-items:center;
  justify-content:space-between;
  font-size:0.72rem;
  color:var(--iris-bleu);
  text-transform:uppercase;
  letter-spacing:0.16em;
  font-weight:700;
}
.iris-map-header span:first-child{display:inline-flex;align-items:center;gap:8px}
.iris-map-header span:first-child::before{
  content:"";
  width:8px;height:8px;
  background:var(--iris-rose);
  border-radius:50%;
  box-shadow:0 0 0 3px var(--iris-rose-soft);
}
.iris-map-header span:last-child{font-family:var(--iris-mono);color:var(--iris-gris);font-size:0.7rem;letter-spacing:0.08em;font-weight:500}
.iris-map iframe{display:block;width:100%;height:380px;border:0}
.iris-map-foot{
  padding:12px 22px;
  border-top:1px solid var(--iris-line);
  font-size:0.85rem;
  text-align:right;
  background:#fff;
}
.iris-map-foot a{border-bottom:0;color:var(--iris-gris)}
.iris-map-foot a:hover{color:var(--iris-rose)}

/* ============= AVIS CARD ============= */
.iris-avis{
  margin:0 0 40px;
  background:#fff;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius);
  padding:36px 32px;
  box-shadow:var(--iris-shadow);
  position:relative;
  overflow:hidden;
  transition:box-shadow .25s ease,transform .25s ease;
}
.iris-avis:hover{box-shadow:var(--iris-shadow-hover);transform:translateY(-2px)}
.iris-avis::before{
  content:"";
  position:absolute;
  top:0;left:0;right:0;
  height:4px;
  background:linear-gradient(90deg,var(--iris-rose) 0%,var(--iris-rose) 60%,var(--iris-vert) 100%);
}
.iris-avis-head{
  display:flex;
  flex-wrap:wrap;
  align-items:baseline;
  gap:10px 18px;
  margin:0 0 24px;
  padding-bottom:18px;
  border-bottom:1px solid var(--iris-line);
}
.iris-avis-head h3{margin:0;font-size:1.18rem;color:var(--iris-bleu);font-weight:800}
.iris-avis-head h3::before{content:none}
.iris-avis-score{
  font-family:var(--iris-mono);
  font-size:1.05rem;
  font-weight:800;
  color:var(--iris-bleu);
  font-variant-numeric:tabular-nums;
  background:var(--iris-bg);
  padding:4px 10px;
  border-radius:6px;
  border:1px solid var(--iris-line);
}
.iris-avis-stars{color:var(--iris-rose);letter-spacing:0.06em;font-size:1.1rem}
.iris-avis-count{color:var(--iris-gris);font-size:0.88rem}
.iris-review{
  margin:0 0 14px;
  padding:18px 20px;
  background:var(--iris-bg);
  border-left:3px solid var(--iris-rose);
  border-radius:var(--iris-radius-sm);
  transition:transform .15s ease,box-shadow .15s ease;
}
.iris-review:hover{transform:translateY(-2px);box-shadow:0 10px 20px -14px rgba(31,49,73,.25)}
.iris-review-meta{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin:0 0 6px;
  font-size:0.85rem;
}
.iris-review-meta strong{color:var(--iris-bleu);font-weight:700}
.iris-review-meta .iris-review-when{color:var(--iris-gris)}
.iris-review-text{margin:0;color:var(--iris-bleu);font-size:0.95rem;line-height:1.6}

/* ============= NEARBY (maillage interne) ============= */
.iris-nearby{
  margin:0 0 40px;
  padding:32px 32px 28px;
  background:#fff;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius);
  box-shadow:var(--iris-shadow);
  position:relative;
  overflow:hidden;
  transition:box-shadow .25s ease,transform .25s ease;
}
.iris-nearby:hover{box-shadow:var(--iris-shadow-hover);transform:translateY(-2px)}
.iris-nearby::before{
  content:"";
  position:absolute;
  top:0;left:32px;right:32px;
  height:3px;
  background:var(--iris-rose);
  border-radius:0 0 2px 2px;
}
.iris-nearby-head{
  display:flex;
  align-items:baseline;
  gap:12px;
  margin:0 0 16px;
}
.iris-nearby-head h3{
  margin:0;
  font-size:1.05rem;
  font-weight:800;
  color:var(--iris-bleu);
  letter-spacing:-0.005em;
}
.iris-nearby-head h3::before{content:none}
.iris-nearby-head .iris-mono-tag{
  font-family:var(--iris-mono);
  font-size:0.7rem;
  letter-spacing:0.16em;
  color:var(--iris-gris);
  text-transform:uppercase;
  font-weight:700;
}
.iris-nearby ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr;gap:8px}
@media (min-width:560px){.iris-nearby ul{grid-template-columns:1fr 1fr 1fr}}
.iris-nearby li{margin:0}
.iris-nearby a{
  display:block;
  padding:14px 16px;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius-sm);
  background:#fff;
  color:var(--iris-bleu) !important;
  font-size:0.92rem;
  font-weight:600;
  text-decoration:none;
  border-bottom:1px solid var(--iris-line);
  transition:border-color .2s ease,transform .2s ease,background .2s ease,box-shadow .2s ease;
  position:relative;
}
.iris-nearby a::after{
  content:"→";
  position:absolute;
  top:14px;right:14px;
  color:var(--iris-gris);
  font-weight:400;
  transition:color .2s ease,transform .2s ease;
}
.iris-nearby a:hover{
  border-color:var(--iris-rose);
  transform:translateY(-2px);
  background:var(--iris-bg);
  box-shadow:0 8px 20px -14px rgba(193,0,88,.28);
  color:var(--iris-bleu) !important;
}
.iris-nearby a:hover::after{color:var(--iris-rose);transform:translateX(2px)}
.iris-nearby a .iris-nearby-dist{
  display:block;
  font-family:var(--iris-mono);
  font-size:0.72rem;
  color:var(--iris-gris);
  font-weight:500;
  letter-spacing:0.05em;
  margin-top:2px;
}

/* ============= LABELS QUALITÉ (Qualiopi + Label Préfecture) ============= */
.iris-labels{
  margin:0 0 40px;
  padding:32px 32px 28px;
  background:#fff;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius);
  box-shadow:var(--iris-shadow);
  position:relative;
  overflow:hidden;
  transition:box-shadow .25s ease,transform .25s ease;
}
.iris-labels:hover{box-shadow:var(--iris-shadow-hover);transform:translateY(-2px)}
.iris-labels::before{
  content:"";
  position:absolute;
  top:0;left:32px;right:32px;
  height:3px;
  background:var(--iris-bleu);
  border-radius:0 0 2px 2px;
}
.iris-labels-head{
  display:flex;
  align-items:baseline;
  gap:12px;
  margin:0 0 20px;
  flex-wrap:wrap;
}
.iris-labels-head h3{
  margin:0;
  font-size:1.08rem;
  font-weight:800;
  color:var(--iris-bleu);
  letter-spacing:-0.005em;
}
.iris-labels-head h3::before{content:none}
.iris-labels-head .iris-mono-tag{
  font-family:var(--iris-mono);
  font-size:0.7rem;
  letter-spacing:0.16em;
  color:var(--iris-gris);
  text-transform:uppercase;
  font-weight:700;
}
.iris-labels-grid{
  display:grid;
  grid-template-columns:1fr;
  gap:14px;
}
@media (min-width:560px){.iris-labels-grid{grid-template-columns:1fr 1fr}}
.iris-label-card{
  display:flex;
  align-items:center;
  gap:16px;
  padding:18px 20px;
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius-sm);
  background:linear-gradient(180deg,#fff 0%,var(--iris-bg) 100%);
  text-decoration:none !important;
  color:var(--iris-bleu) !important;
  border-bottom:1px solid var(--iris-line);
  transition:border-color .2s ease,transform .2s ease,box-shadow .2s ease;
  position:relative;
}
.iris-label-card:hover{
  border-color:var(--iris-bleu);
  transform:translateY(-2px);
  box-shadow:0 12px 24px -18px rgba(31,49,73,.4);
  color:var(--iris-bleu) !important;
}
.iris-label-shield{
  flex-shrink:0;
  width:46px;height:46px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  color:var(--iris-bleu);
}
.iris-label-shield svg{width:100%;height:100%;display:block}
.iris-label-body{flex:1;min-width:0}
.iris-label-name{
  display:block;
  font-family:var(--iris-mono);
  font-size:0.68rem;
  letter-spacing:0.16em;
  text-transform:uppercase;
  color:var(--iris-gris);
  font-weight:700;
  margin:0 0 4px;
}
.iris-label-title{
  display:block;
  font-size:0.98rem;
  font-weight:700;
  color:var(--iris-bleu);
  line-height:1.3;
}
.iris-label-period{
  display:block;
  font-family:var(--iris-mono);
  font-size:0.75rem;
  color:var(--iris-bleu);
  opacity:0.7;
  margin-top:4px;
  letter-spacing:0.04em;
}
.iris-label-arrow{
  flex-shrink:0;
  color:var(--iris-gris);
  font-size:1.1rem;
  transition:color .2s ease,transform .2s ease;
}
.iris-label-card:hover .iris-label-arrow{color:var(--iris-rose);transform:translateX(2px)}

/* ============= FOOTER AUTHORITY ============= */
.iris-footer{
  margin:0 0 8px;
  padding:18px 22px;
  background:var(--iris-bg);
  border:1px solid var(--iris-line);
  border-radius:var(--iris-radius-sm);
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
  gap:8px 16px;
  font-size:0.82rem;
}
.iris-footer-date{
  font-family:var(--iris-mono);
  color:var(--iris-bleu);
  font-weight:600;
  letter-spacing:0.02em;
}
.iris-footer-date::before{
  content:"●";
  color:var(--iris-vert);
  margin-right:8px;
  font-size:0.7rem;
}
.iris-footer-sign{
  color:var(--iris-gris);
  font-size:0.78rem;
  letter-spacing:0.01em;
}
.iris-footer-sign strong{color:var(--iris-bleu);font-weight:700}

/* ============= CTA buttons — rose plat, cohérent avec le site existant ============= */
.iris-avis-cta{
  margin-top:24px;
  display:flex;
  flex-wrap:wrap;
  gap:12px;
}
.iris-avis-cta a{
  display:inline-flex;
  align-items:center;
  padding:13px 22px;
  border-radius:999px;
  border-bottom:0;
  font-size:0.92rem;
  font-weight:700;
  letter-spacing:0.01em;
  transition:background .15s ease,color .15s ease,transform .15s ease;
}
.iris-cta-primary{
  background:var(--iris-rose);
  color:#fff !important;
}
.iris-cta-primary:hover{
  background:#a3004a;
  transform:translateY(-1px);
}
.iris-cta-secondary{
  background:transparent;
  color:var(--iris-bleu) !important;
  border:1.5px solid var(--iris-bleu) !important;
}
.iris-cta-secondary:hover{
  background:var(--iris-bleu);
  color:#fff !important;
}

/* ============= STICKY CTA — flottant bottom, pill rose, pulse discret ============= */
.iris-sticky-cta{
  position:fixed;
  right:24px;
  bottom:24px;
  z-index:9999;
  display:inline-flex;
  align-items:center;
  gap:10px;
  padding:14px 22px 14px 18px;
  background:var(--iris-rose);
  color:#fff !important;
  border-bottom:0 !important;
  border-radius:999px;
  font-family:inherit;
  font-weight:700;
  font-size:0.95rem;
  letter-spacing:0.01em;
  box-shadow:0 6px 18px -4px rgba(193,0,88,.45), 0 2px 4px rgba(31,49,73,.08);
  text-decoration:none;
  transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
}
.iris-sticky-cta:hover{
  background:#a3004a;
  transform:translateY(-2px);
  box-shadow:0 10px 24px -4px rgba(193,0,88,.55), 0 4px 8px rgba(31,49,73,.10);
  border-bottom:0 !important;
}
.iris-sticky-cta-icon{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:30px;
  height:30px;
  border-radius:50%;
  background:rgba(255,255,255,.18);
  position:relative;
}
.iris-sticky-cta-icon::before{
  content:"";
  position:absolute;
  inset:-4px;
  border-radius:50%;
  border:2px solid rgba(255,255,255,.55);
  animation:iris-pulse 2.2s ease-out infinite;
}
@keyframes iris-pulse{
  0%{transform:scale(.85);opacity:.9}
  70%{transform:scale(1.35);opacity:0}
  100%{transform:scale(1.35);opacity:0}
}
.iris-sticky-cta-icon svg{width:16px;height:16px;color:#fff}
.iris-sticky-cta-label{white-space:nowrap}
@media (max-width:640px){
  .iris-sticky-cta{
    right:12px;
    left:12px;
    bottom:12px;
    justify-content:center;
    padding:16px 18px;
    border-radius:14px;
    font-size:1rem;
  }
}
@media print{
  .iris-sticky-cta{display:none}
}

/* ============= MODAL "Être rappelé" — formulaire propre à l'agence ============= */
.iris-modal{
  position:fixed;
  inset:0;
  z-index:10000;
  display:none;
  align-items:center;
  justify-content:center;
  background:rgba(31,49,73,.55);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
  padding:20px;
  opacity:0;
  transition:opacity .22s ease;
}
.iris-modal.is-open{display:flex;opacity:1}
.iris-modal-dialog{
  background:#fff;
  border-radius:18px;
  max-width:460px;
  width:100%;
  max-height:calc(100vh - 40px);
  overflow-y:auto;
  padding:32px 30px 28px;
  box-shadow:0 30px 80px -16px rgba(31,49,73,.45);
  transform:translateY(12px);
  transition:transform .26s cubic-bezier(.2,.8,.2,1);
  position:relative;
}
.iris-modal.is-open .iris-modal-dialog{transform:translateY(0)}
.iris-modal-close{
  position:absolute;
  top:14px;
  right:14px;
  width:36px;
  height:36px;
  border-radius:50%;
  background:transparent;
  border:1px solid var(--iris-line);
  color:var(--iris-bleu);
  font-size:1.3rem;
  line-height:1;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  transition:background .15s ease, border-color .15s ease;
}
.iris-modal-close:hover{background:var(--iris-bg);border-color:var(--iris-line-strong)}
.iris-modal-eyebrow{
  display:inline-block;
  font-family:var(--iris-mono);
  font-size:0.7rem;
  letter-spacing:0.18em;
  text-transform:uppercase;
  color:var(--iris-rose);
  margin:0 0 10px;
  font-weight:700;
}
.iris-modal h3{
  font-size:1.4rem;
  font-weight:800;
  margin:0 0 6px;
  line-height:1.2;
  color:var(--iris-bleu);
}
.iris-modal-sub{
  font-size:0.92rem;
  color:var(--iris-gris);
  margin:0 0 22px;
  line-height:1.5;
}
.iris-modal form{display:flex;flex-direction:column;gap:14px}
.iris-modal form[hidden]{display:none!important}
.iris-modal-success[hidden]{display:none!important}
.iris-modal-row{display:flex;gap:10px}
.iris-modal-row > *{flex:1}
.iris-modal label{
  display:flex;
  flex-direction:column;
  gap:6px;
  font-size:0.78rem;
  font-weight:700;
  letter-spacing:0.02em;
  color:var(--iris-bleu);
  text-transform:uppercase;
}
.iris-modal input,.iris-modal textarea{
  font:inherit;
  font-size:0.95rem;
  font-weight:500;
  color:var(--iris-bleu);
  background:var(--iris-bg);
  border:1.5px solid var(--iris-line);
  border-radius:10px;
  padding:11px 14px;
  transition:border-color .15s ease, background .15s ease;
  width:100%;
  text-transform:none;
  letter-spacing:0;
}
.iris-modal textarea{min-height:90px;resize:vertical;font-family:inherit}
.iris-modal input:focus,.iris-modal textarea:focus{
  outline:none;
  border-color:var(--iris-rose);
  background:#fff;
}
.iris-modal-submit{
  background:var(--iris-rose);
  color:#fff;
  border:0;
  border-radius:999px;
  padding:14px 22px;
  font-weight:700;
  font-size:0.95rem;
  letter-spacing:0.01em;
  cursor:pointer;
  margin-top:6px;
  transition:background .15s ease, transform .15s ease;
}
.iris-modal-submit:hover:not(:disabled){background:#a3004a;transform:translateY(-1px)}
.iris-modal-submit:disabled{opacity:.55;cursor:wait}
.iris-modal-legal{
  font-size:0.72rem;
  color:var(--iris-gris);
  text-align:center;
  margin:8px 0 0;
  line-height:1.4;
}
.iris-modal-state{
  display:none;
  text-align:center;
  padding:14px 0 6px;
  font-size:0.95rem;
}
.iris-modal-state.is-shown{display:block}
.iris-modal-state.is-success{color:var(--iris-vert);font-weight:700}
.iris-modal-state.is-error{color:var(--iris-rose);font-weight:700}
.iris-modal-success{display:flex;flex-direction:column;align-items:center;text-align:center;padding:8px 4px 4px}
.iris-modal-success-check{color:var(--iris-vert);margin-bottom:14px;animation:irisCheck .55s cubic-bezier(.16,1,.3,1)}
@keyframes irisCheck{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.iris-modal-success-title{margin:0 0 8px;font-size:1.45rem;font-weight:800;color:var(--iris-ink)}
.iris-modal-success-title span{color:var(--iris-rose)}
.iris-modal-success-lead{margin:0 0 22px;font-size:.98rem;color:var(--iris-ink-soft);line-height:1.55}
.iris-modal-success-sep{position:relative;width:100%;text-align:center;margin:8px 0 18px;color:var(--iris-ink-soft);font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;font-weight:700}
.iris-modal-success-sep::before,.iris-modal-success-sep::after{content:"";position:absolute;top:50%;width:calc(50% - 60px);height:1px;background:var(--iris-line)}
.iris-modal-success-sep::before{left:0}
.iris-modal-success-sep::after{right:0}
.iris-modal-success-sep span{display:inline-block;padding:0 12px;background:#fff;position:relative}
.iris-modal-success-pitch{margin:0 0 18px;font-size:.95rem;color:var(--iris-ink);line-height:1.55}
.iris-modal-success-cta,.iris-modal-success-cta:link,.iris-modal-success-cta:visited{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  background:linear-gradient(135deg,#16a34a 0%,#15803d 60%,#0f6b35 100%)!important;
  color:#fff!important;font-weight:800;font-size:1rem;padding:14px 22px;border-radius:999px;
  text-decoration:none!important;box-shadow:0 12px 28px -10px rgba(22,163,74,.55);
  transition:transform .18s ease,box-shadow .18s ease;width:100%;
  animation:irisPulse 1.8s ease-in-out infinite;border:0;
}
.iris-modal-success-cta:hover,.iris-modal-success-cta:focus,.iris-modal-success-cta:active{transform:translateY(-2px);box-shadow:0 18px 34px -12px rgba(22,163,74,.7);color:#fff!important;animation:none;text-decoration:none!important}
@keyframes irisPulse{0%,100%{box-shadow:0 12px 28px -10px rgba(22,163,74,.55)}50%{box-shadow:0 12px 28px -8px rgba(22,163,74,.85),0 0 0 6px rgba(22,163,74,.12)}}
.iris-modal-success-close{
  margin-top:10px;background:none;border:0;color:var(--iris-ink-soft);
  font-size:.85rem;cursor:pointer;text-decoration:underline;padding:6px;
}
.iris-modal-success-close:hover{color:var(--iris-ink)}
@media (max-width:640px){
  .iris-modal-dialog{padding:24px 20px 22px}
  .iris-modal h3{font-size:1.2rem}
  .iris-modal-row{flex-direction:column;gap:14px}
}
</style>`
}

/**
 * Hero block — sobre, blanc, eyebrow rose, micro-tagline violet en bas.
 */
function buildHero(g, placesUsed) {
  const h1 = escapeHtml(g.h1_suggere ?? "")
  const firstPMatch = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(g.texte_seo_html ?? "")
  const leadHtml = firstPMatch ? firstPMatch[1] : ""

  return `<div class="iris-hero">
<p class="iris-hero-eyebrow">Permis accéléré · Auto-école certifiée</p>
<h2>${h1}</h2>
<p class="iris-hero-lead">${leadHtml}</p>
<p class="iris-hero-meta">INRI'S Formations · Depuis 2003 · Réseau national</p>
</div>`
}

/**
 * Stat strip — anchor : 4 chiffres XXL, navy mono, UN seul en vert.
 */
function buildStats(placesUsed) {
  // SVG permis de conduire (carte d'identité avec photo + barre)
  const permitIcon = `<span class="iris-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11.5" r="2.2"/><path d="M5.4 16.2c.5-1.3 1.6-2.1 2.6-2.1s2.1.8 2.6 2.1"/><path d="M13.5 10h5.5"/><path d="M13.5 13h5"/><path d="M13.5 16h3.5"/></svg></span>`
  const stats = [
    { num: "5J·20H", lbl: "stage accéléré B", vert: false },
    { num: "3J·13H", lbl: "stage accéléré boîte auto", vert: false },
    { num: permitIcon, lbl: "place d'examen garantie", vert: false, raw: true },
  ]
  if (placesUsed && placesUsed.rating != null) {
    const count = placesUsed.userRatingCount ?? placesUsed.reviewCount ?? 0
    stats.push({ num: `${placesUsed.rating}/5`, lbl: `${count} avis Google`, vert: true })
  } else {
    stats.push({ num: "QUALIOPI", lbl: "auto-école certifiée", vert: false })
  }
  return `<div class="iris-stats">${stats.map(s =>
    `<div class="iris-stat${s.vert ? ' is-vert' : ''}"><div class="iris-stat-num">${s.raw ? s.num : escapeHtml(s.num)}</div><div class="iris-stat-lbl">${escapeHtml(s.lbl)}</div></div>`,
  ).join("")}</div>`
}

function stripFirstP(html) {
  return (html ?? "").replace(/<p[^>]*>[\s\S]*?<\/p>/i, "").trim()
}

function decorateMap(mapEmbedHtml) {
  if (!mapEmbedHtml) return ""
  const iframe = (mapEmbedHtml.match(/<iframe[^>]*><\/iframe>/i) || [""])[0]
  const moreLink = (mapEmbedHtml.match(/<a [^>]*href="(https:\/\/www\.openstreetmap\.org[^"]+)"[^>]*>([\s\S]*?)<\/a>/i) || [null, "#", "Voir une carte plus grande"])
  return `<div class="iris-map">
<div class="iris-map-header"><span>Localisation du centre</span><span>OpenStreetMap</span></div>
${iframe}
<div class="iris-map-foot"><a href="${moreLink[1]}" target="_blank" rel="noopener">${moreLink[2]} →</a></div>
</div>`
}

function decorateAvis(placesUsed, ville, fallbackHtml) {
  if (!placesUsed) {
    if (!fallbackHtml) return ""
    return `<div class="iris-avis">${fallbackHtml}</div>`
  }
  const stars = "★".repeat(Math.round(placesUsed.rating)) + "☆".repeat(5 - Math.round(placesUsed.rating))
  const count = placesUsed.userRatingCount ?? placesUsed.reviewCount ?? 0
  const reviews = (placesUsed.reviews ?? []).filter(r => r.text && r.text.length > 30).slice(0, 5)
  const reviewsHtml = reviews.map(r => {
    const rstars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating)
    const safeText = escapeHtml(r.text).slice(0, 320)
    const truncated = r.text.length > 320 ? "…" : ""
    return `<div class="iris-review">
<div class="iris-review-meta"><strong>${escapeHtml(r.author ?? "Élève")}</strong><span class="iris-review-when">${escapeHtml(r.relativeTime ?? "")}</span></div>
<div class="iris-avis-stars" style="margin-bottom:6px;font-size:0.95rem">${rstars}</div>
<p class="iris-review-text">${safeText}${truncated}</p>
</div>`
  }).join("\n")
  const writeReviewUrl = `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placesUsed.placeId)}`
  const mapsUrl = placesUsed.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${placesUsed.placeId}`
  return `<div class="iris-avis">
<div class="iris-avis-head">
<h3>Avis Google des élèves de ${escapeHtml(ville)}</h3>
<span class="iris-avis-stars">${stars}</span>
<span class="iris-avis-score">${placesUsed.rating}/5</span>
<span class="iris-avis-count">· ${count} avis vérifiés</span>
</div>
${reviewsHtml}
<div class="iris-avis-cta">
<a class="iris-cta-primary" href="${mapsUrl}" target="_blank" rel="noopener">Voir tous les avis Google →</a>
<a class="iris-cta-secondary" href="${writeReviewUrl}" target="_blank" rel="noopener">Laisser un avis</a>
</div>
</div>`
}

function buildNearby(nearby) {
  if (!nearby || nearby.length === 0) return ""
  const items = nearby.map(n =>
    `<li><a href="/points-de-rdv/${escapeHtml(n.slug)}">Auto-école INRI'S ${escapeHtml(n.ville)}<span class="iris-nearby-dist">${escapeHtml(n.distance)} km</span></a></li>`,
  ).join("")
  return `<div class="iris-nearby">
<div class="iris-nearby-head">
<span class="iris-mono-tag">Réseau INRI'S</span>
<h3>Autres points de RDV à proximité</h3>
</div>
<ul>${items}</ul>
</div>`
}

function buildLabels(labels, ville) {
  if (!labels || Object.keys(labels).length === 0) return ""
  // Bouclier officiel + checkmark
  const shieldQualiopi = `<span class="iris-label-shield" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5l8 3v6.2c0 5-3.4 9-8 9.8-4.6-.8-8-4.8-8-9.8V5.5l8-3z"/><path d="M8.5 12.2l2.6 2.6 4.4-5"/></svg></span>`
  const shieldLabel = `<span class="iris-label-shield" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5.5"/><path d="M8 13l-2.5 7 3-1.4 1.6 2.9L12.5 16"/><path d="M16 13l2.5 7-3-1.4-1.6 2.9L11.5 16"/><path d="M9.5 9l1.7 1.7 3.3-3.3"/></svg></span>`
  const cards = []
  if (labels.qualiopi) {
    cards.push(`<a class="iris-label-card" href="${labels.qualiopi.url}" target="_blank" rel="noopener" title="Voir le certificat Qualiopi (PDF)">
${shieldQualiopi}
<span class="iris-label-body">
<span class="iris-label-name">Certification officielle</span>
<span class="iris-label-title">QUALIOPI — qualité des actions de formation</span>
<span class="iris-label-period">Valide ${escapeHtml(labels.qualiopi.period)} · PDF</span>
</span>
<span class="iris-label-arrow" aria-hidden="true">→</span>
</a>`)
  }
  if (labels.labelQualite) {
    cards.push(`<a class="iris-label-card" href="${labels.labelQualite.url}" target="_blank" rel="noopener" title="Voir l'attestation du Label Qualité (PDF)">
${shieldLabel}
<span class="iris-label-body">
<span class="iris-label-name">Label préfectoral</span>
<span class="iris-label-title">Label Qualité des écoles de conduite</span>
<span class="iris-label-period">Valide ${escapeHtml(labels.labelQualite.period)} · PDF</span>
</span>
<span class="iris-label-arrow" aria-hidden="true">→</span>
</a>`)
  }
  return `<div class="iris-labels">
<div class="iris-labels-head">
<span class="iris-mono-tag">Centre certifié</span>
<h3>Certifications & labels qualité du centre${ville ? ` de ${escapeHtml(ville)}` : ""}</h3>
</div>
<div class="iris-labels-grid">${cards.join("")}</div>
</div>`
}

function buildStickyCta({ agencyEmail, ville } = {}) {
  const phoneIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>`
  // Mode 1 : auto-école physique → ouvre une modale avec formulaire qui email l'agence
  if (agencyEmail) {
    const cityLabel = ville ? `auto-école INRI'S de ${escapeHtml(ville)}` : "l'agence INRI'S"
    return `<button type="button" class="iris-sticky-cta" data-iris-open-modal aria-label="Être rappelé gratuitement par ${cityLabel}" style="border:0;cursor:pointer">
<span class="iris-sticky-cta-icon">${phoneIcon}</span>
<span class="iris-sticky-cta-label">Être rappelé gratuitement</span>
</button>
<div class="iris-modal" role="dialog" aria-modal="true" aria-labelledby="iris-modal-title">
<div class="iris-modal-dialog">
<button type="button" class="iris-modal-close" data-iris-close aria-label="Fermer">×</button>
<span class="iris-modal-eyebrow">Demande de rappel</span>
<h3 id="iris-modal-title">Être rappelé par ${cityLabel}</h3>
<p class="iris-modal-sub">Un conseiller vous rappelle sous 24h ouvrées. Renseignements gratuits, sans engagement.</p>
<form data-iris-callback-form novalidate>
<div class="iris-modal-row">
<label>Prénom<input type="text" name="first_name" autocomplete="given-name" required></label>
<label>Nom<input type="text" name="last_name" autocomplete="family-name" required></label>
</div>
<label>Téléphone<input type="tel" name="phone" autocomplete="tel" required pattern="[+0-9 .-]{8,}"></label>
<label>Email<input type="email" name="email" autocomplete="email" required></label>
<label>Votre message (optionnel)<textarea name="message" rows="3" placeholder="Permis B, moto, dispo en soirée..."></textarea></label>
<input type="hidden" name="agency_email" value="${escapeHtml(agencyEmail)}">
<input type="hidden" name="agency_ville" value="${escapeHtml(ville || "")}">
<input type="hidden" name="source_url">
<button type="submit" class="iris-modal-submit">Demander un rappel</button>
<p class="iris-modal-legal">En soumettant ce formulaire, vous acceptez d'être contacté par INRI'S. Vos données ne sont jamais revendues.</p>
<div class="iris-modal-state" data-iris-state></div>
</form>
<div class="iris-modal-success" data-iris-success hidden>
<div class="iris-modal-success-check" aria-hidden="true">
<svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-18"/></svg>
</div>
<h3 class="iris-modal-success-title">Merci <span data-iris-success-name>!</span></h3>
<p class="iris-modal-success-lead">L'agence INRI'S ${ville ? escapeHtml(ville) : ""} vous rappellera <strong>sous 24h ouvrées</strong>.</p>
<div class="iris-modal-success-sep"><span>En attendant</span></div>
<p class="iris-modal-success-pitch">Créez votre compte <strong>INRI'S Connect</strong> pour suivre votre dossier, réserver vos heures de conduite et accéder à votre code de la route en ligne.</p>
<a class="iris-modal-success-cta" href="https://connect.inris-formations.com/register" target="_blank" rel="noopener">Créer mon compte INRI'S Connect →</a>
<button type="button" class="iris-modal-success-close" data-iris-close>Fermer</button>
</div>
</div>
</div>
<script>(function(){
  var WEBHOOK="https://services.leadconnectorhq.com/hooks/Mp5qATtnaYZ49oL2Q9Qr/webhook-trigger/8846f736-7ab8-4052-9d47-309bfe4b9d1e";
  var modal=document.currentScript.previousElementSibling;
  var btn=document.querySelector("[data-iris-open-modal]");
  var closeBtns=modal.querySelectorAll("[data-iris-close]");
  var form=modal.querySelector("[data-iris-callback-form]");
  var state=modal.querySelector("[data-iris-state]");
  var successCard=modal.querySelector("[data-iris-success]");
  var successName=modal.querySelector("[data-iris-success-name]");
  var srcInput=form.querySelector('[name="source_url"]');
  srcInput.value=location.href;
  function open(){modal.classList.add("is-open");setTimeout(function(){var f=form.querySelector('input[name="first_name"]');if(f)f.focus()},100)}
  function reset(){state.className="iris-modal-state";state.textContent="";successCard.hidden=true;form.hidden=false}
  function close(){modal.classList.remove("is-open");setTimeout(reset,250)}
  btn.addEventListener("click",open);
  for(var i=0;i<closeBtns.length;i++)closeBtns[i].addEventListener("click",close);
  modal.addEventListener("click",function(e){if(e.target===modal)close()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&modal.classList.contains("is-open"))close()});
  form.addEventListener("submit",async function(e){
    e.preventDefault();
    var submit=form.querySelector(".iris-modal-submit");
    submit.disabled=true;submit.textContent="Envoi en cours...";
    state.className="iris-modal-state";
    var fd=new FormData(form);
    var payload={};fd.forEach(function(v,k){payload[k]=v});
    payload.submitted_at=new Date().toISOString();
    try{
      if(WEBHOOK.indexOf("__")===0){throw new Error("Webhook non configuré (placeholder)");}
      var r=await fetch(WEBHOOK,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!r.ok)throw new Error("HTTP "+r.status);
      successName.textContent=(payload.first_name||"")+" !";
      form.hidden=true;successCard.hidden=false;
      form.reset();srcInput.value=location.href;
      var dialog=modal.querySelector(".iris-modal-dialog");
      if(dialog){dialog.scrollTop=0;successCard.scrollIntoView({behavior:"smooth",block:"start"});}
    }catch(err){
      state.classList.add("is-shown","is-error");
      state.textContent="Une erreur est survenue. Merci d'appeler directement l'agence ou réessayer.";
    }finally{
      submit.disabled=false;submit.textContent="Demander un rappel";
    }
  });
})();<\/script>`
  }
  // Mode 2 : point-de-rdv générique → lien direct vers le widget GHL booking
  const url = "https://api.leadconnectorhq.com/widget/booking/wJb4IGGSsW4yUm0OWeUX"
  return `<a class="iris-sticky-cta" href="${url}" target="_blank" rel="noopener" aria-label="Être rappelé gratuitement par un téléconseiller INRI'S">
<span class="iris-sticky-cta-icon">${phoneIcon}</span>
<span class="iris-sticky-cta-label">Être rappelé gratuitement</span>
</a>`
}

function buildFooter() {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  return `<div class="iris-footer">
<span class="iris-footer-date">Page mise à jour le ${escapeHtml(today)}</span>
<span class="iris-footer-sign">Édité par <strong>Iris</strong> · Réseau <strong>INRI'S Formations</strong> · Depuis 2003</span>
</div>`
}

export function decorateSeoHtml({ generated: g, placesUsed, ville, nearby = [], labels = {}, agencyEmail = null }) {
  const bodyHtml = stripFirstP(g.texte_seo_html ?? "")
  const heroBlock = buildHero(g, placesUsed)
  const statsBlock = buildStats(placesUsed)
  const mapBlock = decorateMap(g.map_embed_html)
  const avisBlock = decorateAvis(placesUsed, ville, g.avis_google_html)
  const labelsBlock = buildLabels(labels, ville)
  const nearbyBlock = buildNearby(nearby)
  const footerBlock = buildFooter()
  const stickyCta = buildStickyCta({ agencyEmail, ville })
  const jsonLdBlocks = [
    g.jsonld_driving_school,
    g.jsonld_faq,
    g.jsonld_breadcrumb,
  ].filter(Boolean).map(s => `<script type="application/ld+json">${s}</script>`).join("\n")

  return `${buildScopedStyle()}
<div class="iris-seo">
${heroBlock}
${statsBlock}
<div class="iris-body">
${bodyHtml}
</div>
${mapBlock}
${avisBlock}
${nearbyBlock}
${footerBlock}
${stickyCta}
${jsonLdBlocks}
</div>`
}
