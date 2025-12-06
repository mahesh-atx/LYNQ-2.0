/*
  pdf.js
  This file contains PDF upload and handling functionality.
  Separated from home.js for better maintainability.
*/

// --- PDF State ---
let currentAttachment = null; // Holds { name: "...", text: "...", type: "pdf" }

// --- PDF DOM Elements (will be assigned via initPdfElements) ---
let attachFileBtn;
let fileUploadInput;
let attachmentPreviewContainer;

/**
 * Handles the file upload event, specifically for PDFs.
 */
async function handlePdfUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
        if (typeof showToast === "function")
            showToast("Only PDF files are supported.");
        fileUploadInput.value = "";
        return;
    }

    const pill = createAttachmentPill(
        `<i class="fa-solid fa-spinner fa-spin"></i> Processing "${file.name}"...`,
        true
    );
    attachmentPreviewContainer.innerHTML = "";
    attachmentPreviewContainer.appendChild(pill);

    try {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            const typedarray = new Uint8Array(this.result);
            // pdfjsLib is globally available from the script tag in index.html
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let extractedText = "";

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                extractedText +=
                    textContent.items.map((item) => item.str).join(" ") + "\n";
            }

            currentAttachment = {
                name: file.name,
                text: extractedText,
                type: "pdf",
            };

            pill.remove();
            createAttachmentPill(file.name);

            if (typeof showToast === "function")
                showToast(`Attached "${file.name}" (${pdf.numPages} pages)`);

            // chatInput is a global var defined in chat.js
            if (typeof chatInput !== "undefined" && chatInput) {
                chatInput.focus();
            }
        };
        fileReader.readAsArrayBuffer(file);
    } catch (error) {
        console.error("Error parsing PDF:", error);
        if (typeof showToast === "function") showToast("Failed to process PDF.");
        pill.remove();
        currentAttachment = null;
    } finally {
        fileUploadInput.value = "";
    }
}

/**
 * Creates and displays the attachment "pill" above the text input.
 */
function createAttachmentPill(fileName, isProcessing = false) {
    const pill = document.createElement("div");
    pill.className = "attachment-pill";

    let icon = '<i class="fa-solid fa-file-pdf"></i>';
    let nameHTML = `<span>${fileName}</span>`;

    if (isProcessing) {
        nameHTML = fileName;
    } else {
        const closeBtn = document.createElement("button");
        closeBtn.className = "close-btn";
        closeBtn.innerHTML = "&times;";
        closeBtn.title = "Remove file";
        closeBtn.onclick = () => {
            currentAttachment = null;
            pill.remove();
            if (typeof showToast === "function") showToast("Attachment removed.");
        };
        pill.appendChild(closeBtn);
    }

    pill.insertAdjacentHTML("afterbegin", `${icon} ${nameHTML}`);

    if (!isProcessing) {
        attachmentPreviewContainer.innerHTML = "";
        attachmentPreviewContainer.appendChild(pill);
    }

    return pill;
}

/**
 * Clears the current attachment state
 */
function clearAttachment() {
    currentAttachment = null;
    if (attachmentPreviewContainer) {
        attachmentPreviewContainer.innerHTML = "";
    }
}

/**
 * Gets the current attachment
 */
function getCurrentAttachment() {
    return currentAttachment;
}

/**
 * Sets the current attachment (used when loading from history)
 */
function setCurrentAttachment(attachment) {
    currentAttachment = attachment;
}

/**
 * Initializes PDF DOM elements - called from chat.js DOMContentLoaded
 */
function initPdfElements() {
    attachFileBtn = document.getElementById("attach-file-btn");
    fileUploadInput = document.getElementById("file-upload");
    attachmentPreviewContainer = document.getElementById("attachment-preview-container");
}

/**
 * Sets up PDF event listeners - called from chat.js DOMContentLoaded
 */
function initPdfListeners() {
    if (attachFileBtn) {
        attachFileBtn.addEventListener("click", () => {
            // Mobile: Open Action Sheet
            if (window.innerWidth <= 768 && typeof toggleMobileActionSheet === 'function') {
                toggleMobileActionSheet(true);
                return;
            }
            // Desktop: Toggle Attach Dropdown
            const attachDropdown = document.getElementById("attach-dropdown");
            if (attachDropdown) {
                attachDropdown.classList.toggle("active");
                // Close tools dropdown if open
                document.getElementById("tools-dropdown")?.classList.remove("active");
            }
        });
    }

    // Tools button click handler
    const toolsBtn = document.getElementById("tools-btn");
    if (toolsBtn) {
        toolsBtn.addEventListener("click", () => {
            const toolsDropdown = document.getElementById("tools-dropdown");
            if (toolsDropdown) {
                toolsDropdown.classList.toggle("active");
                // Close attach dropdown if open
                document.getElementById("attach-dropdown")?.classList.remove("active");
            }
        });
    }
    if (fileUploadInput) {
        fileUploadInput.addEventListener("change", handlePdfUpload);
    }
}
