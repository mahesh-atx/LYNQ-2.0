/*
  model-selector.js
  Model selection functionality extracted from script.js
  Handles all model dropdown interactions across the app
*/

// ============================================
// MODEL DROPDOWN (Input Toolbar - Old Style)
// ============================================

function toggleModelDropdown() {
  const dropdown = document.getElementById("model-dropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

function updateModelButton(modelName, iconClass, iconColor) {
  const btn = document.getElementById("current-model-btn");
  if (!btn) return;

  let shortName = modelName.split("/").pop();
  shortName = shortName.replace("Gemini ", "");

  btn.innerHTML = `<i class="fa-solid ${iconClass}" style="color:${iconColor};"></i> ${shortName} <i class="fa-solid fa-chevron-down chevron"></i>`;
}

function selectModel(element, modelName, iconClass, iconColor) {
  currentSelectedModel = modelName;
  updateModelButton(modelName, iconClass, iconColor);

  document.querySelectorAll(".check-icon").forEach((icon) => (icon.style.display = "none"));
  document.querySelectorAll(".model-option").forEach((opt) => opt.classList.remove("selected"));
  element.classList.add("selected");
  element.querySelector(".check-icon").style.display = "block";
  document.getElementById("model-dropdown")?.classList.remove("show");
}

function initializeModelButton() {
  const currentModelElement = document.querySelector(".model-option.selected");
  if (currentModelElement) {
    const onclickAttr = currentModelElement.getAttribute("onclick");

    if (onclickAttr && typeof onclickAttr === "string") {
      const matches = onclickAttr.match(/'([^']*)'/g) || [];

      const modelName = matches[0]?.replace(/'/g, "") || "unknown-model";
      const iconClass = matches[1]?.replace(/'/g, "") || "fa-bolt";
      const iconColor = matches[2]?.replace(/'/g, "") || "#FFD700";

      currentSelectedModel = modelName;
      updateModelButton(modelName, iconClass, iconColor);
    }
  }
}

// ============================================
// HEADER MODEL DROPDOWNS (Tier & Model List)
// ============================================

function toggleHeaderModelDropdown() {
  const dropdown = document.getElementById("header-model-dropdown");
  const btn = document.getElementById("header-model-btn");

  // Close other dropdown if open
  document.getElementById("model-list-dropdown")?.style.setProperty("display", "none");
  document.getElementById("model-list-btn")?.classList.remove("active");

  if (dropdown) {
    const isVisible = dropdown.style.display === "flex";
    dropdown.style.display = isVisible ? "none" : "flex";
    btn?.classList.toggle("active", !isVisible);
  }
}

function toggleModelListDropdown() {
  const dropdown = document.getElementById("model-list-dropdown");
  const btn = document.getElementById("model-list-btn");

  // Close other dropdown if open
  document.getElementById("header-model-dropdown")?.style.setProperty("display", "none");
  document.getElementById("header-model-btn")?.classList.remove("active");

  if (dropdown) {
    const isVisible = dropdown.style.display === "flex";
    dropdown.style.display = isVisible ? "none" : "flex";
    btn?.classList.toggle("active", !isVisible);
  }
}

function selectHeaderTier(element, displayName, description) {
  const headerModelName = document.getElementById("header-model-name");
  if (headerModelName) {
    headerModelName.textContent = displayName;
  }

  const tierItems = document.querySelectorAll("#header-model-dropdown .model-dropdown-item");
  tierItems.forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  document.getElementById("header-model-dropdown").style.display = "none";
  document.getElementById("header-model-btn")?.classList.remove("active");
}

function selectSpecificModel(element, modelName, displayName, description) {
  currentSelectedModel = modelName;

  const listBtnName = document.getElementById("model-list-name");
  if (listBtnName) {
    listBtnName.textContent = displayName;
  }

  const modelItems = document.querySelectorAll("#model-list-dropdown .model-dropdown-item");
  modelItems.forEach(item => item.classList.remove("selected"));
  element.classList.add("selected");

  document.getElementById("model-list-dropdown").style.display = "none";
  document.getElementById("model-list-btn")?.classList.remove("active");
}

function selectHeaderModel(element, modelName, displayName, description) {
  selectSpecificModel(element, modelName, displayName, description);
}

// ============================================
// INPUT MODEL SELECTOR (New Style)
// ============================================

function toggleInputModelDropdown() {
  // On mobile, open the model sheet instead of dropdown
  if (window.innerWidth <= 768) {
    if (typeof toggleMobileModelSheet === "function") {
      toggleMobileModelSheet(true);
    }
    return;
  }

  const dropdown = document.getElementById("input-model-dropdown");
  const btn = document.getElementById("input-model-btn");

  if (dropdown) {
    dropdown.classList.toggle("active");
    btn?.classList.toggle("active", dropdown.classList.contains("active"));
  }
}

function selectInputModel(element, modelId, displayName) {
  currentSelectedModel = modelId;

  const modelNameEl = document.getElementById("input-model-name");
  if (modelNameEl) {
    modelNameEl.textContent = displayName;
  }

  const options = document.querySelectorAll(".input-model-option");
  options.forEach(opt => opt.classList.remove("selected"));
  element.classList.add("selected");

  document.getElementById("input-model-dropdown")?.classList.remove("active");
  const modelBtn = document.getElementById("input-model-btn");
  if (modelBtn) modelBtn.classList.remove("active");
}

// ============================================
// DYNAMIC MODEL FETCHING
// ============================================

async function fetchAvailableModels() {
  try {
    const response = await fetch("/api/models");
    if (!response.ok) throw new Error("Failed to fetch models");
    availableModels = await response.json();
    renderModelDropdown(availableModels);
    // Also render mobile model sheet
    if (typeof renderMobileModelSheet === "function") {
      renderMobileModelSheet(availableModels);
    }
  } catch (error) {
    console.warn("Could not fetch models:", error);
  }
}

function renderModelDropdown(models) {
  const container = document.getElementById("input-model-dropdown");
  if (!container) return;

  container.innerHTML = "";

  // Group models by provider
  const groqModels = models.filter(m => m.provider === "groq");
  const openrouterModels = models.filter(m => m.provider === "openrouter");

  // Helper function to get icon name
  function getIconName(model) {
    const iconMap = {
      "bolt": "zap", "zap": "zap", "star": "star", "diamond": "diamond",
      "flask": "flask-conical", "feather": "feather", "eye": "eye",
      "flame": "flame", "brain": "brain", "code": "code", "layers": "layers",
      "wind": "wind", "sparkles": "sparkles", "gem": "gem", "image": "image"
    };
    return iconMap[model.icon] || "box";
  }

  // Helper function to create model option
  function createModelOption(model) {
    const div = document.createElement("div");
    div.className = `input-model-option ${model.id === currentSelectedModel ? "selected" : ""}`;
    div.onclick = (e) => {
      e.stopPropagation();
      selectInputModel(div, model.id, model.name);
      // Close submenus
      document.querySelectorAll(".provider-submenu").forEach(sm => sm.classList.remove("active"));
    };
    div.innerHTML = `
      <i data-lucide="${getIconName(model)}" style="color: ${model.color || '#ccc'}; width: 16px; height: 16px;"></i>
      <span>${model.name}</span>
      <i data-lucide="check" class="model-check" style="width: 14px; height: 14px;"></i>
    `;
    return div;
  }

  // Helper to create provider section with inline models + submenu for more
  function createProviderSection(providerName, providerIcon, providerColor, providerModels) {
    if (providerModels.length === 0) return null;

    const section = document.createElement("div");
    section.className = "provider-section";

    // Provider header (clickable to show more)
    const header = document.createElement("div");
    header.className = "provider-header";
    const hasMore = providerModels.length > 2;
    header.innerHTML = `
      <i data-lucide="${providerIcon}" style="color: ${providerColor}; width: 14px; height: 14px;"></i>
      <span>${providerName}</span>
      ${hasMore ? '<i data-lucide="chevron-down" class="more-chevron" style="width: 12px; height: 12px; opacity: 0.5;"></i>' : ''}
    `;
    section.appendChild(header);

    // Inline models container (first 2)
    const inlineModels = document.createElement("div");
    inlineModels.className = "inline-models";
    providerModels.slice(0, 2).forEach(model => {
      inlineModels.appendChild(createModelOption(model));
    });
    section.appendChild(inlineModels);

    // Submenu for remaining models (if more than 2)
    if (hasMore) {
      const submenu = document.createElement("div");
      submenu.className = "provider-submenu";
      providerModels.slice(2).forEach(model => {
        submenu.appendChild(createModelOption(model));
      });
      section.appendChild(submenu);

      // Toggle submenu on header click or hover
      header.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".provider-submenu").forEach(sm => {
          if (sm !== submenu) sm.classList.remove("active");
        });
        submenu.classList.toggle("active");
        header.querySelector(".more-chevron")?.classList.toggle("rotated");
      });
    }

    return section;
  }

  // Create Groq section
  const groqSection = createProviderSection("Groq", "zap", "#f59e0b", groqModels);
  if (groqSection) container.appendChild(groqSection);

  // Create OpenRouter section
  const orSection = createProviderSection("OpenRouter", "globe", "#8b5cf6", openrouterModels);
  if (orSection) container.appendChild(orSection);

  // Re-initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Update button text to current model
  const currentModelObj = models.find(m => m.id === currentSelectedModel);
  if (currentModelObj) {
    const modelNameEl = document.getElementById("input-model-name");
    if (modelNameEl) modelNameEl.textContent = currentModelObj.name;
  }
}

// ============================================
// MOBILE MODEL SHEET
// ============================================

let modelSheetTouchStartY = 0;
let modelSheetTouchCurrentY = 0;

function toggleMobileModelSheet(show) {
  const sheet = document.getElementById("mobile-model-sheet");
  const overlay = document.getElementById("mobile-model-overlay");

  if (show) {
    sheet?.classList.add("active");
    overlay?.classList.add("active");
    initModelSheetSwipe();
  } else {
    sheet?.classList.remove("active");
    overlay?.classList.remove("active");
  }
}

function initModelSheetSwipe() {
  const sheet = document.getElementById("mobile-model-sheet");
  if (!sheet) return;

  sheet.addEventListener("touchstart", (e) => {
    modelSheetTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    modelSheetTouchCurrentY = e.touches[0].clientY;
    const diff = modelSheetTouchCurrentY - modelSheetTouchStartY;
    if (diff > 0) {
      sheet.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  sheet.addEventListener("touchend", () => {
    const diff = modelSheetTouchCurrentY - modelSheetTouchStartY;
    if (diff > 100) {
      toggleMobileModelSheet(false);
    }
    sheet.style.transform = "";
    modelSheetTouchStartY = 0;
    modelSheetTouchCurrentY = 0;
  }, { passive: true });
}

function selectMobileSheetModel(element, modelId, displayName) {
  currentSelectedModel = modelId;

  // Update selection in sheet
  document.querySelectorAll(".model-sheet-option").forEach(opt => opt.classList.remove("selected"));
  element.classList.add("selected");

  // Update input button
  const modelNameEl = document.getElementById("input-model-name");
  if (modelNameEl) modelNameEl.textContent = displayName;

  // Also update desktop dropdown if exists
  document.querySelectorAll(".input-model-option").forEach(opt => {
    opt.classList.toggle("selected", opt.dataset?.modelId === modelId);
  });

  // Close sheet
  toggleMobileModelSheet(false);
}

// Dynamic mobile model sheet rendering
function renderMobileModelSheet(models) {
  const listContainer = document.querySelector(".model-sheet-list");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  const groqModels = models.filter(m => m.provider === "groq");
  const openrouterModels = models.filter(m => m.provider === "openrouter");

  function createCompactOption(model) {
    const btn = document.createElement("button");
    btn.className = `model-sheet-option-compact ${model.id === currentSelectedModel ? "selected" : ""}`;
    btn.dataset.modelId = model.id;
    btn.onclick = () => selectMobileSheetModel(btn, model.id, model.name);
    btn.innerHTML = `
      <i class="fa-solid fa-${model.icon === 'zap' ? 'bolt' : model.icon === 'brain' ? 'brain' : model.icon === 'code' ? 'code' : model.icon === 'layers' ? 'layer-group' : model.icon === 'gem' ? 'gem' : model.icon === 'wind' ? 'wind' : model.icon === 'eye' ? 'eye' : 'cube'}" style="color: ${model.color || '#ccc'}"></i>
      <span>${model.name}</span>
      <i class="fa-solid fa-check model-check-icon"></i>
    `;
    return btn;
  }

  // Groq section
  if (groqModels.length > 0) {
    const groqHeader = document.createElement("div");
    groqHeader.className = "mobile-provider-header";
    groqHeader.innerHTML = `<i class="fa-solid fa-bolt" style="color: #f59e0b"></i> Groq`;
    listContainer.appendChild(groqHeader);

    groqModels.forEach(model => {
      listContainer.appendChild(createCompactOption(model));
    });
  }

  // OpenRouter section
  if (openrouterModels.length > 0) {
    const orHeader = document.createElement("div");
    orHeader.className = "mobile-provider-header";
    orHeader.innerHTML = `<i class="fa-solid fa-globe" style="color: #8b5cf6"></i> OpenRouter`;
    listContainer.appendChild(orHeader);

    openrouterModels.forEach(model => {
      listContainer.appendChild(createCompactOption(model));
    });
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initializeModelButton();
  fetchAvailableModels();
});
