/* ── App: main controller ── */

const domainSelect = document.getElementById("domainSelect");
const objectList = document.getElementById("objectList");
const pageContent = document.getElementById("pageContent");
const toc = document.getElementById("toc");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const themeBtn = document.getElementById("themeBtn");
const importFile = document.getElementById("importFile");

let currentTermId = null;
let wizardState = null;

/* ── Init ── */

async function init() {
  try {
    const taxonomy = await api.getTaxonomy();
    state.taxonomy = taxonomy;
    state.termRegistry = buildTermRegistry(taxonomy);

    renderDomainOptions();

    // Restore from URL hash
    const hash = location.hash.slice(1);
    if (hash) {
      navigateFromHash(hash);
    } else {
      // Default: show first domain, first object
      const d = taxonomy.domains[0];
      if (d) {
        selectDomain(d.id);
        const o = d.objects[0];
        if (o) selectObject(d.id, o.id);
      }
    }
  } catch (err) {
    pageContent.innerHTML = `<p class="empty">加载失败：${esc(err.message)}。请确保后端服务正在运行。</p>`;
    console.error("Init error:", err);
  }
}

function navigateFromHash(hash) {
  // hash: /term/domainId/objectId/slug  or  /object/domainId/objectId
  const parts = decodeURIComponent(hash).split("/").filter(Boolean);
  if (parts[0] === "term" && parts.length >= 4) {
    const domainId = parts[1];
    const objectId = parts[2];
    const slug = parts[3];
    const termId = `${domainId}/${objectId}/${slug}`;
    // Skip renderCategoryPage — just update sidebar state, then load term
    state.currentDomainId = domainId;
    state.currentObjectId = objectId;
    domainSelect.value = domainId;
    currentTermId = termId;
    renderObjects();
    openTermById(termId);
  } else if (parts[0] === "object" && parts.length >= 3) {
    selectDomain(parts[1]);
    selectObject(parts[1], parts[2]);
  } else if (parts[0] === "domain" && parts.length >= 2) {
    selectDomain(parts[1]);
  } else if (parts[0] === "import") {
    renderImportWizard();
  }
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (hash) navigateFromHash(hash);
});


/* ── Domain / Object selection ── */

function selectDomain(domainId) {
  state.currentDomainId = domainId;
  domainSelect.value = domainId;
  renderObjects();
}

function selectObject(domainId, objectId) {
  state.currentDomainId = domainId;
  state.currentObjectId = objectId;
  state.mode = "read";
  currentTermId = null;
  renderObjects();
  renderCategoryPage();
}

function renderDomainOptions() {
  domainSelect.innerHTML = state.taxonomy.domains.map(d =>
    `<option value="${esc(d.id)}">${esc(d.name)}</option>`
  ).join("");
}

function renderObjects() {
  const domain = state.taxonomy.domains.find(d => d.id === state.currentDomainId);
  if (!domain) return;

  objectList.innerHTML = "";
  for (const obj of domain.objects) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = obj.name;
    const isActive = obj.id === state.currentObjectId;
    btn.className = isActive ? "active" : "";
    btn.onclick = () => {
      location.hash = `/object/${domain.id}/${obj.id}`;
    };
    li.appendChild(btn);

    // Expand term index for active object
    if (isActive) {
      const sub = document.createElement("ul");
      sub.className = "term-index";
      for (const t of obj.terms) {
        if (t.status === "archived") continue;
        const sli = document.createElement("li");
        const sbtn = document.createElement("button");
        sbtn.textContent = t.title;
        const isCurrent = currentTermId && t.term_id === currentTermId;
        sbtn.className = "term-index-item" + (isCurrent ? " current" : "");
        sbtn.onclick = (e) => {
          e.stopPropagation();
          // term_id = domainId/objectId/slug → build hash from it
          const tid = t.term_id;
          const tidParts = tid.split("/");
          if (tidParts.length >= 3) {
            location.hash = `/term/${encodeURIComponent(tidParts[0])}/${encodeURIComponent(tidParts[1])}/${encodeURIComponent(tidParts.slice(2).join("/"))}`;
          }
        };
        sli.appendChild(sbtn);
        sub.appendChild(sli);
      }
      li.appendChild(sub);
    }

    objectList.appendChild(li);
  }
}


