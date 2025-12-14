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

    // Check for PDF or Image
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        if (typeof showToast === "function")
            showToast("Only PDF and Image files are supported.");
        fileUploadInput.value = "";
        return;
    }

    const isImage = file.type.startsWith("image/");
    const loadingIcon = isImage ? '<i class="fa-solid fa-image fa-bounce"></i>' : '<i class="fa-solid fa-spinner fa-spin"></i>';
    
    const pill = createAttachmentPill(
        `${loadingIcon} Processing "${file.name}"...`,
        true
    );
    attachmentPreviewContainer.innerHTML = "";
    attachmentPreviewContainer.appendChild(pill);

    try {
        const fileReader = new FileReader();
        fileReader.onload = async function () {
            if (isImage) {
                 // Image Handling
                const base64Data = this.result; // Data URL
                currentAttachment = {
                    name: file.name,
                    data_url: base64Data, // Store full Data URL
                    type: "image",
                    mime_type: file.type
                };

                 // Update pill to show thumbnail if desired, or just icon
                 pill.remove();
                 createAttachmentPill(file.name, false, true, base64Data);

            } else {
                 // PDF Handling (Existing)
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
            }

            if (typeof showToast === "function")
                showToast(`Attached "${file.name}"`);

            // chatInput is a global var defined in chat.js
            if (typeof chatInput !== "undefined" && chatInput) {
                chatInput.focus();
            }
        };

        if (isImage) {
            fileReader.readAsDataURL(file);
        } else {
            fileReader.readAsArrayBuffer(file);
        }

    } catch (error) {
        console.error("Error processing file:", error);
        if (typeof showToast === "function") showToast("Failed to process file.");
        pill.remove();
        currentAttachment = null;
    } finally {
        fileUploadInput.value = "";
    }
}

/**
 * Creates and displays the attachment "pill" above the text input.
 */
function createAttachmentPill(fileName, isProcessing = false, isImage = false, previewUrl = null) {
    const pill = document.createElement("div");
    pill.className = "attachment-pill";

    let icon = isImage ? '<i class="fa-solid fa-image"></i>' : '<i class="fa-solid fa-file-pdf"></i>';
    // If we have a preview URL, use a tiny image thumbnail instead of the icon
    if (isImage && previewUrl) {
         icon = `<img src="${previewUrl}" class="pill-thumb" style="width: 20px; height: 20px; border-radius: 4px; object-fit: cover; vertical-align: middle; margin-right: 5px;">`;
    }

    let nameHTML = `<span>${fileName}</span>`;

    if (isProcessing) {
        nameHTML = fileName; // Should already contain icon html if passed from caller
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

    // Only add icon if it's not processing (caller handles processing icon) or if we want standard icon
    if (!isProcessing) {
         pill.insertAdjacentHTML("afterbegin", `${icon} ${nameHTML}`);
    } else {
         pill.innerHTML = fileName; // fileName contains the spinner HTML
    }

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
