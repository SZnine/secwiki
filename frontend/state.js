/* Global application state */

const state = {
  taxonomy: null,
  termRegistry: {},

  currentDomainId: null,
  currentObjectId: null,
  currentTermId: null,

  currentTerm: null,
  draftTerm: null,

  mode: "read", // read | edit | history
  loading: false,

  expandedCaseIds: new Set(),
};

function buildTermRegistry(taxonomy) {
  const reg = {};
  for (const domain of taxonomy.domains) {
    for (const obj of domain.objects) {
      for (const t of obj.terms) {
        reg[t.term_id] = {
          term_id: t.term_id,
          title: t.title,
          domain_id: domain.id,
          object_id: obj.id,
          route: `/term/${domain.id}/${obj.id}/${t.slug}`,
          status: t.status,
        };
      }
    }
  }
  return reg;
}

function esc(s) {
  return String(s || "").replace(/[&<>'"`/]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;","`":"&#96;","/":"&#x2F;"}[c]));
}

function sanitizeSVG(svgStr) {
  const doc = new DOMParser().parseFromString(svgStr, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) return null;
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== "svg") return null;
  const blacklist = new Set([
    "script", "iframe", "object", "embed", "applet", "form", "input",
    "textarea", "button", "select", "link", "meta", "base",
    "foreignObject", "foreignobject",
  ]);
  const eventRe = /^on/i;
  const dangerousUrlRe = /^\s*(javascript|vbscript|data\s*:\s*text\/html)/i;
  function walk(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (blacklist.has(tag)) { el.remove(); return; }
    const attrs = [...el.attributes];
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (eventRe.test(name)) { el.removeAttribute(attr.name); continue; }
      if ((name === "href" || name === "xlink:href") && dangerousUrlRe.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    for (const child of [...el.children]) walk(child);
  }
  walk(svg);
  return svg.outerHTML;
}

function nl2br(s) {
  return esc(s || "").replace(/\n/g, "<br>");
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");

function getImportHistory() {
  try {
    return JSON.parse(localStorage.getItem("secwiki_import_history") || "[]");
  } catch { return []; }
}

function saveImportHistory(entry) {
  const history = getImportHistory();
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  localStorage.setItem("secwiki_import_history", JSON.stringify(history));
}
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 2500);
}
