/*!
 * INRI'S — Bascule "mise en relation" sur les fiches auto-école physique
 * autoecole-inris.com (Webflow)   — /points-de-rdv/<slug>
 * inris-formations.com (WordPress) — /centres/<slug>/
 *
 * Les deux sites partagent les mêmes identifiants de DOM (#title-agence,
 * #traineeshipFilter, #gearboxContainer, #traineeshipContainer) et le même
 * backoffice : un seul fichier suffit.
 *
 * Règle : sur une auto-école physique (type "agency" du backoffice), le catalogue
 * de formations reste ENTIÈREMENT VISIBLE — l'élève a besoin de ces informations.
 * Seuls la réservation et le paiement en ligne disparaissent : le bouton
 * "Réserver" devient "Demander un rappel", et un bloc de contact (téléphone de
 * l'agence + formulaire) est ajouté sous le catalogue.
 * L'agence centrale de Melun et les points de RDV conduite (type "driving-point")
 * ne sont pas touchés.
 *
 * Idempotence : window.__inrisAeiContactAgencyV1
 */
(function () {
  "use strict";
  if (window.__inrisAeiContactAgencyV1) return;
  window.__inrisAeiContactAgencyV1 = true;

  /* L'agence centrale garde la vente en ligne. */
  var MELUN = "auto-ecole-inris-melun-centre";

  /* Chaque site range ses fiches sous son propre préfixe. */
  var PREFIXES = ["/points-de-rdv/", "/centres/"];

  /* Les auto-écoles physiques hors Melun, slug de fiche -> téléphone.
     Construite à partir des 37 agences du backoffice (endpoint
     /api/agencies/get?action=formations puis lecture du `type` code par code),
     et non plus des sitemaps qui en manquaient. Une entrée absente d'un site y
     est simplement sans effet.
     Liste embarquée pour agir sans attendre le réseau : pas de clignotement,
     et la bascule tient même si le backoffice est injoignable.
     Toute agence ajoutée plus tard est rattrapée par le contrôle API ci-dessous. */
  var AGENCIES = {
    "auto-ecole-inris-aix-centre": "0442211266",
    "auto-ecole-inris-athis-mons": "0160482903",
    "auto-ecole-inris-aubervilliers": "0149374921",
    "auto-ecole-inris-boissy-saint-leger": "0143534747",
    "auto-ecole-inris-bondy": "0148491632",
    "auto-ecole-inris-boulogne": "0986662225",
    "auto-ecole-inris-colombes": "0980889467",
    "auto-ecole-inris-conflans-sainte-honorine": "0660325087",
    "auto-ecole-inris-conflans-sainte-honorine-w8avy": "0660325087",
    "auto-ecole-inris-creteil-le-chateau": "0148992000",
    "auto-ecole-inris-franconville": "0185110437",
    "auto-ecole-inris-gagny": "0650091001",
    "auto-ecole-inris-gare-de-sartrouville": "0130539773",
    "auto-ecole-inris-la-courneuve": "0148364351",
    "auto-ecole-inris-le-raincy": "0143024746",
    "auto-ecole-inris-lycee-artaud": "0491614405",
    "auto-ecole-inris-metro-front-populaire": "0149513391",
    "auto-ecole-inris-metro-javel": "0140594242",
    "auto-ecole-inris-nanterre": "0147210298",
    "auto-ecole-inris-pontault-combault": "0160285418",
    "auto-ecole-inris-puteaux": "0145060567",
    "auto-ecole-inris-rognac": "0442026421",
    "auto-ecole-inris-saint-brice": "0984097580",
    "auto-ecole-inris-saint-fargeau-ponthierry": "0160655647",
    "auto-ecole-inris-saint-soupplets": "0652950903",
    "auto-ecole-inris-sainte-croix-neuilly": "0973182465",
    "auto-ecole-inris-sainte-marthe": "0491983940",
    "auto-ecole-inris-ste-marthe": "0491983940",
    "auto-ecole-inris-technopole": "0491050752",
    "auto-ecole-inris-thorigny-sur-marne": "",
    "auto-ecole-inris-tremblay-en-france": "0175351428",
    "auto-ecole-inris-versailles": "0139502898",
    "auto-ecole-inris-villejuif": "0153147117",
    "auto-ecole-inris-villemomble": "0169234928",
    "auto-ecole-inris-villeneuve-la-garenne": "0147998055",
    "auto-ecole-inris-villepinte": "0952876043",
    "auto-ecole-inris-viroflay": "0981159957",
    "auto-ecole-saint-soupplets": "0652950903",
    "auto-ecole-thorigny-sur-marne": ""
  };

  var ENDPOINT = "https://agent.autoecole-inris.com/admin-iris/api/public/rappel";
  var BOOKING_API = "https://connect.inris-formations.com";

  var slug = "";
  for (var p = 0; p < PREFIXES.length; p++) {
    var at = location.pathname.indexOf(PREFIXES[p]);
    if (at < 0) continue;
    /* WordPress ajoute une barre finale, pas Webflow. */
    slug = location.pathname.slice(at + PREFIXES[p].length).split("/")[0];
    break;
  }
  if (!slug || slug === MELUN) return;

  /* Quelques fiches portent un slug qui ne correspond pas au code du backoffice
     (auto-ecole-inris-ste-marthe vs auto-ecole-inris-sainte-marthe, etc.). */
  var ALIASES = {
    "auto-ecole-inris-boissy-saint-leger": "auto-ecole-inri-s-boissy-saint-leger",
    "auto-ecole-inris-conflans-sainte-honorine-w8avy": "auto-ecole-inris-conflans-sainte-honorine",
    "auto-ecole-inris-rognac": "auto-ecole-inri-s-rognac",
    "auto-ecole-inris-saint-soupplets": "auto-ecole-saint-soupplets",
    "auto-ecole-inris-ste-marthe": "auto-ecole-inris-sainte-marthe",
    "auto-ecole-inris-thorigny-sur-marne": "auto-ecole-thorigny-sur-marne",
    "auto-ecole-inris-villemomble": "inris-point-conduite-villemomble"
  };
  var code = Object.prototype.hasOwnProperty.call(ALIASES, slug) ? ALIASES[slug] : slug;

  /* ---------- 1. Styles ---------- */

  var CSS =
    /* Le catalogue reste visible : on ne masque QUE ce qui relève du paiement. */
    ".aei-no-online-sale .aei-pay-hint{display:none!important}" +
    ".aei-no-online-sale .inris-card-badge.inris-badge-pay{display:none!important}" +
    ".aei-btn-rappel{display:inline-block;margin-top:8px;border:0;cursor:pointer;background:#00B87C;color:#fff;" +
    "font-weight:700;font-size:.9rem;line-height:1.2;border-radius:9999px;padding:10px 18px;white-space:nowrap;" +
    "transition:filter .15s;font-family:inherit}" +
    ".aei-btn-rappel:hover{filter:brightness(1.08)}" +
    ".aei-agence-note{max-width:56rem;margin:0 auto 24px;padding:14px 18px;border-radius:12px;" +
    "background:#fff0f5;border:1px solid #fce4ec;color:#1F3149;font-size:.95rem;line-height:1.55;text-align:center}" +
    ".aei-agence-note strong{color:#C10058}" +
    ".aei-contact{max-width:56rem;margin:0 auto;padding:8px 4px 8px}" +
    ".aei-contact__head{text-align:center;margin-bottom:28px}" +
    ".aei-contact__head h2{font-size:1.85rem;line-height:1.25;font-weight:800;color:#1F3149;margin:0}" +
    ".aei-contact__rule{width:160px;height:4px;background:#00E5AC;margin:12px auto 0;border-radius:2px}" +
    ".aei-contact__intro{max-width:40rem;margin:16px auto 0;text-align:center;color:#4b5563;font-size:1rem;line-height:1.6}" +
    ".aei-contact__grid{display:grid;grid-template-columns:1fr 1.25fr;gap:24px;align-items:start}" +
    ".aei-contact__card{background:#fff;border:1px solid #fce4ec;border-radius:16px;padding:24px;box-shadow:0 2px 14px rgba(31,49,73,.06)}" +
    ".aei-contact__card h3{font-size:1.1rem;font-weight:800;color:#1F3149;margin:0 0 6px}" +
    ".aei-contact__hint{color:#6b7280;font-size:.9rem;line-height:1.5;margin:0 0 16px}" +
    ".aei-contact__tel{display:flex;align-items:center;justify-content:center;gap:10px;background:#1F3149;color:#fff!important;" +
    "text-decoration:none;font-weight:800;font-size:1.3rem;letter-spacing:.02em;border-radius:12px;padding:16px 18px;transition:filter .15s}" +
    ".aei-contact__tel:hover{filter:brightness(1.15)}" +
    ".aei-contact__sep{display:flex;align-items:center;gap:12px;margin:18px 0;color:#9ca3af;font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}" +
    ".aei-contact__sep:before,.aei-contact__sep:after{content:'';flex:1;height:1px;background:#e5e7eb}" +
    ".aei-contact__list{margin:0;padding:0;list-style:none;color:#4b5563;font-size:.92rem;line-height:1.7}" +
    ".aei-contact__list li{padding-left:22px;position:relative}" +
    ".aei-contact__list li:before{content:'\\2713';position:absolute;left:0;color:#00b98a;font-weight:700}" +
    ".aei-contact__field{margin-bottom:14px}" +
    ".aei-contact__field label{display:block;font-size:.85rem;font-weight:700;color:#1F3149;margin-bottom:6px}" +
    ".aei-contact__field .req{color:#C10058}" +
    ".aei-contact input[type=text],.aei-contact input[type=tel],.aei-contact input[type=email]," +
    ".aei-contact select,.aei-contact textarea{width:100%;box-sizing:border-box;border:1px solid #e5e7eb;border-radius:10px;" +
    "padding:11px 13px;font-size:.95rem;font-family:inherit;color:#1F3149;background:#fff;transition:border-color .15s,box-shadow .15s}" +
    ".aei-contact input:focus,.aei-contact select:focus,.aei-contact textarea:focus{outline:none;border-color:#C10058;box-shadow:0 0 0 3px rgba(193,0,88,.12)}" +
    ".aei-contact textarea{min-height:88px;resize:vertical}" +
    ".aei-contact__row{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
    ".aei-contact__hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}" +
    ".aei-contact__submit{width:100%;border:0;cursor:pointer;background:#00B87C;color:#fff;font-weight:800;font-size:1.02rem;" +
    "border-radius:12px;padding:14px 18px;margin-top:4px;transition:filter .15s;font-family:inherit}" +
    ".aei-contact__submit:hover{filter:brightness(1.08)}" +
    ".aei-contact__submit[disabled]{opacity:.6;cursor:default}" +
    ".aei-contact__rgpd{margin:12px 0 0;font-size:.76rem;line-height:1.5;color:#9ca3af}" +
    ".aei-contact__msg{margin-top:14px;padding:12px 14px;border-radius:10px;font-size:.9rem;line-height:1.5;display:none}" +
    ".aei-contact__msg.is-ok{display:block;background:#e8fbf4;color:#046c4e;border:1px solid #a7f3d0}" +
    ".aei-contact__msg.is-ko{display:block;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}" +
    "@media(max-width:860px){.aei-contact__grid{grid-template-columns:1fr}.aei-contact__row{grid-template-columns:1fr}" +
    ".aei-contact__head h2{font-size:1.5rem}}";

  function injectCss() {
    if (document.getElementById("aei-contact-css")) return;
    var st = document.createElement("style");
    st.id = "aei-contact-css";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function markAgency() {
    document.documentElement.classList.add("aei-no-online-sale");
  }

  /* ---------- 2. Décision : cette fiche est-elle une auto-école physique ? ---------- */

  var known = Object.prototype.hasOwnProperty.call(AGENCIES, slug);
  if (known) {
    injectCss();
    markAgency();
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function prettyPhone(raw) {
    var d = String(raw || "").replace(/[^0-9+]/g, "");
    if (/^0[0-9]{9}$/.test(d)) return d.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    return String(raw || "").trim();
  }

  /* Listes déroulantes du formulaire. La première option reste vide : rien n'est
     obligatoire ici, et un choix par défaut fausserait la statistique. */
  var FORMATIONS = [
    "Permis B — boîte manuelle",
    "Permis B — boîte automatique",
    "Conduite accompagnée (AAC)",
    "Code de la route",
    "Permis moto (A1, A2, A)",
    "Permis remorque (BE) ou poids lourd",
    "Stage de récupération de points",
    "Je ne sais pas encore",
  ];

  var PROVENANCES = [
    "Recherche Google",
    "Réseaux sociaux",
    "Recommandation d'un proche",
    "Déjà élève chez INRI'S",
    "En passant devant l'agence",
    "Publicité",
    "Autre",
  ];

  function options(list) {
    var html = '<option value="">Sélectionnez…</option>';
    for (var i = 0; i < list.length; i++) {
      html += '<option value="' + esc(list[i]) + '">' + esc(list[i]) + "</option>";
    }
    return html;
  }

  /* ---------- 3. Les cartes : on garde tout, on retire seulement l'achat ---------- */

  /* La mention "Réserver en ligne en payant 10 %" n'a pas de classe propre :
     on la repère par son texte, puis on la marque pour la masquer en CSS. */
  function tagPayHints(root) {
    var nodes = root.querySelectorAll("p, span, div");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length) continue;
      var t = (el.textContent || "").toLowerCase();
      if (t.indexOf("réserver en ligne") >= 0 || t.indexOf("reserver en ligne") >= 0) {
        el.classList.add("aei-pay-hint");
      }
    }
  }

  /* Le bouton d'origine est REMPLACÉ, pas masqué : le modal de réservation écoute
     ".btn-reserve" en délégation, donc retirer le nœud et la classe suffit à le
     neutraliser proprement. */
  function swapReserveButtons(root) {
    var olds = root.querySelectorAll(".btn-reserve");
    for (var i = 0; i < olds.length; i++) {
      var old = olds[i];
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "aei-btn-rappel";
      btn.textContent = "Demander un rappel";
      btn.setAttribute("data-stage", old.getAttribute("data-traineeship-name") || "");
      btn.setAttribute("data-price", old.getAttribute("data-traineeship-price") || "");
      old.parentNode.replaceChild(btn, old);
    }
  }

  function decorateCards() {
    var container = document.getElementById("traineeshipContainer");
    if (!container) return;
    tagPayHints(container);
    swapReserveButtons(container);
  }

  /* Un clic sur "Demander un rappel" amène au formulaire, en pré-remplissant
     la formation concernée. Délégué : survit aux re-rendus du catalogue. */
  function wireStageButtons() {
    if (document.__aeiStageClickBound) return;
    document.__aeiStageClickBound = true;
    document.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".aei-btn-rappel") : null;
      if (!btn) return;
      e.preventDefault();
      var bloc = document.getElementById("aei-contact");
      if (!bloc) return;
      var stage = btn.getAttribute("data-stage") || "";
      var price = btn.getAttribute("data-price") || "";
      var champ = bloc.querySelector("[name=message]");
      if (champ && stage && !champ.value.trim()) {
        champ.value =
          "Je souhaite des informations sur : " + stage + (price ? " (" + price + " €)" : "");
      }
      /* Le nom du stage dit souvent le type : on présélectionne quand c'est net,
         sans écraser un choix déjà fait. */
      var sel = bloc.querySelector("[name=typeFormation]");
      if (sel && !sel.value && stage) {
        var t = stage.toLowerCase();
        var devine =
          t.indexOf("moto") >= 0 || /\ba1\b|\ba2\b/.test(t)
            ? "Permis moto (A1, A2, A)"
            : t.indexOf("automatique") >= 0 || t.indexOf("boite auto") >= 0
              ? "Permis B — boîte automatique"
              : t.indexOf("manuelle") >= 0
                ? "Permis B — boîte manuelle"
                : t.indexOf("code") >= 0
                  ? "Code de la route"
                  : t.indexOf("accompagn") >= 0
                    ? "Conduite accompagnée (AAC)"
                    : /\bce\b|\bbe\b|remorque|poids lourd/.test(t)
                      ? "Permis remorque (BE) ou poids lourd"
                      : "";
        if (devine) sel.value = devine;
      }
      bloc.scrollIntoView({ behavior: "smooth", block: "start" });
      var prenom = bloc.querySelector("[name=prenom]");
      if (prenom) {
        setTimeout(function () {
          prenom.focus();
        }, 400);
      }
    });
  }

  /* Le catalogue est rendu par un script tiers et re-rendu à chaque filtre :
     on ré-applique après chaque mutation. */
  function watchCards() {
    var container = document.getElementById("traineeshipContainer");
    if (!container || container.__aeiObserved) return;
    container.__aeiObserved = true;
    decorateCards();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        decorateCards();
      }, 60);
    }).observe(container, { childList: true, subtree: true });
  }

  /* ---------- 4. Le bloc de mise en relation ---------- */

  function build(phone, agencyName) {
    var tel = String(phone || "").replace(/[^0-9+]/g, "");
    var wrap = document.createElement("div");
    wrap.className = "aei-contact";
    wrap.id = "aei-contact";
    wrap.innerHTML =
      '<div class="aei-contact__head">' +
      "<h2>Contactez " +
      (agencyName ? esc(agencyName) : "cette auto-école") +
      "</h2>" +
      '<div class="aei-contact__rule"></div>' +
      '<p class="aei-contact__intro">Une question sur une formation, un devis, un financement ? ' +
      "Appelez l'auto-école directement, ou laissez vos coordonnées : elle vous rappelle.</p>" +
      "</div>" +
      '<div class="aei-contact__grid">' +
      '<div class="aei-contact__card">' +
      "<h3>Appeler l'auto-école</h3>" +
      '<p class="aei-contact__hint">Du lundi au samedi, aux horaires d\'ouverture indiqués sur cette page.</p>' +
      (tel
        ? '<a class="aei-contact__tel" href="tel:' +
          esc(tel) +
          '"><i class="fa-solid fa-phone"></i>' +
          esc(prettyPhone(phone)) +
          "</a>"
        : "") +
      '<div class="aei-contact__sep">ou</div>' +
      '<ul class="aei-contact__list">' +
      "<li>Devis personnalisé selon votre profil</li>" +
      "<li>Réponse sous 24 h ouvrées</li>" +
      "<li>Sans engagement</li>" +
      "</ul>" +
      "</div>" +
      '<div class="aei-contact__card">' +
      "<h3>Être rappelé</h3>" +
      '<p class="aei-contact__hint">Renseignez vos coordonnées, l\'auto-école vous recontacte.</p>' +
      '<form class="aei-contact__form" novalidate>' +
      '<div class="aei-contact__row">' +
      '<div class="aei-contact__field"><label for="aei-prenom">Prénom <span class="req">*</span></label>' +
      '<input id="aei-prenom" name="prenom" type="text" required maxlength="80" autocomplete="given-name"></div>' +
      '<div class="aei-contact__field"><label for="aei-nom">Nom <span class="req">*</span></label>' +
      '<input id="aei-nom" name="nom" type="text" required maxlength="80" autocomplete="family-name"></div>' +
      "</div>" +
      '<div class="aei-contact__row">' +
      '<div class="aei-contact__field"><label for="aei-tel">Téléphone <span class="req">*</span></label>' +
      '<input id="aei-tel" name="telephone" type="tel" required autocomplete="tel" placeholder="06 12 34 56 78"></div>' +
      '<div class="aei-contact__field"><label for="aei-mail">E-mail</label>' +
      '<input id="aei-mail" name="email" type="email" autocomplete="email"></div>' +
      "</div>" +
      '<div class="aei-contact__field"><label for="aei-type">Type de formation</label>' +
      '<select id="aei-type" name="typeFormation">' + options(FORMATIONS) + "</select></div>" +
      '<div class="aei-contact__field"><label for="aei-creneau">Quand vous rappeler ?</label>' +
      '<select id="aei-creneau" name="creneau">' +
      '<option value="Peu importe">Peu importe</option>' +
      '<option value="Matin (9h-12h)">Matin (9h-12h)</option>' +
      '<option value="Après-midi (12h-17h)">Après-midi (12h-17h)</option>' +
      '<option value="Fin de journée (17h-19h)">Fin de journée (17h-19h)</option>' +
      "</select></div>" +
      '<div class="aei-contact__field"><label for="aei-provenance">Comment nous avez-vous connu ?</label>' +
      '<select id="aei-provenance" name="provenance">' + options(PROVENANCES) + "</select></div>" +
      '<div class="aei-contact__field"><label for="aei-msg">Votre projet (facultatif)</label>' +
      '<textarea id="aei-msg" name="message" maxlength="1000" placeholder="Une question, une précision, la formation qui vous intéresse…"></textarea></div>' +
      '<div class="aei-contact__hp"><label for="aei-website">Ne pas remplir</label>' +
      '<input id="aei-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<button class="aei-contact__submit" type="submit">Demander à être rappelé</button>' +
      '<p class="aei-contact__rgpd">Vos coordonnées sont transmises à cette auto-école dans le seul but de vous rappeler. ' +
      "Vous pouvez demander leur suppression à tout moment.</p>" +
      '<div class="aei-contact__msg" role="status" aria-live="polite"></div>' +
      "</form>" +
      "</div>" +
      "</div>";

    wireForm(wrap.querySelector("form"), phone);
    return wrap;
  }

  function wireForm(form, phone) {
    var msg = form.querySelector(".aei-contact__msg");
    var btn = form.querySelector(".aei-contact__submit");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "aei-contact__msg";

      var payload = {
        /* Le code backoffice, pas l'URL : l'API ne résout ni le domaine sans
           "www" ni le sous-domaine de staging. */
        code: code,
        prenom: form.prenom.value.trim(),
        nom: form.nom.value.trim(),
        telephone: form.telephone.value.trim(),
        email: form.email.value.trim(),
        typeFormation: form.typeFormation.value,
        creneau: form.creneau.value,
        provenance: form.provenance.value,
        message: form.message.value.trim(),
        website: form.website.value,
      };

      if (payload.prenom.length < 2) return fail("Merci d'indiquer votre prénom.");
      if (payload.nom.length < 2) return fail("Merci d'indiquer votre nom.");
      if (payload.telephone.replace(/[^0-9+]/g, "").length < 10) {
        return fail("Merci d'indiquer un numéro de téléphone valide.");
      }

      btn.disabled = true;
      btn.textContent = "Envoi en cours…";

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          return r.json().then(function (d) {
            return { ok: r.ok, data: d };
          });
        })
        .then(function (res) {
          if (!res.ok) {
            var e = new Error((res.data && res.data.error) || "L'envoi a échoué.");
            e.fromServer = true;
            throw e;
          }
          form.reset();
          msg.className = "aei-contact__msg is-ok";
          msg.textContent =
            "Votre demande est envoyée. L'auto-école vous rappelle sous 24 h ouvrées.";
          btn.textContent = "Demande envoyée";
        })
        .catch(function (err) {
          /* Seuls les messages venant du serveur sont affichés tels quels ;
             une panne réseau ne doit pas exposer de jargon au visiteur. */
          var head = err && err.fromServer && err.message ? err.message : "L'envoi a échoué.";
          var tail = phone ? " Appelez-nous directement au " + prettyPhone(phone) + "." : "";
          fail(head + tail);
          btn.disabled = false;
          btn.textContent = "Demander à être rappelé";
        });

      function fail(text) {
        msg.className = "aei-contact__msg is-ko";
        msg.textContent = text;
      }
    });
  }

  /* ---------- 5. Insertion : note au-dessus du catalogue, contact en dessous ---------- */

  function mountNote() {
    if (document.getElementById("aei-agence-note")) return;
    var titre = document.getElementById("title-agence");
    if (!titre || !titre.parentNode) return;
    var note = document.createElement("div");
    note.id = "aei-agence-note";
    note.className = "aei-agence-note";
    note.innerHTML =
      "Ces formations se réservent <strong>directement auprès de l'auto-école</strong>. " +
      "Consultez les tarifs ci-dessous, puis appelez-la ou demandez à être rappelé.";
    titre.parentNode.insertBefore(note, titre.nextSibling);
  }

  function mountContact(phone, agencyName) {
    if (document.getElementById("aei-contact")) return;
    var anchor = document.getElementById("traineeshipContainer");
    if (!anchor || !anchor.parentNode) return;
    anchor.parentNode.insertBefore(build(phone, agencyName), anchor.nextSibling);
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function apply(phone, agencyName) {
    injectCss();
    markAgency();
    mountNote();
    mountContact(phone, agencyName);
    wireStageButtons();
    watchCards();
  }

  if (known) {
    ready(function () {
      apply(AGENCIES[slug], null);
    });
  }

  /* Filet : une agence créée après ce script est rattrapée via le backoffice. */
  ready(function () {
    fetch(BOOKING_API + "/api/agencies/get?code=" + encodeURIComponent(code))
      .then(function (r) {
        return r.ok ? r.text() : "";
      })
      .then(function (t) {
        if (!t || !t.trim()) return;
        var rec;
        try {
          rec = JSON.parse(t);
        } catch (e) {
          return;
        }
        if (!rec || rec.type !== "agency" || rec.code === MELUN) return;
        apply(rec.phone || rec.mobile || "", rec.name || "");
        var el = document.getElementById("aei-contact");
        var h2 = el && el.querySelector(".aei-contact__head h2");
        if (h2 && rec.name) h2.textContent = "Contactez " + rec.name;
      })
      .catch(function () {});
  });
})();
