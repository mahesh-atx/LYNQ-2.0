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
  } catch (error) {
    console.warn("Could not fetch models:", error);
  }
}

function renderModelDropdown(models) {
  const container = document.getElementById("input-model-dropdown");
  if (!container) return;

  container.innerHTML = "";

  models.forEach(model => {
    let iconName = "box";
    let iconColor = model.color || "#ccc";

    if (model.icon === "bolt" || model.icon === "zap") iconName = "zap";
    else if (model.icon === "star") iconName = "star";
    else if (model.icon === "diamond") iconName = "diamond";
    else if (model.icon === "flask") iconName = "flask-conical";
    else if (model.icon === "feather") iconName = "feather";
    else if (model.icon === "eye") iconName = "eye";
    else if (model.icon === "flame") iconName = "flame";

    const div = document.createElement("div");
    div.className = `input-model-option ${model.id === currentSelectedModel ? "selected" : ""}`;
    div.onclick = () => selectInputModel(div, model.id, model.name);

    div.innerHTML = `
      <i data-lucide="${iconName}" style="color: ${iconColor}; width: 16px; height: 16px;"></i>
      <span>${model.name}</span>
      <i data-lucide="check" class="model-check" style="width: 14px; height: 14px;"></i>
    `;
    
    container.appendChild(div);
  });

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

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initializeModelButton();
  fetchAvailableModels();
});
