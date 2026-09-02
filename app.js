(function () {
  "use strict";

  var S = {
    tools: [],
    systems: [],
    skills: [],
    skillsGuide: null,
    byId: {},
    q: "",
    cat: "Todas",
    layer: "Todas",
    sort: "use",
    view: "tools",
    sysCompany: "Todas",
    toolCompany: "Todas",
    matrixMode: "cards",
    palIdx: 0,
    palRows: [],
    statsAnimated: false
  };

  var PROJ2SYS = {
    "portal-supertrans": "portal-supertrans",
    "nucleo-portais": "nucleo-portais",
    "app-almoxarifado": "app-almoxarifado",
    "Portal_Fornecedor": "portal-fornecedor",
    "Portal-Aurora": "portal-aurora",
    "superfood": "superfood",
    "supertrans-app": "supertrans-app"
  };

  var PLAT = {
    "web": { label: "Web", icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9S9.5 5.6 12 3Z"/></svg>' },
    "mobile": { label: "Mobile", icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18.5h2"/></svg>' },
    "web-mobile": { label: "Web + Mobile", icon: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="13" y="8" width="8" height="13" rx="1.5"/><path d="M11 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h6M2 19h9"/></svg>' }
  };

  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  function norm(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function initials(n) {
    var w = n.replace(/[^\w\s.+-]/g, "").split(/[\s.]+/).filter(Boolean);
    return ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toUpperCase();
  }

  function copyToClipboard(url, btn) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(function () {
      var orig = btn.innerHTML;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> <span>Copiado!</span>';
      btn.classList.add("copied");
      setTimeout(function () {
        btn.innerHTML = orig;
        btn.classList.remove("copied");
      }, 1800);
    });
  }

  // Deterministic hue per tool so fallback monograms look intentional, not gray.
  function hue(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  function mountLogo(el, tool, px) {
    if (tool.logo) {
      var img = new Image();
      img.src = tool.logo;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = function () { fallback(); };
      el.appendChild(img);
    } else { fallback(); }

    function fallback() {
      var h = hue(tool.name);
      el.innerHTML = '<span class="mono" style="color:hsl(' + h + ' 55% 62%)">' + esc(initials(tool.name)) + "</span>";
      el.style.background = "hsl(" + h + " 42% 50% / .13)";
      el.style.borderColor = "hsl(" + h + " 42% 55% / .22)";
    }
  }

  // Maps layer name to its CSS custom property value
  var LAYER_COLORS = {
    "Frontend":                 "var(--layer-frontend)",
    "Backend":                  "var(--layer-backend)",
    "Mobile":                   "var(--layer-mobile)",
    "Database":                 "var(--layer-database)",
    "DevOps & Infra":           "var(--layer-devops)",
    "Observabilidade":          "var(--layer-obs)",
    "Autenticação & Segurança": "var(--layer-auth)",
    "Testes & QA":              "var(--layer-qa)",
    "Utilitários":              "var(--layer-utils)",
    "Inteligência Artificial":  "var(--layer-ai)"
  };

  function layerCSSVar(layer) {
    return LAYER_COLORS[layer] || "var(--text-faint)";
  }

  /* ---------------- data ---------------- */

  Promise.all([
    fetch("tools.json").then(function (r) { return r.json(); }),
    fetch("systems.json").then(function (r) { return r.json(); }),
    fetch("orion-skills.json").then(function (r) { return r.json(); }),
    fetch("orion-skills-guide.json").then(function (r) { return r.json(); })
  ]).then(function (r) {
    S.tools = r[0];
    S.systems = r[1];
    S.skills = r[2];
    S.skillsGuide = r[3];
    S.tools.forEach(function (t) { S.byId[t.id] = t; });
    S.sysIds = S.systems.map(function (s) { return s.id; });

    // precompute: which systems each tool belongs to
    S.tools.forEach(function (t) {
      t._sys = (t.projects || []).map(function (p) { return PROJ2SYS[p]; }).filter(Boolean);
    });

    buildStats();
    buildRail();
    buildLayerPills();
renderTools();
    renderSystems();
    renderMatrix();
    renderSkills();
    renderSkillsGuide();
    buildStackHealth();
    bind();
    route(true);
  }).catch(function (e) {
    document.getElementById("grid").innerHTML =
      '<div class="empty"><h3>Erro ao carregar</h3><p>Não foi possível ler os dados do catálogo.</p></div>';
    console.error(e);
  });

  /* ---------------- stats ---------------- */

  function buildStats() {
    var cats = {}, cos = {};
    S.tools.forEach(function (t) { cats[t.category] = 1; });
    S.systems.forEach(function (s) { cos[s.company] = 1; });
    var data = [
      [S.tools.length, "Ferramentas"],
      [S.systems.length, "Sistemas"],
      [Object.keys(cats).length, "Categorias"],
      [Object.keys(cos).length, "Empresas"]
    ];
    document.getElementById("stats").innerHTML = data.map(function (d) {
      return '<div><div class="stat-n">' + d[0] + '</div><div class="stat-l">' + d[1] + "</div></div>";
    }).join("");
    document.getElementById("ftrCount").textContent =
      S.tools.length + " ferramentas · " + S.systems.length + " sistemas";

    // Animate stats counters on first view
    setTimeout(animateStats, 150);
  }

  /* ---------------- rail ---------------- */

  function catCounts() {
    var c = {};
    S.tools.forEach(function (t) { c[t.category] = (c[t.category] || 0) + 1; });
    return c;
  }

  function buildRail() {
    var counts = catCounts();
    var cats = Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a] || a.localeCompare(b, "pt");
    });
    var list = [["Todas", S.tools.length]].concat(cats.map(function (c) { return [c, counts[c]]; }));

    var rail = document.getElementById("rail");
    var railM = document.getElementById("railM");
    rail.innerHTML = "";
    railM.innerHTML = "";

    list.forEach(function (pair) {
      var name = pair[0], n = pair[1];

      var b = document.createElement("button");
      b.className = "rail-item";
      b.setAttribute("aria-pressed", String(S.cat === name));
      b.innerHTML = "<span>" + esc(name) + '</span><span class="rail-n">' + n + "</span>";
      b.onclick = function () { S.cat = name; syncRail(); renderTools(); };
      rail.appendChild(b);

      var m = document.createElement("button");
      m.setAttribute("aria-pressed", String(S.cat === name));
      m.textContent = name;
      m.onclick = function () { S.cat = name; syncRail(); renderTools(); };
      railM.appendChild(m);
    });
  }

  function syncRail() {
    [["rail", ".rail-item"], ["railM", "button"]].forEach(function (p) {
      var root = document.getElementById(p[0]);
      Array.prototype.forEach.call(root.querySelectorAll(p[1]), function (el) {
        var label = el.querySelector("span") ? el.querySelector("span").textContent : el.textContent;
        el.setAttribute("aria-pressed", String(label === S.cat));
      });
    });
  }

  /* ---------------- tools ---------------- */

  function filtered() {
    var q = norm(S.q.trim());
    var out = S.tools.filter(function (t) {
      if (S.cat !== "Todas" && t.category !== S.cat) return false;
      if (S.layer !== "Todas" && t.layer !== S.layer) return false;
      if (S.toolCompany && S.toolCompany !== "Todas") {
        var inCompany = (t._sys || []).some(function (sysId) {
          var sysObj = S.systems.find(function (s) { return s.id === sysId; });
          return sysObj && sysObj.company === S.toolCompany;
        });
        if (!inCompany) return false;
      }
      if (!q) return true;
      var haystack = norm(t.name + " " + t.category + " " + (t.layer || "") + " " + t.description + " " + t.usage + " " +
        (t.projects || []).join(" ") + " " + (t.tags || []).join(" "));
      return haystack.indexOf(q) !== -1;
    });
    out.sort(function (a, b) {
      if (S.sort === "az") return a.name.localeCompare(b.name, "pt");
      return (b.projects || []).length - (a.projects || []).length ||
        a.name.localeCompare(b.name, "pt");
    });
    return out;
  }

  function renderTools() {
    var list = filtered();
    var grid = document.getElementById("grid");
    var meta = document.getElementById("meta");

    meta.innerHTML = "<b>" + list.length + "</b> " +
      (list.length === 1 ? "ferramenta" : "ferramentas") +
      (S.cat !== "Todas" ? " em " + esc(S.cat) : "") +
      (S.q ? ' para "' + esc(S.q) + '"' : "");

    grid.innerHTML = "";

    if (!list.length) {
      grid.innerHTML =
        '<div class="empty">' +
          '<div class="empty-i"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></div>' +
          "<h3>Nada encontrado</h3>" +
          "<p>Nenhuma ferramenta corresponde a esses filtros.</p>" +
          '<button class="btn-ghost" id="resetBtn">Limpar filtros</button>' +
        "</div>";
      document.getElementById("resetBtn").onclick = function () {
        S.q = ""; S.cat = "Todas";
        document.getElementById("q").value = "";
        document.getElementById("field").classList.remove("has-val");
        syncRail(); renderTools();
      };
      return;
    }

    var frag = document.createDocumentFragment();
    list.forEach(function (t, i) {
      frag.appendChild(toolCard(t, i));
    });
    grid.appendChild(frag);
  }

  function toolCard(t, i) {
    var el = document.createElement("button");
    el.className = "t-card";
    el.style.animationDelay = Math.min(i * 11, 260) + "ms";

    var n = (t.projects || []).length;
    var layerColor = layerCSSVar(t.layer);
    var layerBadge = t.layer
      ? '<span class="t-layer-badge" style="--layer-color:' + layerColor + '">' + esc(t.layer) + '</span>'
      : '';

    el.innerHTML =
      '<div class="t-head">' +
        '<span class="t-logo" data-logo></span>' +
        '<span class="t-title">' +
          '<span class="t-name">' + esc(t.name) + "</span>" +
          '<span class="t-cat">' + esc(t.category) + "</span>" +
        "</span>" +
      "</div>" +
      '<p class="t-desc">' + esc(t.description) + "</p>" +
      '<div class="t-foot">' +
        '<span class="t-use"><b>' + n + "</b> " + (n === 1 ? "sistema" : "sistemas") + "</span>" +
        layerBadge +
        '<span class="pips">' + pips(t) + "</span>" +
      "</div>";

    mountLogo(el.querySelector("[data-logo]"), t);
    el.onclick = function () { openTool(t); };
    return el;
  }

  // one dot per system in the group; filled = this tool is used there
  function pips(t) {
    return S.systems.map(function (s) {
      var on = t._sys.indexOf(s.id) !== -1;
      var label = esc(s.name + (on ? " (utiliza)" : " (não utiliza)"));
      return '<span class="pip' + (on ? " on" : "") + '" data-tip="' + label + '"></span>';
    }).join("");
  }

  /* ---------------- systems ---------------- */

  function renderSystems() {
    var host = document.getElementById("sys");
    var filters = document.getElementById("sysFilters");
    host.innerHTML = "";

    var groups = [], map = {};
    S.systems.forEach(function (s) {
      if (!map[s.company]) {
        map[s.company] = { name: s.company, color: s.companyColor, items: [] };
        groups.push(map[s.company]);
      }
      map[s.company].items.push(s);
    });

    if (filters) {
      filters.innerHTML = "";
      var allBtn = document.createElement("button");
      allBtn.className = "sys-filter-btn";
      allBtn.setAttribute("aria-pressed", String(S.sysCompany === "Todas"));
      allBtn.innerHTML = '<span>Todas as Empresas</span> <span class="rail-n">(' + S.systems.length + ')</span>';
      allBtn.onclick = function () {
        S.sysCompany = "Todas";
        renderSystems();
      };
      filters.appendChild(allBtn);

      groups.forEach(function (g) {
        var b = document.createElement("button");
        b.className = "sys-filter-btn";
        b.setAttribute("aria-pressed", String(S.sysCompany === g.name));
        b.innerHTML = '<span class="dot" style="background:' + esc(g.color) + '"></span>' +
          '<span>' + esc(g.name) + '</span> <span class="rail-n">(' + g.items.length + ')</span>';
        b.onclick = function () {
          S.sysCompany = g.name;
          renderSystems();
        };
        filters.appendChild(b);
      });
    }

    var visibleGroups = S.sysCompany === "Todas" ? groups : groups.filter(function (g) { return g.name === S.sysCompany; });

    visibleGroups.forEach(function (g) {
      var sec = document.createElement("section");
      sec.className = "co";
      sec.innerHTML =
        '<div class="co-h">' +
          '<span class="co-dot" style="background:' + esc(g.color) + '"></span>' +
          "<h2>" + esc(g.name) + "</h2>" +
          '<span class="co-n">' + g.items.length + (g.items.length === 1 ? " sistema" : " sistemas") + "</span>" +
        "</div>" +
        '<div class="sys-grid"></div>';
      var grid = sec.querySelector(".sys-grid");
      g.items.forEach(function (s) { grid.appendChild(sysCard(s)); });
      host.appendChild(sec);
    });
  }

  function sysCard(s) {
    var card = document.createElement("article");
    card.className = "s-card";
    card.id = "sys-" + s.id;

    var wip = /desenvolvimento/i.test(s.status);
    var stack = (s.toolIds || []).map(function (id) { return S.byId[id]; }).filter(Boolean);
    var head = stack.slice(0, 9);
    var rest = stack.length - head.length;
    var plat = PLAT[s.platform];

    card.innerHTML =
      '<button class="s-top" aria-expanded="false">' +
        "<span>" +
          '<span class="s-name">' + esc(s.name) + "</span>" +
          '<span class="s-meta">' +
            '<span class="tag ' + (wip ? "wip" : "live") + '">' + esc(wip ? "Em desenvolvimento" : "Em produção") + "</span>" +
            (plat ? '<span class="tag plat">' + plat.icon + plat.label + "</span>" : "") +
            '<button class="share-btn" data-sys-share aria-label="Copiar link"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Link</span></button>' +
          "</span>" +
        "</span>" +
        '<span class="s-chev"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></span>' +
      "</button>" +
      '<div class="s-body">' +
        '<p class="s-obj">' + esc(s.objective) + "</p>" +
        '<div class="icons" data-icons></div>' +
        '<div class="s-detail">' +
          "<div><p class=\"lbl\">Arquitetura</p><p>" + esc(s.architecture) + "</p></div>" +
          '<div><p class="lbl">Destaques</p><ul class="hl">' +
            (s.stackHighlights || []).map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") +
          "</ul></div>" +
          '<div><p class="lbl">Stack completa · ' + stack.length + '</p><div class="chips" data-chips></div></div>' +
          '<div class="repo">' + esc(s.repoPath) + "</div>" +
        "</div>" +
      "</div>";

    var sysShare = card.querySelector("[data-sys-share]");
    if (sysShare) {
      sysShare.onclick = function (e) {
        e.stopPropagation();
        var url = location.origin + location.pathname + "#system/" + s.id;
        copyToClipboard(url, sysShare);
      };
    }

    var icons = card.querySelector("[data-icons]");
    head.forEach(function (t) {
      var b = document.createElement("button");
      b.className = "ic";
      b.title = t.name;
      mountLogo(b, t);
      b.onclick = function (e) { e.stopPropagation(); jumpToTool(t); };
      icons.appendChild(b);
    });
    if (rest > 0) {
      var more = document.createElement("span");
      more.className = "ic-more";
      more.textContent = "+" + rest;
      icons.appendChild(more);
    }

    var chips = card.querySelector("[data-chips]");
    stack.forEach(function (t) {
      var c = document.createElement("button");
      c.className = "chip";
      var ico = document.createElement("span");
      mountLogo(ico, t);
      // chip logos render bare (no tile), so strip the tile classes
      if (ico.firstChild && ico.firstChild.tagName === "IMG") c.appendChild(ico.firstChild);
      else c.innerHTML = '<span class="mono">' + esc(initials(t.name)) + "</span>";
      var lb = document.createElement("span");
      lb.textContent = t.name;
      c.appendChild(lb);
      c.onclick = function (e) { e.stopPropagation(); jumpToTool(t); };
      chips.appendChild(c);
    });

    var top = card.querySelector(".s-top");
    top.onclick = function () {
      var open = card.classList.toggle("open");
      top.setAttribute("aria-expanded", String(open));
    };

    return card;
  }

  /* ---------------- exports ---------------- */

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function exportMarkdown() {
    var md = [];
    md.push("# Catálogo de Tecnologias — Grupo Orion");
    md.push("");
    md.push("> Exportado automaticamente pelo catálogo Toolstack em " + new Date().toLocaleDateString("pt-BR") + ".");
    md.push("");
    md.push("## Visão Geral");
    md.push("- **Total de Ferramentas:** " + S.tools.length);
    md.push("- **Total de Sistemas:** " + S.systems.length);
    md.push("");
    md.push("## Sistemas do Grupo");
    md.push("");
    S.systems.forEach(function (s) {
      md.push("### " + s.name + " (" + s.company + ")");
      md.push("- **Status:** " + s.status);
      md.push("- **Plataforma:** " + (PLAT[s.platform] ? PLAT[s.platform].label : s.platform));
      md.push("- **Repositório:** `" + s.repoPath + "`");
      md.push("- **Objetivo:** " + s.objective);
      md.push("- **Arquitetura:** " + s.architecture);
      if (s.stackHighlights && s.stackHighlights.length) {
        md.push("- **Destaques da Stack:**");
        s.stackHighlights.forEach(function (h) { md.push("  - " + h); });
      }
      md.push("");
    });
    md.push("## Matriz de Ferramentas por Categoria");
    md.push("");
    var catMap = {};
    S.tools.forEach(function (t) {
      if (!catMap[t.category]) catMap[t.category] = [];
      catMap[t.category].push(t);
    });
    Object.keys(catMap).sort().forEach(function (cat) {
      md.push("### " + cat);
      md.push("| Ferramenta | Descrição | Onde é Usada |");
      md.push("| :--- | :--- | :--- |");
      catMap[cat].forEach(function (t) {
        var projs = (t.projects || []).join(", ") || "—";
        md.push("| [" + t.name + "](" + (t.link || "#") + ") | " + t.description.replace(/\|/g, "\\|") + " | " + projs + " |");
      });
      md.push("");
    });
    downloadFile("catalogo-tecnologias-orion.md", md.join("\n"), "text/markdown;charset=utf-8");
  }

  function exportJSON() {
    var data = {
      exportedAt: new Date().toISOString(),
      toolsCount: S.tools.length,
      systemsCount: S.systems.length,
      systems: S.systems,
      tools: S.tools
    };
    downloadFile("catalogo-tecnologias-orion.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  }

  /* ---------------- matrix ---------------- */

  function buildMatrixInsights() {
    var host = document.getElementById("matrixInsights");
    if (!host) return;

    var coreTools = S.tools.filter(function (t) { return (t.projects || []).length >= 4; });
    var sharedTools = S.tools.filter(function (t) { var n = (t.projects || []).length; return n >= 2 && n <= 3; });
    var nicheTools = S.tools.filter(function (t) { return (t.projects || []).length === 1; });
    var stdRate = Math.round(((coreTools.length + sharedTools.length) / S.tools.length) * 100);

    host.innerHTML =
      '<div class="m-insight-card">' +
        '<div class="m-insight-title">Tecnologias Padrão (Core)</div>' +
        '<div class="m-insight-val">' + coreTools.length + '</div>' +
        '<div class="m-insight-desc">Usadas em 4+ projetos (ex: ' + coreTools.slice(0, 3).map(function(t){ return t.name; }).join(", ") + ').</div>' +
      '</div>' +
      '<div class="m-insight-card">' +
        '<div class="m-insight-title">Tecnologias Compartilhadas</div>' +
        '<div class="m-insight-val">' + sharedTools.length + '</div>' +
        '<div class="m-insight-desc">Adotadas por 2 a 3 projetos em comum.</div>' +
      '</div>' +
      '<div class="m-insight-card">' +
        '<div class="m-insight-title">Tecnologias de Nicho</div>' +
        '<div class="m-insight-val">' + nicheTools.length + '</div>' +
        '<div class="m-insight-desc">Específicas de um único produto ou contexto.</div>' +
      '</div>' +
      '<div class="m-insight-card">' +
        '<div class="m-insight-title">Taxa de Reuso de Stack</div>' +
        '<div class="m-insight-val">' + stdRate + '%</div>' +
        '<div class="m-insight-desc">Proporção de ferramentas reutilizadas entre times.</div>' +
      '</div>';
  }

  function filterMatrix(q) {
    var nq = norm(q.trim());

    // Filter Cards Mode
    renderMatrixCards();

    // Filter Table Mode
    var table = document.querySelector(".m-table");
    if (table) {
      var rows = table.querySelectorAll("tbody tr");
      var visibleRowCount = 0;

      rows.forEach(function (row) {
        var chips = row.querySelectorAll(".m-chip");
        var catEl = row.querySelector(".td-cat-name") || row.querySelector(".td-cat");
        var catName = catEl ? catEl.textContent : "";
        var catMatches = nq && norm(catName).indexOf(nq) !== -1;
        var rowHasMatch = false;

        chips.forEach(function (chip) {
          var nameEl = chip.querySelector(".m-chip-name");
          var name = nameEl ? nameEl.textContent : chip.textContent;
          var match = nq && (catMatches || norm(name).indexOf(nq) !== -1);
          if (match) {
            chip.classList.add("highlight");
            chip.classList.remove("dim");
            rowHasMatch = true;
          } else if (nq) {
            chip.classList.remove("highlight");
            chip.classList.add("dim");
          } else {
            chip.classList.remove("highlight");
            chip.classList.remove("dim");
          }
        });

        if (!nq || catMatches || rowHasMatch) {
          row.classList.remove("m-row-hidden");
          visibleRowCount++;
        } else {
          row.classList.add("m-row-hidden");
        }
      });
    }
  }

  function setMatrixMode(mode) {
    S.matrixMode = mode;
    var cardsGrid = document.getElementById("matrixCardsGrid");
    var compWrap  = document.getElementById("matrixCompareWrap");
    var tableWrap = document.getElementById("matrixWrap");
    var graphWrap = document.getElementById("matrixGraphWrap");

    if (cardsGrid) cardsGrid.style.display = mode === "cards"   ? "grid"  : "none";
    if (compWrap)  compWrap.style.display  = mode === "compare" ? "flex"  : "none";
    if (tableWrap) tableWrap.style.display = mode === "table"   ? "block" : "none";
    if (graphWrap) graphWrap.style.display = mode === "graph"   ? "flex"  : "none";

    Array.prototype.forEach.call(document.querySelectorAll("#matrixViewSwitch button"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.mview === mode));
    });

    if (mode === "cards")   renderMatrixCards();
    else if (mode === "compare") renderMatrixCompare();
    else if (mode === "graph") {
      // Lazy init — only build if the SVG is empty
      var svgEl = document.getElementById("graphSvg");
      if (svgEl && !svgEl.childNodes.length) buildNetworkGraph();
    }
  }

  function renderMatrixCards() {
    var host = document.getElementById("matrixCardsGrid");
    if (!host) return;
    host.innerHTML = "";

    var mqInput = document.getElementById("matrixQ");
    var q = norm((mqInput ? mqInput.value : "").trim());

    var catMap = {};
    S.tools.forEach(function (t) {
      if (!catMap[t.category]) catMap[t.category] = [];
      catMap[t.category].push(t);
    });

    var sortedCats = Object.keys(catMap).sort(function (a, b) {
      return catMap[b].length - catMap[a].length || a.localeCompare(b, "pt");
    });

    var totalRendered = 0;

    sortedCats.forEach(function (cat) {
      var tools = catMap[cat].filter(function (t) {
        if (!q) return true;
        return norm(t.name + " " + cat + " " + (t.projects || []).join(" ")).indexOf(q) !== -1;
      });

      if (!tools.length) return;

      tools.sort(function (a, b) {
        return (b.projects || []).length - (a.projects || []).length || a.name.localeCompare(b.name, "pt");
      });

      var card = document.createElement("div");
      card.className = "m-card";
      card.innerHTML =
        '<div class="m-card-h">' +
          '<span class="m-card-title">' + esc(cat) + '</span>' +
          '<span class="m-card-count">' + tools.length + (tools.length === 1 ? ' tecnologia' : ' tecnologias') + '</span>' +
        '</div>' +
        '<div class="m-card-list"></div>';

      var list = card.querySelector(".m-card-list");
      tools.forEach(function (t) {
        var item = document.createElement("div");
        item.className = "m-card-item";

        var sysCount = (t._sys || []).length;
        var usageLabel = sysCount === 0 ? "Geral" : sysCount === 1 ? "1 sistema" : sysCount + " sistemas";

        item.innerHTML =
          '<div class="m-item-top">' +
            '<button class="m-item-tool" type="button">' +
              '<span data-logo></span>' +
              '<span>' + esc(t.name) + '</span>' +
            '</button>' +
            '<span class="m-item-usage">' + usageLabel + '</span>' +
          '</div>' +
          '<div class="m-item-sys-badges"></div>';

        mountLogo(item.querySelector("[data-logo]"), t);
        item.querySelector(".m-item-tool").onclick = function () { openTool(t); };

        var badgesHost = item.querySelector(".m-item-sys-badges");
        (t._sys || []).forEach(function (sysId) {
          var sys = S.systems.find(function (s) { return s.id === sysId; });
          if (!sys) return;
          var badge = document.createElement("button");
          badge.className = "m-sys-badge";
          badge.type = "button";
          badge.innerHTML = '<span class="dot" style="background:' + esc(sys.companyColor || "#888") + '"></span>' +
            '<span>' + esc(sys.name) + '</span>';
          badge.onclick = function (e) {
            e.stopPropagation();
            jumpToSystem(sys.id);
          };
          badgesHost.appendChild(badge);
        });

        list.appendChild(item);
      });

      host.appendChild(card);
      totalRendered++;
    });

    if (totalRendered === 0 && q) {
      host.innerHTML =
        '<div class="empty">' +
          '<div class="empty-i"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></div>' +
          '<h3>Nenhuma tecnologia encontrada na matriz</h3>' +
          '<p>Nenhum item corresponde a "' + esc(q) + '".</p>' +
          '<button class="btn-ghost" id="mCardsReset">Limpar busca</button>' +
        '</div>';
      var rBtn = host.querySelector("#mCardsReset");
      if (rBtn) {
        rBtn.onclick = function () {
          var mq = document.getElementById("matrixQ");
          if (mq) {
            mq.value = "";
            var mqField = document.getElementById("matrixField");
            if (mqField) mqField.classList.remove("has-val");
            filterMatrix("");
            mq.focus();
          }
        };
      }
    }
  }

  function renderMatrixCompare() {
    var selA = document.getElementById("compSysA");
    var selB = document.getElementById("compSysB");
    var res = document.getElementById("compareResults");
    if (!selA || !selB || !res) return;

    if (selA.options.length === 0) {
      S.systems.forEach(function (s) {
        selA.add(new Option(s.name + " (" + s.company + ")", s.id));
        selB.add(new Option(s.name + " (" + s.company + ")", s.id));
      });
      selA.selectedIndex = 0;
      selB.selectedIndex = Math.min(1, S.systems.length - 1);

      selA.onchange = renderMatrixCompare;
      selB.onchange = renderMatrixCompare;
    }

    var sysA = S.systems.find(function (s) { return s.id === selA.value; }) || S.systems[0];
    var sysB = S.systems.find(function (s) { return s.id === selB.value; }) || S.systems[1];

    if (!sysA || !sysB) return;

    var toolsA = (sysA.toolIds || []).map(function (id) { return S.byId[id]; }).filter(Boolean);
    var toolsB = (sysB.toolIds || []).map(function (id) { return S.byId[id]; }).filter(Boolean);

    var mapB = {};
    toolsB.forEach(function (t) { mapB[t.id] = true; });
    var mapA = {};
    toolsA.forEach(function (t) { mapA[t.id] = true; });

    var common = toolsA.filter(function (t) { return mapB[t.id]; });
    var onlyA = toolsA.filter(function (t) { return !mapB[t.id]; });
    var onlyB = toolsB.filter(function (t) { return !mapA[t.id]; });

    res.innerHTML = "";

    function makeCol(title, count, badgeColor, list) {
      var col = document.createElement("div");
      col.className = "compare-col";
      col.innerHTML =
        '<div class="compare-col-h">' +
          '<span class="compare-col-title">' +
            (badgeColor ? '<span class="dot" style="background:' + badgeColor + '"></span>' : '🤝 ') +
            esc(title) +
          '</span>' +
          '<span class="compare-col-count">' + count + (count === 1 ? ' item' : ' itens') + '</span>' +
        '</div>' +
        '<div class="chips"></div>';
      var ch = col.querySelector(".chips");
      list.forEach(function (t) {
        var c = document.createElement("button");
        c.className = "chip";
        var ico = document.createElement("span");
        mountLogo(ico, t);
        if (ico.firstChild && ico.firstChild.tagName === "IMG") c.appendChild(ico.firstChild);
        else c.innerHTML = '<span class="mono">' + esc(initials(t.name)) + '</span>';
        var nameSpan = document.createElement("span");
        nameSpan.textContent = t.name;
        c.appendChild(nameSpan);
        c.onclick = function () { openTool(t); };
        ch.appendChild(c);
      });
      return col;
    }

    res.appendChild(makeCol("Em Comum (" + common.length + ")", common.length, "", common));
    res.appendChild(makeCol("Exclusivas de " + sysA.name, onlyA.length, sysA.companyColor, onlyA));
    res.appendChild(makeCol("Exclusivas de " + sysB.name, onlyB.length, sysB.companyColor, onlyB));
  }

  function renderMatrix() {
    buildMatrixInsights();
    renderMatrixCards();
    renderMatrixCompare();

    var wrap = document.getElementById("matrixWrap");
    if (!wrap) return;
    wrap.innerHTML = "";

    var catMap = {};
    S.tools.forEach(function (t) {
      catMap[t.category] = (catMap[t.category] || 0) + 1;
    });

    var sortedCats = Object.keys(catMap).sort(function (a, b) {
      return catMap[b] - catMap[a] || a.localeCompare(b, "pt");
    });

    var table = document.createElement("table");
    table.className = "m-table";

    var thead = document.createElement("thead");
    var trHead = document.createElement("tr");
    var thCat = document.createElement("th");
    thCat.className = "th-cat";
    thCat.innerHTML =
      '<div class="th-cat-content">' +
        '<span class="th-cat-title">CATEGORIA</span>' +
        '<span class="th-cat-sub">' + sortedCats.length + ' grupos</span>' +
      '</div>';
    trHead.appendChild(thCat);

    S.systems.forEach(function (s) {
      var th = document.createElement("th");
      th.className = "th-sys";
      var platObj = PLAT[s.platform] || { label: s.platform || "Web", icon: "" };
      var techCount = (s.toolIds || []).length;

      th.innerHTML =
        '<div class="th-sys-card" role="button" tabindex="0" title="Ver sistema ' + esc(s.name) + '">' +
          '<div class="th-sys-top">' +
            '<span class="th-sys-co">' +
              '<span class="dot" style="background:' + esc(s.companyColor || "var(--accent)") + '"></span>' +
              esc(s.company) +
            '</span>' +
            '<span class="th-sys-plat">' + platObj.icon + '<span>' + esc(platObj.label) + '</span></span>' +
          '</div>' +
          '<div class="th-sys-name">' + esc(s.name) + '</div>' +
          '<div class="th-sys-meta">' +
            '<span class="th-sys-count"><b>' + techCount + '</b> techs</span>' +
            '<span class="th-sys-action">Ver sistema →</span>' +
          '</div>' +
        '</div>';

      var linkEl = th.querySelector(".th-sys-card");
      linkEl.onclick = function () { jumpToSystem(s.id); };
      linkEl.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          jumpToSystem(s.id);
        }
      };
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    sortedCats.forEach(function (cat) {
      var tr = document.createElement("tr");
      tr.className = "m-tr";
      var tdCat = document.createElement("td");
      tdCat.className = "td-cat";

      var catCount = catMap[cat] || 0;
      tdCat.innerHTML =
        '<div class="td-cat-wrap">' +
          '<span class="td-cat-name">' + esc(cat) + '</span>' +
          '<span class="td-cat-count">' + catCount + (catCount === 1 ? ' tecnologia' : ' tecnologias') + '</span>' +
        '</div>';
      tr.appendChild(tdCat);

      S.systems.forEach(function (s) {
        var td = document.createElement("td");
        td.className = "td-sys";
        var sysTools = (s.toolIds || [])
          .map(function (id) { return S.byId[id]; })
          .filter(function (t) { return t && t.category === cat; });

        if (sysTools.length === 0) {
          td.innerHTML = '<div class="m-empty-cell"><span class="m-empty-dash" title="Nenhuma tecnologia desta categoria adotada neste sistema">—</span></div>';
        } else {
          var chipBox = document.createElement("div");
          chipBox.className = "m-chips";
          sysTools.forEach(function (t) {
            var chip = document.createElement("button");
            chip.className = "m-chip";
            chip.type = "button";
            chip.title = t.name + " (" + t.category + ") — Clique para ver detalhes";

            var logoSpan = document.createElement("span");
            logoSpan.className = "m-chip-logo";
            logoSpan.setAttribute("data-logo", "");
            mountLogo(logoSpan, t);
            chip.appendChild(logoSpan);

            var nameSpan = document.createElement("span");
            nameSpan.className = "m-chip-name";
            nameSpan.textContent = t.name;
            chip.appendChild(nameSpan);

            chip.onclick = function (e) {
              e.stopPropagation();
              openTool(t);
            };
            chipBox.appendChild(chip);
          });
          td.appendChild(chipBox);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    setMatrixMode(S.matrixMode || "cards");
  }

  /* ---------------- Orion Agent Skills ---------------- */

  var SKILL_CATEGORY_LABELS = {
    "backend": "Back-end",
    "design-system-orion": "Design System Orion",
    "frontend": "Front-end",
    "mobile": "Mobile",
    "orion": "Auditoria Orion",
    "platform": "Plataforma"
  };

  function renderSkills() {
    var host = document.getElementById("skillsGroups");
    var meta = document.getElementById("skillsMeta");
    var count = document.getElementById("skillsCount");
    var input = document.getElementById("skillsQ");
    if (!host || !meta || !count) return;

    var query = norm(input ? input.value.trim() : "");
    var list = S.skills.filter(function (skill) {
      return !query || norm(skill.name + " " + skill.category + " " + skill.description).indexOf(query) !== -1;
    });
    var groups = {};
    list.forEach(function (skill) {
      (groups[skill.category] = groups[skill.category] || []).push(skill);
    });

    count.textContent = S.skills.length + " skills próprias";
    meta.innerHTML = "<b>" + list.length + "</b> " + (list.length === 1 ? "skill encontrada" : "skills encontradas");
    host.innerHTML = "";

    if (!list.length) {
      host.innerHTML = '<div class="empty"><h3>Nenhuma skill encontrada</h3><p>Tente outro termo de busca.</p></div>';
      return;
    }

    Object.keys(groups).sort(function (a, b) {
      return (SKILL_CATEGORY_LABELS[a] || a).localeCompare(SKILL_CATEGORY_LABELS[b] || b, "pt");
    }).forEach(function (category) {
      var section = document.createElement("section");
      section.className = "skills-group";
      section.innerHTML = '<div class="skills-group-head"><h2>' + esc(SKILL_CATEGORY_LABELS[category] || category) + '</h2><span>' + groups[category].length + '</span></div>';

      var grid = document.createElement("div");
      grid.className = "skills-grid";
      groups[category].sort(function (a, b) { return a.name.localeCompare(b.name, "pt"); }).forEach(function (skill) {
        var card = document.createElement("article");
        card.className = "skill-card";
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", "Ver detalhes de " + skill.name);
        card.innerHTML = '<div class="skill-card-icon">✦</div><div><h3></h3><p></p></div>';
        card.querySelector("h3").textContent = skill.name;
        card.querySelector("p").textContent = skill.description;
        card.onclick = function () { openSkillDetail(skill); };
        card.onkeydown = function (event) {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSkillDetail(skill); }
        };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      host.appendChild(section);
    });
}

  function guideBlock(title, content) {
    var block = document.createElement("section");
    block.className = "guide-section";
    block.innerHTML = '<h2>' + esc(title) + '</h2>';
    block.appendChild(content);
    return block;
  }

  function renderSkillsGuide() {
    var guide = S.skillsGuide;
    var host = document.getElementById("skillsGuideContent");
    var intro = document.getElementById("skillsGuideIntro");
    if (!guide || !host) return;
    if (intro) intro.textContent = guide.intro;
    host.innerHTML = "";

    var prerequisites = document.createElement("ul");
    prerequisites.className = "guide-list";
    guide.prerequisites.forEach(function (item) {
      var li = document.createElement("li"); li.textContent = item; prerequisites.appendChild(li);
    });
    host.appendChild(guideBlock("Pré-requisitos", prerequisites));

    var install = document.createElement("div");
    install.className = "guide-callout";
    install.innerHTML = '<p>Instalação global para Claude Code e Codex</p><div class="guide-command"><code></code><button type="button" class="copy-btn">Copiar</button></div>';
    install.querySelector("code").textContent = guide.commands[0].command;
    install.querySelector(".copy-btn").onclick = function () { copyToClipboard(guide.commands[0].command, this); };
    host.appendChild(guideBlock("Instalação", install));

    var sourceGrid = document.createElement("div");
    sourceGrid.className = "guide-source-grid";
    guide.sources.forEach(function (source) {
      var card = document.createElement("article");
      card.className = "guide-source-card";
      card.innerHTML = '<h3></h3><code></code><p></p>';
      card.querySelector("h3").textContent = source.name;
      card.querySelector("code").textContent = source.repo;
      card.querySelector("p").textContent = source.description;
      sourceGrid.appendChild(card);
    });
    host.appendChild(guideBlock("Fontes instaladas", sourceGrid));

    var commands = document.createElement("div");
    commands.className = "guide-commands";
    guide.commands.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "guide-command-row";
      row.innerHTML = '<div><code></code><strong></strong><p></p></div><button type="button" class="copy-btn">Copiar</button>';
      row.querySelector("code").textContent = item.command;
      row.querySelector("strong").textContent = item.label;
      row.querySelector("p").textContent = item.description;
      row.querySelector(".copy-btn").onclick = function () { copyToClipboard(item.command, this); };
      commands.appendChild(row);
    });
    host.appendChild(guideBlock("Comandos disponíveis", commands));

    var prompts = document.createElement("div");
    prompts.className = "guide-prompts";
    guide.promptExamples.forEach(function (item) {
      var row = document.createElement("article");
      row.className = "guide-prompt";
      row.innerHTML = '<p></p><code>→ </code><strong></strong>';
      row.querySelector("p").textContent = "“" + item.prompt + "”";
      row.querySelector("strong").textContent = item.skill;
      prompts.appendChild(row);
    });
    host.appendChild(guideBlock("Como as skills são escolhidas", prompts));

    var troubleshooting = document.createElement("div");
    troubleshooting.className = "guide-faq";
    guide.troubleshooting.concat(guide.faq).forEach(function (item) {
      var row = document.createElement("article");
      row.innerHTML = '<h3></h3><p></p>';
      row.querySelector("h3").textContent = item.problem || item.question;
      row.querySelector("p").textContent = item.resolution || item.answer;
      troubleshooting.appendChild(row);
    });
    host.appendChild(guideBlock("Diagnóstico e FAQ", troubleshooting));
  }

  function openSkillDetail(skill, opts) {
    opts = opts || {};
    if (!opts.keepHash) history.replaceState(null, "", "#skill/" + encodeURIComponent(skill.name));
    var example = (S.skillsGuide && S.skillsGuide.promptExamples || []).find(function (item) { return item.skill === skill.name; });
    var sourceUrl = "https://github.com/portais-orion/orion-agent-skills/tree/main/skills/" + skill.category + "/" + skill.name;
    var m = document.getElementById("modal");
    m.innerHTML = '<div class="m-head"><span class="m-title"><h2></h2><div class="t-cat"></div></span><div class="m-actions"><button class="m-x" aria-label="Fechar">×</button></div></div>' +
      '<div class="m-body skill-detail"><p class="lbl">Descrição</p><p class="skill-detail-description"></p>' +
      (example ? '<p class="lbl">Exemplo de prompt</p><p class="skill-detail-prompt"></p>' : "") +
      '<a class="m-link" target="_blank" rel="noopener">Ver documentação da skill ↗</a></div>';
    m.querySelector("h2").textContent = skill.name;
    m.querySelector(".t-cat").textContent = SKILL_CATEGORY_LABELS[skill.category] || skill.category;
    m.querySelector(".skill-detail-description").textContent = skill.description;
    if (example) m.querySelector(".skill-detail-prompt").textContent = "“" + example.prompt + "”";
    m.querySelector(".m-link").href = sourceUrl;
    m.querySelector(".m-x").onclick = closeAll;
    open(m);
  }

  /* ---------------- navigation ---------------- */

function setView(v, opts) {
    opts = opts || {};
    S.view = v;
    document.getElementById("v-tools").classList.toggle("on", v === "tools");
    document.getElementById("v-systems").classList.toggle("on", v === "systems");
    var vMatrix = document.getElementById("v-matrix");
    if (vMatrix) vMatrix.classList.toggle("on", v === "matrix");
    var vSkills = document.getElementById("v-skills");
    if (vSkills) {
      vSkills.classList.toggle("on", v === "skills" || v === "skills-guide");
      vSkills.classList.toggle("skills-guide-open", v === "skills-guide");
    }
    var vSkillsGuide = document.getElementById("skillsGuideView");
    if (vSkillsGuide) vSkillsGuide.classList.toggle("on", v === "skills-guide");
    Array.prototype.forEach.call(document.querySelectorAll(".hdr .seg button"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.view === (v === "skills-guide" ? "skills" : v)));
    });
    Array.prototype.forEach.call(document.querySelectorAll("#skillsViewTabs [role=tab]"), function (b) {
      b.setAttribute("aria-selected", String(b.id === (v === "skills-guide" ? "skillsGuideTab" : "skillsCatalogTab")));
    });
    if (!opts.keepHash) history.replaceState(null, "", "#" + v);
    if (!opts.noScroll) window.scrollTo({ top: 0, behavior: opts.instant ? "auto" : "smooth" });
  }

  function route(instant) {
    var raw = (location.hash || "").replace("#", "");
    if (raw.indexOf("tool/") === 0) {
      var toolId = raw.replace("tool/", "");
      setView("tools", { keepHash: true, instant: instant, noScroll: instant });
      if (S.byId[toolId]) {
        openTool(S.byId[toolId], { keepHash: true });
      }
    } else if (raw.indexOf("system/") === 0) {
      var sysId = raw.replace("system/", "");
      setView("systems", { keepHash: true, instant: instant, noScroll: instant });
      jumpToSystem(sysId, { keepHash: true });
    } else if (raw === "matrix" || raw === "matriz") {
      closeSheets();
      setView("matrix", { keepHash: true, instant: instant, noScroll: instant });
    } else if (raw === "skills/guia") {
      closeSheets();
      setView("skills-guide", { keepHash: true, instant: instant, noScroll: instant });
    } else if (raw.indexOf("skill/") === 0) {
      var skillName = decodeURIComponent(raw.replace("skill/", ""));
      var skill = S.skills.find(function (item) { return item.name === skillName; });
      setView("skills", { keepHash: true, instant: instant, noScroll: instant });
      if (skill) openSkillDetail(skill, { keepHash: true });
    } else if (raw === "skills") {
      closeSheets();
      setView("skills", { keepHash: true, instant: instant, noScroll: instant });
    } else if (raw === "brève" || raw === "breve") {
      closeSheets();
      history.replaceState(null, "", "#skills/guia");
      setView("skills-guide", { keepHash: true, instant: instant, noScroll: instant });
    } else {
      closeSheets();
      setView(raw === "systems" ? "systems" : "tools", { keepHash: true, instant: instant, noScroll: instant });
    }
  }

  function jumpToTool(t) {
    S.cat = "Todas";
    S.q = t.name;
    document.getElementById("q").value = t.name;
    document.getElementById("field").classList.add("has-val");
    syncRail();
    renderTools();
    setView("tools");
  }

  function jumpToSystem(id, opts) {
    opts = opts || {};
    setView("systems", { keepHash: !!opts.keepHash });
    if (!opts.keepHash) history.replaceState(null, "", "#system/" + id);
    setTimeout(function () {
      var c = document.getElementById("sys-" + id);
      if (!c) return;
      if (!c.classList.contains("open")) c.querySelector(".s-top").click();
      c.scrollIntoView({ behavior: "smooth", block: "center" });
      c.animate(
        [{ boxShadow: "0 0 0 0 var(--accent-soft)" },
         { boxShadow: "0 0 0 5px var(--accent-soft)" },
         { boxShadow: "0 0 0 0 var(--accent-soft)" }],
        { duration: 1100, easing: "ease-out" }
      );
    }, 90);
  }

  /* ---------------- tool modal ---------------- */

  function openTool(t, opts) {
    opts = opts || {};
    if (!opts.keepHash) history.replaceState(null, "", "#tool/" + t.id);
    var shareUrl = location.origin + location.pathname + "#tool/" + t.id;

    var m = document.getElementById("modal");
    m.innerHTML =
      '<div class="m-head">' +
        '<span class="m-logo" data-logo></span>' +
        '<span class="m-title"><h2>' + esc(t.name) + '</h2><div class="t-cat">' + esc(t.category) + "</div></span>" +
        '<div class="m-actions">' +
          '<button class="share-btn" id="mShare" aria-label="Copiar link direto"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copiar link</span></button>' +
          '<button class="m-x" aria-label="Fechar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
      "</div>" +
      '<div class="m-body">' +
        "<div><p class=\"lbl\">O que é</p><p>" + esc(t.description) + "</p></div>" +
        "<div><p class=\"lbl\">Como usamos</p><p class=\"strong\">" + esc(t.usage) + "</p></div>" +
        ((t.projects || []).length
          ? '<div><p class="lbl">Onde aparece</p><div class="chips" data-projs></div></div>' : "") +
        (t.link ? '<a class="m-link" href="' + esc(t.link) + '" target="_blank" rel="noopener">Documentação oficial →</a>' : "") +
      "</div>";

    mountLogo(m.querySelector("[data-logo]"), t);

    var shareBtn = m.querySelector("#mShare");
    if (shareBtn) {
      shareBtn.onclick = function (e) {
        e.stopPropagation();
        copyToClipboard(shareUrl, shareBtn);
      };
    }

    var ph = m.querySelector("[data-projs]");
    if (ph) {
      (t.projects || []).forEach(function (p) {
        var id = PROJ2SYS[p];
        var b = document.createElement(id ? "button" : "span");
        b.className = id ? "proj-btn" : "chip";
        b.textContent = p;
        if (id) b.onclick = function () { closeAll(); jumpToSystem(id); };
        ph.appendChild(b);
      });
    }

    m.querySelector(".m-x").onclick = closeAll;
    open(m);
  }

  /* ---------------- command palette ---------------- */

  function openPal() {
    var p = document.getElementById("pal");
    open(p);
    var input = document.getElementById("palQ");
    input.value = "";
    palRender("");
    setTimeout(function () { input.focus(); }, 20);
  }

  function palRender(q) {
    var nq = norm(q.trim());
    var host = document.getElementById("palList");

    var actions = [
      {
        name: "Ir para Catálogo de Ferramentas",
        sub: "Visualizar todas as " + S.tools.length + " tecnologias",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        run: function () { closeAll(); setView("tools"); }
      },
      {
        name: "Ir para Sistemas do Grupo",
        sub: "Visualizar os " + S.systems.length + " sistemas",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
        run: function () { closeAll(); setView("systems"); }
      },
      {
        name: "Ir para Matriz de Tecnologias",
        sub: "Tabela comparativa lado a lado",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
        run: function () { closeAll(); setView("matrix"); }
      },
      {
        name: "Alternar Tema (Claro / Escuro)",
        sub: "Mudar aparência visual do site",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
        run: function () { document.getElementById("themeBtn").click(); closeAll(); }
      },
      {
        name: "Exportar Relatório em Markdown (.md)",
        sub: "Download do arquivo formatado",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
        run: function () { closeAll(); exportMarkdown(); }
      },
      {
        name: "Exportar Catálogo em JSON (.json)",
        sub: "Download do dataset unificado",
        icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
        run: function () { closeAll(); exportJSON(); }
      }
    ];

    var matchedActions = actions.filter(function (act) {
      return !nq || norm(act.name + " " + act.sub).indexOf(nq) !== -1;
    });

    var tools = S.tools.filter(function (t) {
      return !nq || norm(t.name + " " + t.category).indexOf(nq) !== -1;
    }).slice(0, 6);

    var systems = S.systems.filter(function (s) {
      return !nq || norm(s.name + " " + s.company).indexOf(nq) !== -1;
    }).slice(0, 4);

    S.palRows = [];
    host.innerHTML = "";

    if (!matchedActions.length && !tools.length && !systems.length) {
      host.innerHTML = '<div class="pal-empty">Nenhum resultado para "' + esc(q) + '".</div>';
      return;
    }

    if (matchedActions.length && (nq.length === 0 || matchedActions.length < 4)) {
      host.insertAdjacentHTML("beforeend", '<div class="pal-grp">Ações Globais</div>');
      matchedActions.forEach(function (act) {
        var b = document.createElement("button");
        b.className = "pal-row";
        b.innerHTML = '<span class="pal-ic">' + act.icon + '</span>' +
          '<span class="pal-txt"><span class="pal-nm">' + esc(act.name) + '</span>' +
          '<span class="pal-sub">' + esc(act.sub) + '</span></span>';
        b.onclick = act.run;
        host.appendChild(b);
        S.palRows.push(b);
      });
    }

    if (systems.length) {
      host.insertAdjacentHTML("beforeend", '<div class="pal-grp">Sistemas</div>');
      systems.forEach(function (s) {
        var b = row(s.name, s.company + " · " + (PLAT[s.platform] ? PLAT[s.platform].label : ""), null);
        b.onclick = function () { closeAll(); jumpToSystem(s.id); };
        host.appendChild(b);
        S.palRows.push(b);
      });
    }

    if (tools.length) {
      host.insertAdjacentHTML("beforeend", '<div class="pal-grp">Ferramentas</div>');
      tools.forEach(function (t) {
        var b = row(t.name, t.category, t);
        b.onclick = function () { closeAll(); openTool(t); };
        host.appendChild(b);
        S.palRows.push(b);
      });
    }

    S.palIdx = 0;
    palHi();
  }

  function row(name, sub, tool) {
    var b = document.createElement("button");
    b.className = "pal-row";
    b.innerHTML = '<span class="pal-ic" data-logo></span>' +
      '<span class="pal-txt"><span class="pal-nm">' + esc(name) + '</span>' +
      '<span class="pal-sub">' + esc(sub) + "</span></span>";
    var holder = b.querySelector("[data-logo]");
    if (tool) mountLogo(holder, tool);
    else holder.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-faint)"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    return b;
  }

  function palHi() {
    S.palRows.forEach(function (r, i) {
      r.setAttribute("data-active", String(i === S.palIdx));
    });
    if (S.palRows[S.palIdx]) {
      S.palRows[S.palIdx].scrollIntoView({ block: "nearest" });
    }
  }

  /* ---------------- overlay plumbing ---------------- */

  function open(sheet) {
    closeSheets();
    document.getElementById("scrim").classList.add("on");
    sheet.classList.add("on");
    document.body.style.overflow = "hidden";
  }

  function closeSheets() {
    document.getElementById("modal").classList.remove("on");
    document.getElementById("pal").classList.remove("on");
  }

  function closeAll() {
    closeSheets();
    document.getElementById("scrim").classList.remove("on");
    document.body.style.overflow = "";
    if (location.hash && location.hash.indexOf("#tool/") === 0) {
      history.replaceState(null, "", "#tools");
    } else if (location.hash && location.hash.indexOf("#skill/") === 0) {
      history.replaceState(null, "", "#skills");
    }
  }

  /* ============================================================
     Layer Pills
     ============================================================ */

  function buildLayerPills() {
    var host = document.getElementById("layerPills");
    if (!host) return;
    host.innerHTML = "";

    var layers = [];
    S.tools.forEach(function (t) {
      if (t.layer && layers.indexOf(t.layer) === -1) layers.push(t.layer);
    });
    layers.sort(function (a, b) { return a.localeCompare(b, "pt"); });

    var allLayers = ["Todas"].concat(layers);
    allLayers.forEach(function (layerName) {
      var pill = document.createElement("button");
      pill.className = "layer-pill";
      pill.setAttribute("aria-pressed", String(S.layer === layerName));
      var color = LAYER_COLORS[layerName] || "";
      if (color) pill.style.setProperty("--layer-color", color);

      pill.innerHTML =
        (layerName !== "Todas" ? '<span class="layer-pill-dot"></span>' : "") +
        esc(layerName);

      pill.onclick = function () {
        S.layer = layerName;
        Array.prototype.forEach.call(host.querySelectorAll(".layer-pill"), function (p) {
          p.setAttribute("aria-pressed", String(p === pill));
        });
        renderTools();
      };
      host.appendChild(pill);
    });
  }

  /* ============================================================
     Stats Counter Animation
     ============================================================ */

  function animateStats() {
    if (S.statsAnimated) return;
    S.statsAnimated = true;
    var els = document.querySelectorAll(".stat-n");
    Array.prototype.forEach.call(els, function (el) {
      var target = parseInt(el.textContent, 10);
      if (isNaN(target) || target < 2) return;
      var start = 0;
      var duration = 600;
      var startTime = null;
      function step(now) {
        if (!startTime) startTime = now;
        var progress = Math.min((now - startTime) / duration, 1);
        // ease-out cubic
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = target;
      }
      requestAnimationFrame(step);
    });
  }

  /* ============================================================
     Stack Health & Drift
     ============================================================ */

  function buildStackHealth() {
    var host = document.getElementById("stackHealth");
    if (!host) return;

    var cards = [];

    // --- 1. Core tools (used in 4+ projects = "core" of the group)
    var core = S.tools.filter(function (t) { return (t.projects || []).length >= 4; });
    cards.push({
      signal: "green",
      title: "Ferramentas Core do Grupo",
      desc: core.length + " tecnologias adotadas em 4+ projetos, formando o núcleo estável do stack.",
      detail: core.slice(0, 6).map(function (t) { return t.name; }).join(", ") + (core.length > 6 ? "…" : "")
    });

    // --- 2. Linting fragmentation: Biome vs ESLint+Prettier
    var hasBiome = S.tools.find(function (t) { return t.id === "biome"; });
    var hasEslint = S.tools.find(function (t) { return t.id === "eslint"; });
    var bioProjs = hasBiome ? (hasBiome.projects || []).length : 0;
    var eslProjs = hasEslint ? (hasEslint.projects || []).length : 0;
    if (hasBiome && hasEslint) {
      cards.push({
        signal: "yellow",
        title: "Fragmentação: Lint & Formato",
        desc: "Biome (" + bioProjs + " proj.) e ESLint+Prettier (" + eslProjs + " proj.) coexistem. " +
              "Considerar migração gradual para Biome como padrão único.",
        detail: "Biome: portal-supertrans, nucleo-portais, app-almoxarifado · ESLint: portais legacy"
      });
    }

    // --- 3. Auth fragmentation: Better Auth vs Passport+JWT
    var hasBetterAuth = S.tools.find(function (t) { return t.id === "better-auth"; });
    var hasPassport   = S.tools.find(function (t) { return t.id === "passportjs"; });
    if (hasBetterAuth && hasPassport) {
      cards.push({
        signal: "yellow",
        title: "Fragmentação: Autenticação",
        desc: "Dois padrões de autenticação ativos: Better Auth (portal-supertrans, moderno, TypeScript-first) " +
              "e Passport.js + JWT (Portal_Fornecedor, Portal-Aurora, legado).",
        detail: "Oportunidade de unificação na próxima iteração dos portais legacy"
      });
    }

    // --- 4. CI/CD fragmentation: GitHub Actions vs GitLab CI
    var hasGHA = S.tools.find(function (t) { return t.id === "github-actions"; });
    var hasGlab = S.tools.find(function (t) { return t.id === "gitlab-ci"; });
    if (hasGHA && hasGlab) {
      cards.push({
        signal: "yellow",
        title: "Fragmentação: CI/CD",
        desc: "GitHub Actions (projetos públicos) e GitLab CI self-hosted (portais corporativos) em uso simultâneo. " +
              "Convivência intencional por restrição de rede.",
        detail: "GitHub Actions: portal-supertrans, superfood · GitLab CI: Portal_Fornecedor, Portal-Aurora"
      });
    }

    // --- 5. Tailwind version divergence
    var twTool = S.tools.find(function (t) { return t.id === "tailwindcss"; });
    if (twTool && twTool.projects && twTool.projects.length >= 4) {
      cards.push({
        signal: "yellow",
        title: "Divergência: Tailwind CSS v3 vs v4",
        desc: "portal-supertrans e nucleo-portais usam Tailwind v4 (CSS-first, sem config TS). " +
              "Portal_Fornecedor e Portal-Aurora usam Tailwind v3. Migração gradual planejada.",
        detail: "v4: portal-supertrans, nucleo-portais · v3: Portal_Fornecedor, Portal-Aurora"
      });
    }

    // --- 6. TypeScript adoption (positive)
    var tsProjs = (S.tools.find(function (t) { return t.id === "typescript"; }) || {}).projects || [];
    if (tsProjs.length >= 6) {
      cards.push({
        signal: "green",
        title: "TypeScript: Adoção Total",
        desc: "TypeScript em modo estrito é a linguagem principal em todos os " + tsProjs.length +
              " projetos ativos do grupo. Zero projetos JavaScript puro.",
        detail: "100% de cobertura — frontend, backend, mobile e design system"
      });
    }

    // --- 7. Observability: only one project has full stack
    var obsTools = S.tools.filter(function (t) { return t.layer === "Observabilidade"; });
    var obsOnlyOne = obsTools.every(function (t) { return (t.projects || []).length === 1; });
    if (obsOnlyOne && obsTools.length > 3) {
      cards.push({
        signal: "red",
        title: "Observabilidade: Concentrada",
        desc: "Stack completa (Grafana, Prometheus, Loki, Alloy, Faro, OTel) presente apenas em " +
              "portal-supertrans. Os demais sistemas carecem de instrumentação.",
        detail: "Oportunidade: expandir ao menos métricas básicas (prom-client) para outros projetos"
      });
    }

    // Render
    var signalLabel = { green: "✓ Padronizado", yellow: "⚠ Fragmentado", red: "✗ Atenção" };
    host.innerHTML =
      '<div class="stack-health">' +
        '<div class="stack-health-h">' +
          '<div class="stack-health-icon">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
              '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' +
            '</svg>' +
          '</div>' +
          '<span class="stack-health-title">Stack Health &amp; Drift</span>' +
          '<span class="stack-health-sub">Análise computada automaticamente · ' + cards.length + ' insights</span>' +
        '</div>' +
        '<div class="health-grid">' +
          cards.map(function (c) {
            return '<div class="health-card">' +
              '<div class="health-signal ' + c.signal + '" title="' + signalLabel[c.signal] + '"></div>' +
              '<div class="health-card-body">' +
                '<div class="health-card-title">' + esc(c.title) + '</div>' +
                '<div class="health-card-desc">' + esc(c.desc) + '</div>' +
                (c.detail ? '<div class="health-card-detail">' + esc(c.detail) + '</div>' : '') +
              '</div>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>';
  }

  /* ============================================================
     Network Graph (Force-Directed SVG)
     ============================================================ */

  var graphSim = null; // simulation handle

  function buildNetworkGraph() {
    var host = document.getElementById("graphSvg");
    if (!host) return;

    // Only show tools used in 2+ systems by default
    var filteredTools = S.tools.filter(function (t) { return (t._sys || []).length >= 2; });

    // Build nodes
    var nodes = [];
    var nodeMap = {};

    S.systems.forEach(function (s) {
      var n = { id: "sys:" + s.id, label: s.name, type: "system", data: s, x: 0, y: 0, vx: 0, vy: 0, pinned: false };
      nodes.push(n);
      nodeMap[n.id] = n;
    });

    filteredTools.forEach(function (t) {
      var n = { id: "tool:" + t.id, label: t.name, type: "tool", data: t, x: 0, y: 0, vx: 0, vy: 0, pinned: false };
      nodes.push(n);
      nodeMap[n.id] = n;
    });

    // Build edges
    var edges = [];
    filteredTools.forEach(function (t) {
      (t._sys || []).forEach(function (sysId) {
        var src = nodeMap["tool:" + t.id];
        var tgt = nodeMap["sys:" + sysId];
        if (src && tgt) edges.push({ src: src, tgt: tgt });
      });
    });

    // Initialize positions — systems in a circle, tools scattered
    var W = 900, H = 500;
    var cx = W / 2, cy = H / 2;
    var sysNodes = nodes.filter(function (n) { return n.type === "system"; });
    var toolNodes = nodes.filter(function (n) { return n.type === "tool"; });

    sysNodes.forEach(function (n, i) {
      var angle = (i / sysNodes.length) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + Math.cos(angle) * 180;
      n.y = cy + Math.sin(angle) * 160;
    });
    toolNodes.forEach(function (n, i) {
      var angle = (i / toolNodes.length) * Math.PI * 2;
      n.x = cx + Math.cos(angle) * 320 + (Math.random() - 0.5) * 60;
      n.y = cy + Math.sin(angle) * 260 + (Math.random() - 0.5) * 60;
    });

    renderGraph(host, nodes, edges, W, H);

    // Legend
    var legend = document.getElementById("graphLegend");
    if (legend) {
      legend.innerHTML =
        '<div class="graph-legend-item"><div class="graph-legend-ring" style="color:var(--accent)"></div><span>Sistema</span></div>' +
        '<div class="graph-legend-item"><div class="graph-legend-dot" style="background:var(--text-muted)"></div><span>Ferramenta (2+ sistemas)</span></div>' +
        '<div class="graph-legend-item" style="margin-left:6px;font-size:11px;opacity:.7">Clique para abrir · Arraste para mover</div>';
    }

    var resetBtn = document.getElementById("graphResetBtn");
    if (resetBtn) {
      resetBtn.onclick = function () { buildNetworkGraph(); };
    }
  }

  function renderGraph(svg, nodes, edges, W, H) {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);

    var NS = "http://www.w3.org/2000/svg";

    // Defs (arrowhead)
    var defs = document.createElementNS(NS, "defs");
    var marker = document.createElementNS(NS, "marker");
    marker.setAttribute("id", "arrowhead");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("refX", "3");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    var poly = document.createElementNS(NS, "polygon");
    poly.setAttribute("points", "0 0, 6 3, 0 6");
    poly.setAttribute("fill", "var(--border-strong)");
    marker.appendChild(poly);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Edge layer
    var edgeGroup = document.createElementNS(NS, "g");
    edgeGroup.setAttribute("class", "g-edges");

    var edgeEls = edges.map(function (e) {
      var line = document.createElementNS(NS, "line");
      line.setAttribute("stroke", "var(--border-strong)");
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-opacity", "0.6");
      edgeGroup.appendChild(line);
      return { el: line, src: e.src, tgt: e.tgt };
    });
    svg.appendChild(edgeGroup);

    // Node layer
    var nodeGroup = document.createElementNS(NS, "g");
    nodeGroup.setAttribute("class", "g-nodes");

    var tooltip = document.getElementById("graphTooltip");
    var wrap = document.getElementById("graphCanvasWrap");

    var nodeEls = nodes.map(function (n) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "g-node");
      g.style.cursor = "pointer";

      var isSystem = n.type === "system";
      var r = isSystem ? 18 : 7;

      var circle = document.createElementNS(NS, "circle");
      circle.setAttribute("r", String(r));
      circle.setAttribute("stroke-width", isSystem ? "2.5" : "1.5");

      if (isSystem) {
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", n.data.companyColor || "var(--accent)");
        // inner fill
        var innerFill = document.createElementNS(NS, "circle");
        innerFill.setAttribute("r", String(r - 2));
        innerFill.setAttribute("fill", n.data.companyColor || "var(--accent)");
        innerFill.setAttribute("fill-opacity", "0.15");
        g.appendChild(innerFill);
      } else {
        var h = hue(n.label);
        circle.setAttribute("fill", "hsl(" + h + " 55% 62% / 0.9)");
        circle.setAttribute("stroke", "hsl(" + h + " 40% 50%)");
      }
      g.appendChild(circle);

      if (isSystem) {
        var lbl = document.createElementNS(NS, "text");
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("dy", String(r + 13));
        lbl.setAttribute("fill", "var(--text-muted)");
        lbl.setAttribute("font-size", "9");
        lbl.setAttribute("font-family", "Inter, sans-serif");
        lbl.textContent = n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label;
        g.appendChild(lbl);
      }

      nodeGroup.appendChild(g);

      // Hover tooltip
      g.addEventListener("mouseenter", function (ev) {
        if (!tooltip || !wrap) return;
        var rect = wrap.getBoundingClientRect();
        tooltip.innerHTML = '<div>' + esc(n.label) + '</div>' +
          '<div class="graph-tooltip-sub">' +
          (n.type === "system"
            ? n.data.company
            : ((n.data._sys || []).length + " sistemas · " + (n.data.layer || n.data.category))) +
          '</div>';
        tooltip.style.left = (ev.clientX - rect.left + 12) + "px";
        tooltip.style.top  = (ev.clientY - rect.top + 12) + "px";
        tooltip.classList.add("visible");
        // fade non-neighbors
        var neighbors = new Set();
        edgeEls.forEach(function (e) {
          if (e.src === n || e.tgt === n) {
            neighbors.add(e.src);
            neighbors.add(e.tgt);
          }
        });
        nodeEls.forEach(function (ne) {
          ne.g.style.opacity = (neighbors.has(ne.n) || ne.n === n) ? "1" : "0.15";
        });
        edgeEls.forEach(function (e) {
          e.el.style.opacity = (e.src === n || e.tgt === n) ? "1" : "0.1";
        });
      });

      g.addEventListener("mousemove", function (ev) {
        if (!tooltip || !wrap) return;
        var rect = wrap.getBoundingClientRect();
        tooltip.style.left = (ev.clientX - rect.left + 12) + "px";
        tooltip.style.top  = (ev.clientY - rect.top + 12) + "px";
      });

      g.addEventListener("mouseleave", function () {
        if (tooltip) tooltip.classList.remove("visible");
        nodeEls.forEach(function (ne) { ne.g.style.opacity = "1"; });
        edgeEls.forEach(function (e) { e.el.style.opacity = "1"; });
      });

      // Click
      g.addEventListener("click", function (ev) {
        if (ev.defaultPrevented) return; // skip if it was a drag
        if (n.type === "system") {
          closeAll();
          jumpToSystem(n.data.id);
        } else {
          openTool(n.data);
        }
      });

      // Drag
      g.addEventListener("mousedown", function (ev) {
        activeDragNode = n;
        n.pinned = true;
        var ctm = svg.getScreenCTM();
        dragOffX = (ev.clientX - ctm.e) / ctm.a - n.x;
        dragOffY = (ev.clientY - ctm.f) / ctm.d - n.y;
        alpha = Math.max(alpha, 0.3);
        if (typeof simRunning !== 'undefined' && !simRunning) requestAnimationFrame(tick);
        ev.preventDefault();
      });

      return { g: g, circle: circle, n: n };
    });

    var activeDragNode = null;
    var dragOffX = 0, dragOffY = 0;
    var dragged = false;
    var simRunning = true;

    window.addEventListener("mousemove", function (ev) {
      if (!activeDragNode) return;
      dragged = true;
      var ctm = svg.getScreenCTM();
      activeDragNode.x = (ev.clientX - ctm.e) / ctm.a - dragOffX;
      activeDragNode.y = (ev.clientY - ctm.f) / ctm.d - dragOffY;
      activeDragNode.vx = 0; activeDragNode.vy = 0;
      alpha = Math.max(alpha, 0.3); // keep physics active while dragging
      if (!simRunning) requestAnimationFrame(tick);
    });
    
    window.addEventListener("mouseup", function (ev) {
      if (activeDragNode) {
        if (dragged) {
          // Prevent the click event from firing on the node if we dragged it
          ev.preventDefault();
          // We need a small timeout because the click event fires after mouseup
          setTimeout(function() { dragged = false; }, 0);
          
          // Dispatch a fake click event on the SVG to stop propagation of the real click
          var fakeClick = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          fakeClick.preventDefault();
          ev.target.dispatchEvent(fakeClick);
        }
        activeDragNode.pinned = false;
        activeDragNode = null;
      }
    });

    svg.appendChild(nodeGroup);

    // Force-directed physics simulation
    var alpha = 1.0;
    var alphaDecay = 0.015; // Slower decay = longer simulation
    var idealLen = 140; // slightly longer edges
    var repK = 3500; // slightly softer repulsion

    function tick() {
      if (alpha < 0.005) {
        simRunning = false;
        return; 
      }
      simRunning = true;
      alpha *= (1 - alphaDecay);

      // repulsion between all nodes
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a = nodes[i], b = nodes[j];
          var dx = b.x - a.x, dy = b.y - a.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var f = (repK / (dist * dist)) * alpha;
          var fx = (dx / dist) * f, fy = (dy / dist) * f;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }

      // attraction along edges
      edges.forEach(function (e) {
        var dx = e.tgt.x - e.src.x, dy = e.tgt.y - e.src.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var f = ((dist - idealLen) / dist) * 0.15 * alpha;
        var fx = dx * f, fy = dy * f;
        if (!e.src.pinned) { e.src.vx += fx; e.src.vy += fy; }
        if (!e.tgt.pinned) { e.tgt.vx -= fx; e.tgt.vy -= fy; }
      });

      // gravity toward center
      nodes.forEach(function (n) {
        if (!n.pinned) {
          n.vx += (cx - n.x) * 0.01 * alpha;
          n.vy += (cy - n.y) * 0.01 * alpha;
        }
      });

      // integrate
      var damping = 0.85; // Less damping = more wobbly/malleable
      nodes.forEach(function (n) {
        if (n.pinned) return;
        n.vx *= damping; n.vy *= damping;
        n.x += n.vx; n.y += n.vy;
        // boundary
        n.x = Math.max(20, Math.min(W - 20, n.x));
        n.y = Math.max(20, Math.min(H - 20, n.y));
      });

      // update DOM
      nodeEls.forEach(function (ne) {
        ne.g.setAttribute("transform", "translate(" + ne.n.x + "," + ne.n.y + ")");
      });
      edgeEls.forEach(function (e) {
        e.el.setAttribute("x1", String(e.src.x));
        e.el.setAttribute("y1", String(e.src.y));
        e.el.setAttribute("x2", String(e.tgt.x));
        e.el.setAttribute("y2", String(e.tgt.y));
      });

      requestAnimationFrame(tick);
    }

    // initial positions
    nodeEls.forEach(function (ne) {
      ne.g.setAttribute("transform", "translate(" + ne.n.x + "," + ne.n.y + ")");
    });

    var cx = W / 2, cy = H / 2;
    requestAnimationFrame(tick);
  }

  /* ============================================================
     CSV Export
     ============================================================ */

  function exportCSV() {
    var rows = ["name,category,layer,version,description,usage,systems,tags,link"];
    S.tools.forEach(function (t) {
      function q(v) {
        var s = (v || "").toString().replace(/"/g, '""');
        return '"' + s + '"';
      }
      rows.push([
        q(t.name),
        q(t.category),
        q(t.layer || ""),
        q(t.version || ""),
        q(t.description),
        q(t.usage),
        q((t._sys || []).join(";")),
        q((t.tags || []).join(";")),
        q(t.link || "")
      ].join(","));
    });
    downloadFile("catalogo-tecnologias-orion.csv", rows.join("\n"), "text/csv;charset=utf-8");
  }

  /* ============================================================
     Card Hover Tilt (3D perspective)
     ============================================================ */

  function bindCardTilt() {
    // Respect reduced motion preference
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var grid = document.getElementById("grid");
    if (!grid) return;

    grid.addEventListener("mousemove", function (e) {
      var card = e.target.closest(".t-card");
      if (!card) return;
      var rect = card.getBoundingClientRect();
      var relX = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 … 0.5
      var relY = (e.clientY - rect.top)  / rect.height - 0.5;
      var rx = (-relY * 5).toFixed(2) + "deg";
      var ry = ( relX * 5).toFixed(2) + "deg";
      card.style.setProperty("--rx", rx);
      card.style.setProperty("--ry", ry);
      card.classList.add("tilting");
    });

    grid.addEventListener("mouseleave", function (e) {
      var card = e.target.closest(".t-card");
      if (!card) return;
      card.classList.remove("tilting");
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    }, true);

    // Also handle when mouse leaves individual card
    grid.addEventListener("mouseout", function (e) {
      var card = e.target.closest(".t-card");
      if (!card) return;
      if (!card.contains(e.relatedTarget)) {
        card.classList.remove("tilting");
        card.style.removeProperty("--rx");
        card.style.removeProperty("--ry");
      }
    });
  }

  /* ---------------- events ---------------- */

  function bind() {
    document.getElementById("themeBtn").onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("orion-theme", next); } catch (e) {}
    };

    Array.prototype.forEach.call(document.querySelectorAll(".hdr .seg button"), function (b) {
      b.onclick = function () { setView(b.dataset.view); };
    });

    Array.prototype.forEach.call(document.querySelectorAll(".sortbar button"), function (b) {
      b.onclick = function () {
        S.sort = b.dataset.sort;
        Array.prototype.forEach.call(document.querySelectorAll(".sortbar button"), function (x) {
          x.setAttribute("aria-selected", String(x === b));
        });
        renderTools();
      };
    });

    var q = document.getElementById("q");
    var field = document.getElementById("field");
    var timer;
    q.oninput = function () {
      field.classList.toggle("has-val", !!q.value);
      clearTimeout(timer);
      timer = setTimeout(function () { S.q = q.value; renderTools(); }, 110);
    };
    document.getElementById("qClear").onclick = function () {
      q.value = ""; S.q = ""; field.classList.remove("has-val"); renderTools(); q.focus();
    };

    var skillsQ = document.getElementById("skillsQ");
    var skillsField = document.getElementById("skillsField");
    if (skillsQ) {
      skillsQ.oninput = function () {
        if (skillsField) skillsField.classList.toggle("has-val", !!skillsQ.value);
        renderSkills();
      };
      var skillsQClear = document.getElementById("skillsQClear");
      if (skillsQClear) {
        skillsQClear.onclick = function () {
          skillsQ.value = "";
          if (skillsField) skillsField.classList.remove("has-val");
          renderSkills();
          skillsQ.focus();
        };
      }
    }

    var skillsCatalogTab = document.getElementById("skillsCatalogTab");
    if (skillsCatalogTab) skillsCatalogTab.onclick = function () { setView("skills"); };
    var skillsGuideTab = document.getElementById("skillsGuideTab");
    if (skillsGuideTab) skillsGuideTab.onclick = function () {
      history.replaceState(null, "", "#skills/guia");
      setView("skills-guide", { keepHash: true });
    };
    var skillsGuideBack = document.getElementById("skillsGuideBack");
    if (skillsGuideBack) skillsGuideBack.onclick = function () { setView("skills"); };

    var compSel = document.getElementById("companySelect");
    if (compSel) {
      compSel.onchange = function () {
        S.toolCompany = compSel.value;
        renderTools();
      };
    }

    document.getElementById("palBtn").onclick = openPal;
    document.getElementById("scrim").onclick = closeAll;

    var palQ = document.getElementById("palQ");
    palQ.oninput = function () { palRender(palQ.value); };

    var mq = document.getElementById("matrixQ");
    var mqField = document.getElementById("matrixField");
    if (mq) {
      mq.oninput = function () {
        if (mqField) mqField.classList.toggle("has-val", !!mq.value);
        filterMatrix(mq.value);
      };
      var mqClear = document.getElementById("matrixQClear");
      if (mqClear) {
        mqClear.onclick = function () {
          mq.value = "";
          if (mqField) mqField.classList.remove("has-val");
          filterMatrix("");
          mq.focus();
        };
      }
    }

    var expCsv = document.getElementById("exportCsvBtn");
    if (expCsv) expCsv.onclick = exportCSV;

    var expMd = document.getElementById("exportMdBtn");
    if (expMd) expMd.onclick = exportMarkdown;

    var expJson = document.getElementById("exportJsonBtn");
    if (expJson) expJson.onclick = exportJSON;

    Array.prototype.forEach.call(document.querySelectorAll("#matrixViewSwitch button"), function (b) {
      b.onclick = function () { setMatrixMode(b.dataset.mview); };
    });

    bindCardTilt();

    document.addEventListener("keydown", function (e) {
      var palOpen = document.getElementById("pal").classList.contains("on");

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palOpen ? closeAll() : openPal();
        return;
      }
      if (e.key === "Escape") { closeAll(); return; }

      if (palOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          S.palIdx = Math.min(S.palIdx + 1, S.palRows.length - 1); palHi();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          S.palIdx = Math.max(S.palIdx - 1, 0); palHi();
        } else if (e.key === "Enter" && S.palRows[S.palIdx]) {
          e.preventDefault();
          S.palRows[S.palIdx].click();
        }
        return;
      }

      // "/" focuses the inline filter when not typing somewhere else
      if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
        if (S.view === "tools") { e.preventDefault(); q.focus(); }
      }
    });

    window.addEventListener("hashchange", function () { route(false); });
  }
})();