/* ── Category page (object view) ── */

async function renderCategoryPage() {
  const domain = state.taxonomy.domains.find(d => d.id === state.currentDomainId);
  const obj = domain?.objects.find(o => o.id === state.currentObjectId);
  if (!domain || !obj) { pageContent.innerHTML = "<p>请选择知识域和对象。</p>"; return; }

  pageContent.innerHTML = `
    <div class="page-meta">${esc(domain.name)}</div>
    <h1>${esc(obj.name)}</h1>
    ${obj.definition ? `<p class="definition-content" style="margin:0 0 16px;font-size:15px;line-height:1.7">${esc(obj.definition)}</p>` : ""}
    <section class="field">
      <h3>术语表</h3>
      <table>
        <thead><tr><th>术语</th><th>摘要</th></tr></thead>
        <tbody>
          ${obj.terms.filter(t => t.status !== "archived").map(t => `
            <tr>
              <td class="term"><button data-action="open-term" data-term-id="${esc(t.term_id)}">${esc(t.title)}</button></td>
              <td>${esc(t.summary || t.subtitle || "")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
    <div class="footer">术语数量：${obj.terms.filter(t => t.status !== "archived").length}</div>
  `;
  renderToc([{ id: "术语表", label: "术语表" }]);
}


/* ── Term detail page ── */

async function openTermById(termId) {
  currentTermId = termId;
  state.mode = "read";
  state.expandedCaseIds.clear();
  renderObjects();

  const term = await api.getTerm(termId);
  if (!term) {
    pageContent.innerHTML = `<p class="empty">术语 ${esc(termId)} 未找到。</p>`;
    return;
  }
  state.currentTerm = term;
  state.draftTerm = null;
  renderTermPage(term, false);
}

function renderTermPage(term, editing) {
  const blocks = editing && state.draftTerm ? state.draftTerm.blocks : term.blocks;

  const actionButtons = editing
    ? `<button class="btn primary" data-action="save-term">保存</button><button class="btn btn-danger" data-action="delete-term" data-term-id="${esc(term.term_id)}">删除术语</button><button class="btn" data-action="cancel-term">取消</button>`
    : `<button class="btn" data-action="edit-term">编辑</button><button class="btn" data-action="back-category">返回</button>`;

  const blocksHtml = (blocks || []).map(b => renderBlock(b, editing)).join("");
  const tocItems = (blocks || []).filter(b => b.title).map(b => ({ id: b.id, label: b.title }));

  // Build subtitle
  const subtitleHtml = term.subtitle ? `<div class="term-subtitle">${esc(term.subtitle)}</div>` : "";

  // Build status + domain badges
  const statusBadge = term.status === "published"
    ? `<span class="badge badge-green">已发布</span>`
    : term.status === "draft"
    ? `<span class="badge badge-purple">草稿</span>`
    : "";
  const domainBadge = term.domain_id ? `<span class="badge badge-blue">${esc(term.domain_id)}</span>` : "";

  pageContent.innerHTML = `
    <div class="page-meta"><span class="muted">${esc(term.domain_id)} / ${esc(term.object_id)}</span></div>
    <h1>${esc(term.title)}</h1>
    ${subtitleHtml}
    <div class="badge-row">${domainBadge}${statusBadge}</div>
    <div class="page-actions">${actionButtons}</div>
    ${blocksHtml}
    <div class="footer">最后更新：${esc(term.updated_at || "")}</div>
  `;
  renderToc(tocItems);
  window.scrollTo(0, 0);
}


/* ── TOC ── */

function renderToc(items) {
  if (!items.length) { toc.innerHTML = ""; return; }
  toc.innerHTML = `<div class="toc-title">本页目录</div>${items.map(i => `<a href="#${esc(i.id)}">${esc(i.label)}</a>`).join("")}`;
}


/* ── Edit / Save flow ── */

function startEdit() {
  state.mode = "edit";
  state.draftTerm = JSON.parse(JSON.stringify(state.currentTerm));
  renderTermPage(state.currentTerm, true);
}

function cancelEdit() {
  state.mode = "read";
  state.draftTerm = null;
  renderTermPage(state.currentTerm, false);
}

async function saveTerm() {
  const term = state.currentTerm;
  const draft = state.draftTerm;

  // Read edited blocks from DOM
  const blocks = [...draft.blocks];
  for (let i = 0; i < blocks.length; i++) {
    const el = document.getElementById(`block-${blocks[i].id}`);
    if (!el) continue;
    if (blocks[i].type === "cases") {
      try { blocks[i].items = JSON.parse(el.value); } catch(e) { toast("案例 JSON 格式错误"); return; }
    } else if (blocks[i].type === "confusions") {
      try { blocks[i].items = JSON.parse(el.value); } catch(e) { toast("易混淆 JSON 格式错误"); return; }
    } else if (blocks[i].type === "related_terms") {
      blocks[i].items = el.value.split(/[\n,]+/).filter(Boolean).map(l => {
        const label = l.trim();
        // Try to resolve term_id from existing registry
        const existing = draft.blocks[i]?.items?.find(x => x.label === label);
        return { label, term_id: existing?.term_id || null };
      });
    } else if (blocks[i].type === "references") {
      try { blocks[i].items = JSON.parse(el.value); } catch(e) { toast("参考来源 JSON 格式错误"); return; }
    } else {
      blocks[i].content = el.value;
    }
  }

  try {
    const resp = await api.updateTerm(term.term_id, {
      title: term.title,
      subtitle: term.subtitle,
      aliases: term.aliases || [],
      summary: term.summary,
      status: term.status || "published",
      metadata: term.metadata || {},
      blocks,
      change_note: "",
    });

    if (resp.ok) {
      toast("已保存");
      state.mode = "read";
      state.draftTerm = null;
      await openTermById(term.term_id);
    } else {
      toast("保存失败：" + (resp.detail?.error?.code || "unknown"));
    }
  } catch (err) {
    toast("保存失败：" + err.message);
  }
}

async function deleteTerm(termId) {
  try {
    await api.archiveTerm(termId);
    toast("术语已删除");
    state.taxonomy = await api.getTaxonomy();
    state.termRegistry = buildTermRegistry(state.taxonomy);
    currentTermId = null;
    renderDomainOptions();

    // Check if current object still has visible terms
    const domain = state.taxonomy.domains.find(d => d.id === state.currentDomainId);
    const obj = domain?.objects.find(o => o.id === state.currentObjectId);
    if (obj && obj.terms.some(t => t.status !== "archived")) {
      location.hash = `/object/${encodeURIComponent(state.currentDomainId)}/${encodeURIComponent(state.currentObjectId)}`;
    } else {
      // Object is now empty, navigate to first object with terms
      const nextObj = domain?.objects.find(o => o.terms.some(t => t.status !== "archived"));
      if (nextObj) {
        location.hash = `/object/${encodeURIComponent(state.currentDomainId)}/${encodeURIComponent(nextObj.id)}`;
      } else {
        selectDomain(state.currentDomainId);
        pageContent.innerHTML = '<p class="empty">当前分类已无术语。</p>';
      }
    }
  } catch (err) {
    toast("删除失败：" + err.message);
  }
}


/* ── Search ── */

let searchTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(searchInput.value), 250);
});

async function doSearch(q) {
  q = q.trim();
  if (!q) {
    renderCategoryPage();
    return;
  }
  const resp = await api.searchTerms(q);
  renderSearchResults(q, resp.results);
}

function renderSearchResults(q, results) {
  pageContent.innerHTML = `
    <div class="page-meta">搜索结果 / ${esc(q)}</div>
    <h1>搜索：${esc(q)}</h1>
    <p style="color:var(--muted)">找到 ${results.length} 个结果。</p>
    ${results.length ? `<table><thead><tr><th>术语</th><th>知识域</th><th>对象</th></tr></thead><tbody>
      ${results.map(r => `<tr>
        <td class="term"><button data-action="open-term" data-term-id="${esc(r.term_id)}">${esc(r.title)}</button></td>
        <td>${esc(r.domain_name)}</td>
        <td>${esc(r.object_name)}</td>
      </tr>`).join("")}
    </tbody></table>` : ""}
  `;
  toc.innerHTML = "";
}


/* ── Event delegation ── */

pageContent.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "open-term") {
    const tid = btn.dataset.termId;
    if (tid) {
      const parts = tid.split("/");
      if (parts.length >= 3) {
        location.hash = `/term/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/${encodeURIComponent(parts.slice(2).join("/"))}`;
      }
    }
    return;
  }
  if (action === "edit-term") { startEdit(); return; }
  if (action === "cancel-term") { cancelEdit(); return; }
  if (action === "save-term") { saveTerm(); return; }
  if (action === "delete-term") {
    const tid = btn.dataset.termId;
    if (tid && confirm(`确定要删除术语「${tid}」吗？此操作不可撤销。`)) {
      deleteTerm(tid);
    }
    return;
  }
  if (action === "back-category") {
    location.hash = `/object/${state.currentDomainId}/${state.currentObjectId}`;
    return;
  }
  if (action === "toggle-case") {
    const idx = parseInt(btn.dataset.caseIdx);
    if (state.expandedCaseIds.has(idx)) state.expandedCaseIds.delete(idx);
    else state.expandedCaseIds.add(idx);
    // Find the parent case-item and replace only its inner content
    const caseItem = btn.closest(".case-item");
    if (caseItem) {
      // Find which block and which case index this belongs to
      const blocks = state.mode === "edit" && state.draftTerm ? state.draftTerm.blocks : state.currentTerm.blocks;
      const casesBlock = (blocks || []).find(b => b.type === "cases");
      if (casesBlock && casesBlock.items[idx]) {
        const temp = document.createElement("div");
        temp.innerHTML = renderCase(casesBlock.items[idx], idx);
        caseItem.replaceWith(temp.firstElementChild);
      }
    }
    return;
  }
});

domainSelect.addEventListener("change", () => {
  const domain = state.taxonomy.domains.find(d => d.id === domainSelect.value);
  if (domain && domain.objects.length) {
    location.hash = `/object/${encodeURIComponent(domain.id)}/${encodeURIComponent(domain.objects[0].id)}`;
  }
});

exportBtn.addEventListener("click", async () => {
  const data = await api.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "secwiki-export.json"; a.click();
  URL.revokeObjectURL(url);
  toast("导出成功");
});

importBtn.addEventListener("click", () => {
  location.hash = "/import";
});

themeBtn.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("secwiki_theme");
    themeBtn.innerHTML = "&#9788;"; // sun
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("secwiki_theme", "dark");
    themeBtn.innerHTML = "&#9790;"; // moon
  }
});

// Restore theme from localStorage
if (localStorage.getItem("secwiki_theme") === "dark") {
  document.documentElement.setAttribute("data-theme", "dark");
  themeBtn.innerHTML = "&#9790;";
}

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const resp = await api.importContent("overwrite", payload);
    const s = resp.summary || {};
    const parts = [];
    if (s.created) parts.push(`创建 ${s.created}`);
    if (s.updated) parts.push(`更新 ${s.updated}`);
    if (s.skipped) parts.push(`跳过 ${s.skipped}`);
    if (s.errors?.length) parts.push(`错误 ${s.errors.length}`);
    toast(parts.length ? `导入完成：${parts.join("，")}` : "导入完成（无变化）");
    // Refresh taxonomy
    state.taxonomy = await api.getTaxonomy();
    state.termRegistry = buildTermRegistry(state.taxonomy);
    renderDomainOptions();
    selectDomain(state.currentDomainId);
    selectObject(state.currentDomainId, state.currentObjectId);
  } catch (err) {
    toast("导入失败：" + err.message);
  }
});


/* ── Import Wizard ── */

function renderImportWizard() {
  if (!wizardState) {
    wizardState = { step: 1, rawNames: "", termChecks: [], prompt: "", validatedPayload: null, lastResult: null, importMode: "overwrite" };
  }
  const step = wizardState.step;
  pageContent.innerHTML = `
    <div class="wizard">
      <div class="wizard-header">
        <h2>AI 批量导入向导</h2>
        <button class="btn" data-action="wizard-back">← 返回页面</button>
      </div>
      <div class="wizard-steps">
        ${renderWizardStepIndicator(step)}
      </div>
      <div class="wizard-panel">
        ${step === 1 ? renderWizardStep1() : ""}
        ${step === 2 ? renderWizardStep2() : ""}
        ${step === 3 ? renderWizardStep3() : ""}
        ${step === 4 ? renderWizardStep4() : ""}
      </div>
    </div>
  `;
  renderToc([]);
}

function renderWizardStepIndicator(step) {
  const steps = [
    { n: 1, label: "术语选择" },
    { n: 2, label: "提示词生成" },
    { n: 3, label: "粘贴 AI 回复" },
    { n: 4, label: "导入结果" },
  ];
  return steps.map(s => {
    const cls = s.n === step ? "active" : (s.n < step ? "done" : "");
    const mark = s.n < step ? "✓" : s.n;
    return `<div class="wizard-step ${cls}"><span class="wizard-step-num">${mark}</span>${s.n}. ${s.label}</div>`;
  }).join("");
}

function renderWizardStep1() {
  return `
    <div class="wizard-field">
      <label for="wizard-terms-input">输入术语名称（每行一个）</label>
      <textarea id="wizard-terms-input" class="wizard-textarea" placeholder="SSRF&#10;SQL Injection&#10;Prompt Injection">${esc(wizardState.rawNames)}</textarea>
    </div>
    <div class="wizard-actions">
      <div class="wizard-actions-left">
        <button class="btn" data-action="wizard-check">检查术语</button>
      </div>
      <div class="wizard-actions-right">
        <button class="btn primary" data-action="wizard-next-step2"${wizardState.termChecks.filter(t => t.selected).length === 0 ? " disabled" : ""}>下一步 →</button>
      </div>
    </div>
    ${wizardState.termChecks.length > 0 ? `
    <div style="margin-top:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <label style="font-size:13px"><input type="checkbox" id="wizard-select-all" ${wizardState.termChecks.every(t => t.selected) ? "checked" : ""}> 全选 / 取消全选</label>
      </div>
      <table class="wizard-term-table">
        <thead><tr><th></th><th>术语</th><th>状态</th><th>当前位置</th></tr></thead>
        <tbody>
          ${wizardState.termChecks.map((t, i) => `
          <tr>
            <td><input type="checkbox" data-action="wizard-toggle-term" data-idx="${i}" ${t.selected ? "checked" : ""}></td>
            <td class="${t.isNew ? "term-new" : "term-existing"}">${esc(t.name)}</td>
            <td>${t.isNew ? '<span class="badge badge-purple">新术语</span>' : '<span class="badge badge-green">已有</span>'}</td>
            <td>${esc(t.isNew ? "待 LLM 判断" : t.domainId + " / " + t.objectId)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-size:12px;color:var(--muted);margin-top:8px">已选 ${wizardState.termChecks.filter(t => t.selected).length} 个术语</p>
    </div>` : ""}
  `;
}

function renderWizardStep2() {
  return `
    <div class="wizard-field">
      <label>生成的提示词</label>
      <div class="wizard-prompt-box">${esc(wizardState.prompt)}</div>
    </div>
    <div class="wizard-actions">
      <div class="wizard-actions-left">
        <button class="btn" data-action="wizard-prev-step1">← 上一步</button>
        <button class="btn" data-action="wizard-copy-prompt">复制到剪贴板</button>
      </div>
      <div class="wizard-actions-right">
        <button class="btn primary" data-action="wizard-next-step3">下一步 →</button>
      </div>
    </div>
    <p style="font-size:13px;color:var(--muted);margin-top:12px">将提示词复制给 AI 助手，获取 JSON 回复后粘贴到下一步。</p>
  `;
}

function renderWizardStep3() {
  const hasPreview = wizardState.validatedPayload !== null;
  return `
    <div class="wizard-field">
      <label for="wizard-json-input">粘贴 AI 返回的 JSON 内容</label>
      <textarea id="wizard-json-input" class="wizard-textarea wizard-json-area" placeholder='{"version":2,"terms":{...}}'></textarea>
    </div>
    <div class="wizard-actions">
      <div class="wizard-actions-left">
        <button class="btn" data-action="wizard-prev-step2">← 上一步</button>
        <button class="btn" data-action="wizard-validate">验证 JSON</button>
      </div>
      <div class="wizard-actions-right">
        <button class="btn primary" data-action="wizard-apply" ${!hasPreview ? " disabled" : ""}>应用导入</button>
      </div>
    </div>
    ${hasPreview ? renderWizardStep3Preview() : ""}
  `;
}

function renderWizardStep3Preview() {
  const payload = wizardState.validatedPayload;
  if (!payload) return "";
  const terms = payload.terms || {};
  const count = Object.keys(terms).length;
  return `
    <div class="wizard-preview">
      <span class="wizard-preview-stat green">✓ 验证通过</span>
      <span class="wizard-preview-stat blue">${count} 个术语</span>
    </div>
    <div class="wizard-mode-select">
      <label><input type="radio" name="import-mode" value="overwrite" ${wizardState.importMode === "overwrite" ? "checked" : ""} data-action="wizard-set-mode"> 覆盖已有术语</label>
      <label><input type="radio" name="import-mode" value="merge" ${wizardState.importMode === "merge" ? "checked" : ""} data-action="wizard-set-mode"> 仅导入新术语</label>
    </div>
  `;
}

function renderWizardStep4() {
  const result = wizardState.lastResult;
  const history = getImportHistory();
  return `
    ${result ? `
    <div style="margin-bottom:20px">
      <h3 style="margin:0 0 12px">本次导入结果</h3>
      <div class="wizard-preview">
        ${result.summary?.created ? `<span class="wizard-preview-stat green">创建 ${result.summary.created}</span>` : ""}
        ${result.summary?.updated ? `<span class="wizard-preview-stat blue">更新 ${result.summary.updated}</span>` : ""}
        ${result.summary?.skipped ? `<span class="wizard-preview-stat gray">跳过 ${result.summary.skipped}</span>` : ""}
        ${result.summary?.errors?.length ? `<span class="wizard-preview-stat red">错误 ${result.summary.errors.length}</span>` : ""}
      </div>
    </div>
    ` : ""}
    <h3>导入历史</h3>
    ${history.length === 0 ? '<p class="wizard-no-history">暂无导入历史</p>' : `
    <table class="wizard-history-table">
      <thead><tr><th>时间</th><th>术语数</th><th>创建</th><th>更新</th><th>跳过</th><th>错误</th></tr></thead>
      <tbody>
        ${history.map(h => `
        <tr>
          <td>${new Date(h.timestamp).toLocaleString("zh-CN")}</td>
          <td>${h.termCount}</td>
          <td>${h.created || 0}</td>
          <td>${h.updated || 0}</td>
          <td>${h.skipped || 0}</td>
          <td>${h.errors?.length || 0}</td>
        </tr>`).join("")}
      </tbody>
    </table>`}
    <div class="wizard-actions" style="margin-top:20px;justify-content:center">
      <button class="btn primary" data-action="wizard-back">完成</button>
    </div>
  `;
}

/* Wizard event handlers */

window.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "wizard-back") {
    wizardState = null;
    selectDomain(state.currentDomainId);
    return;
  }
  if (action === "wizard-check") {
    const input = document.getElementById("wizard-terms-input");
    if (!input) return;
    wizardState.rawNames = input.value;
    const names = input.value.split("\n").map(s => s.trim()).filter(Boolean);
    // Build title index for fast lookup
    const titleMap = {};
    for (const reg of Object.values(state.termRegistry)) {
      const key = (reg.title || "").toLowerCase();
      if (!titleMap[key]) titleMap[key] = [];
      titleMap[key].push(reg);
    }
    let idx = 0;
    wizardState.termChecks = names.map(name => {
      const lower = name.toLowerCase();
      const matches = titleMap[lower] || [];
      if (matches.length > 0) {
        return { name, isNew: false, domainId: matches[0].domain_id, objectId: matches[0].object_id, termId: matches[0].term_id, selected: true };
      }
      return { name, isNew: true, domainId: null, objectId: null, termId: null, selected: true };
    });
    renderImportWizard();
    return;
  }
  if (action === "wizard-toggle-term") {
    const idx = parseInt(btn.dataset.idx);
    wizardState.termChecks[idx].selected = btn.checked;
    renderImportWizard();
    return;
  }
  if (action === "wizard-select-all") {
    const checked = btn.checked;
    wizardState.termChecks.forEach(t => t.selected = checked);
    renderImportWizard();
    return;
  }
  if (action === "wizard-next-step2") {
    const selected = wizardState.termChecks.filter(t => t.selected);
    if (!selected.length) return;
    // Build prompt
    wizardState.prompt = api.buildImportPrompt(selected, state.taxonomy);
    wizardState.step = 2;
    renderImportWizard();
    return;
  }
  if (action === "wizard-prev-step1") {
    wizardState.step = 1;
    renderImportWizard();
    return;
  }
  if (action === "wizard-copy-prompt") {
    navigator.clipboard.writeText(wizardState.prompt).then(() => toast("已复制到剪贴板")).catch(() => toast("复制失败"));
    return;
  }
  if (action === "wizard-next-step3") {
    wizardState.step = 3;
    renderImportWizard();
    return;
  }
  if (action === "wizard-prev-step2") {
    wizardState.step = 2;
    renderImportWizard();
    return;
  }
  if (action === "wizard-validate") {
    const input = document.getElementById("wizard-json-input");
    if (!input) return;
    try {
      const payload = JSON.parse(input.value);
      if (!payload.terms || typeof payload.terms !== "object") throw new Error("缺少 terms 字段");
      wizardState.validatedPayload = payload;
      renderImportWizard();
    } catch (err) {
      toast("JSON 格式错误：" + err.message);
    }
    return;
  }
  if (action === "wizard-set-mode") {
    wizardState.importMode = btn.value;
    return;
  }
  if (action === "wizard-apply") {
    if (!wizardState.validatedPayload) return;
    btn.disabled = true;
    btn.textContent = "导入中...";
    api.importContent(wizardState.importMode, wizardState.validatedPayload).then(resp => {
      wizardState.lastResult = resp;
      wizardState.step = 4;
      // Save history
      const s = resp.summary || {};
      saveImportHistory({
        timestamp: new Date().toISOString(),
        termCount: Object.keys(wizardState.validatedPayload.terms || {}).length,
        created: s.created || 0,
        updated: s.updated || 0,
        skipped: s.skipped || 0,
        errors: s.errors || [],
        mode: wizardState.importMode,
      });
      // Refresh taxonomy
      return api.getTaxonomy();
    }).then(taxonomy => {
      if (taxonomy) {
        state.taxonomy = taxonomy;
        state.termRegistry = buildTermRegistry(taxonomy);
        renderDomainOptions();
      }
      renderImportWizard();
      toast("导入完成");
    }).catch(err => {
      btn.disabled = false;
      btn.textContent = "应用导入";
      toast("导入失败：" + err.message);
    });
    return;
  }
});


/* ── Boot ── */
init();
