(function () {
  "use strict";

  var S = {
    tools: [],
    systems: [],
    byId: {},
    q: "",
    cat: "Todas",
    sort: "use",
    view: "tools",
    sysCompany: "Todas",
    palIdx: 0,
    palRows: []
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

  /* ---------------- data ---------------- */

  Promise.all([
    fetch("tools.json").then(function (r) { return r.json(); }),
    fetch("systems.json").then(function (r) { return r.json(); })
  ]).then(function (r) {
    S.tools = r[0];
    S.systems = r[1];
    S.tools.forEach(function (t) { S.byId[t.id] = t; });
    S.sysIds = S.systems.map(function (s) { return s.id; });

    // precompute: which systems each tool belongs to
    S.tools.forEach(function (t) {
      t._sys = (t.projects || []).map(function (p) { return PROJ2SYS[p]; }).filter(Boolean);
    });

    buildStats();
    buildRail();
    renderTools();
    renderSystems();
    renderMatrix();
    bind();
    route(true);
  }).catch(function (e) {
    document.getElementById("grid").innerHTML =
      '<div class="empty"><h3>Erro ao carregar</h3><p>Não foi possível ler tools.json / systems.json.</p></div>';
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
      if (!q) return true;
      var haystack = norm(t.name + " " + t.category + " " + t.description + " " + t.usage + " " +
        (t.projects || []).join(" "));
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
    var table = document.querySelector(".m-table");
    if (!table) return;
    var rows = table.querySelectorAll("tbody tr");

    rows.forEach(function (row) {
      var chips = row.querySelectorAll(".m-chip");
      var catName = row.querySelector(".td-cat").textContent;
      var catMatches = nq && norm(catName).indexOf(nq) !== -1;
      var rowHasMatch = false;

      chips.forEach(function (chip) {
        var name = chip.textContent;
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
      } else {
        row.classList.add("m-row-hidden");
      }
    });
  }

  function renderMatrix() {
    buildMatrixInsights();
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
    thCat.textContent = "Categoria";
    trHead.appendChild(thCat);

    S.systems.forEach(function (s) {
      var th = document.createElement("th");
      th.innerHTML =
        '<div class="th-sys-link" title="Ver sistema ' + esc(s.name) + '">' +
          '<span class="th-sys-name">' + esc(s.name) + '</span>' +
          '<span class="th-sys-co">' + esc(s.company) + '</span>' +
        '</div>';
      th.querySelector(".th-sys-link").onclick = function () {
        jumpToSystem(s.id);
      };
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    sortedCats.forEach(function (cat) {
      var tr = document.createElement("tr");
      var tdCat = document.createElement("td");
      tdCat.className = "td-cat";
      tdCat.textContent = cat;
      tr.appendChild(tdCat);

      S.systems.forEach(function (s) {
        var td = document.createElement("td");
        var sysTools = (s.toolIds || [])
          .map(function (id) { return S.byId[id]; })
          .filter(function (t) { return t && t.category === cat; });

        if (sysTools.length === 0) {
          td.innerHTML = '<span class="m-empty-cell">—</span>';
        } else {
          var chipBox = document.createElement("div");
          chipBox.className = "m-chips";
          sysTools.forEach(function (t) {
            var chip = document.createElement("button");
            chip.className = "m-chip";
            var ico = document.createElement("span");
            mountLogo(ico, t);
            if (ico.firstChild && ico.firstChild.tagName === "IMG") chip.appendChild(ico.firstChild);
            else chip.innerHTML = '<span class="mono">' + esc(initials(t.name)) + '</span>';
            var nameSpan = document.createElement("span");
            nameSpan.textContent = t.name;
            chip.appendChild(nameSpan);
            chip.onclick = function () { openTool(t); };
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
  }

  /* ---------------- navigation ---------------- */

  function setView(v, opts) {
    opts = opts || {};
    S.view = v;
    document.getElementById("v-tools").classList.toggle("on", v === "tools");
    document.getElementById("v-systems").classList.toggle("on", v === "systems");
    var vMatrix = document.getElementById("v-matrix");
    if (vMatrix) vMatrix.classList.toggle("on", v === "matrix");
    Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (b) {
      b.setAttribute("aria-selected", String(b.dataset.view === v));
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
    var tools = S.tools.filter(function (t) {
      return !nq || norm(t.name + " " + t.category).indexOf(nq) !== -1;
    }).slice(0, 7);
    var systems = S.systems.filter(function (s) {
      return !nq || norm(s.name + " " + s.company).indexOf(nq) !== -1;
    }).slice(0, 5);

    S.palRows = [];
    host.innerHTML = "";

    if (!tools.length && !systems.length) {
      host.innerHTML = '<div class="pal-empty">Nenhum resultado.</div>';
      return;
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
      history.replaceState(null, "", "#" + S.view);
    }
  }

  /* ---------------- events ---------------- */

  function bind() {
    document.getElementById("themeBtn").onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("orion-theme", next); } catch (e) {}
    };

    Array.prototype.forEach.call(document.querySelectorAll(".seg button"), function (b) {
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

    var expMd = document.getElementById("exportMdBtn");
    if (expMd) expMd.onclick = exportMarkdown;

    var expJson = document.getElementById("exportJsonBtn");
    if (expJson) expJson.onclick = exportJSON;

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
