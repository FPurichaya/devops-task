const button = document.querySelector("#record");
const countNode = document.querySelector("#count");
const statusNode = document.querySelector("#status");

function showStatus(message, isError) {
  statusNode.textContent = message;
  if (isError) statusNode.dataset.state = "error";
  else delete statusNode.dataset.state;
}

async function recordClick() {
  button.disabled = true;
  showStatus("Saving…", false);
  try {
    const response = await fetch("/api/clicks", {
      method: "POST",
      headers: { accept: "application/json" },
    });
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (!response.ok) {
      const message =
        body && typeof body.error === "string" && body.error.length <= 120
          ? body.error
          : `Request failed (${response.status})`;
      throw new Error(message);
    }
    if (!Number.isSafeInteger(body.count)) {
      throw new Error("Response did not include a count");
    }
    countNode.textContent = String(body.count);
    showStatus(`Saved in Postgres. Count read back from ${body.source}.`, false);
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Request failed", true);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", () => {
  void recordClick();
});
