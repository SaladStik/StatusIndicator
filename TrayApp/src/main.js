const { invoke } = window.__TAURI__.core;

let apiUrlInput;
let apiKeyInput;
let statusMsg;

function showStatus(message, isError = false) {
  statusMsg.textContent = message;
  statusMsg.className = `status-msg ${isError ? "error" : "success"}`;

  setTimeout(() => {
    statusMsg.className = "status-msg";
  }, 5000);
}

async function loadSettings() {
  try {
    const settings = await invoke("get_settings");
    apiUrlInput.value = settings.api_url;
    apiKeyInput.value = settings.api_key;

    // Load autostart status
    const autostartEnabled = await invoke("is_launch_on_startup");
    document.getElementById("autostart-checkbox").checked = autostartEnabled;
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

async function saveSettings(e) {
  e.preventDefault();

  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiUrl || !apiKey) {
    showStatus("Please fill in all fields", true);
    return;
  }

  try {
    await invoke("save_settings", { apiUrl, apiKey });
    showStatus("Settings saved successfully!");
  } catch (error) {
    showStatus(`Failed to save: ${error}`, true);
  }
}

async function testConnection() {
  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!apiUrl || !apiKey) {
    showStatus("Please fill in all fields first", true);
    return;
  }

  const testBtn = document.getElementById("test-btn");
  testBtn.disabled = true;
  testBtn.textContent = "Testing...";

  try {
    const result = await invoke("test_connection", { apiUrl, apiKey });
    showStatus(result);
  } catch (error) {
    showStatus(`${error}`, true);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test Connection";
  }
}

function togglePasswordVisibility() {
  const toggleBtn = document.getElementById("toggle-key");
  if (apiKeyInput.type === "password") {
    apiKeyInput.type = "text";
    toggleBtn.textContent = "Hide";
  } else {
    apiKeyInput.type = "password";
    toggleBtn.textContent = "Show";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  apiUrlInput = document.getElementById("api-url");
  apiKeyInput = document.getElementById("api-key");
  statusMsg = document.getElementById("status-msg");

  // Hide window instead of closing when X is clicked
  window.__TAURI__.event.listen("tauri://close-requested", async () => {
    const { appWindow } = window.__TAURI__.window;
    await appWindow.hide();
  });

  document
    .getElementById("settings-form")
    .addEventListener("submit", saveSettings);
  document.getElementById("test-btn").addEventListener("click", testConnection);
  document
    .getElementById("toggle-key")
    .addEventListener("click", togglePasswordVisibility);

  // Handle autostart checkbox
  document
    .getElementById("autostart-checkbox")
    .addEventListener("change", async (e) => {
      try {
        await invoke("set_launch_on_startup", {
          enabled: e.target.checked,
        });
      } catch (error) {
        console.error("Failed to set autostart:", error);
        e.target.checked = !e.target.checked; // Revert on error
      }
    });

  loadSettings();
});
