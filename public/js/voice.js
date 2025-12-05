/*
  voice.js
  This file contains voice recognition functionality.
  Separated from home.js for better maintainability.
*/

/**
 * Initializes voice recognition functionality.
 */
function initVoiceInput() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.log("Web Speech API not supported.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const micBtn = document
        .querySelector(".input-toolbar .fa-microphone-lines")
        ?.closest("button");

    if (micBtn) {
        micBtn.onclick = () => {
            try {
                recognition.start();
                if (typeof showToast === "function")
                    showToast("Listening... Speak now.");
                micBtn.style.color = "#d32f2f";
                micBtn.style.borderColor = "#d32f2f";
            } catch (e) {
                console.error("Voice start error:", e);
            }
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            // chatInput is a global var defined in chat.js
            if (typeof chatInput !== "undefined" && chatInput) {
                chatInput.value += (chatInput.value ? " " : "") + transcript;
                chatInput.style.height = "auto";
                chatInput.style.height = chatInput.scrollHeight + "px";
            }
        };

        recognition.onspeechend = () => {
            recognition.stop();
            if (typeof showToast === "function")
                showToast("Processing voice input...");
            micBtn.style.color = "";
            micBtn.style.borderColor = "";
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            if (typeof showToast === "function")
                showToast("Voice error: " + event.error);
            micBtn.style.color = "";
            micBtn.style.borderColor = "";
        };
    }
}
