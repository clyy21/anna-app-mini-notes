export async function connectAnnaRuntime() {
  // The Anna harness injects AnnaAppRuntime into the iframe.
  if (!window.AnnaAppRuntime || typeof window.AnnaAppRuntime.connect !== "function") {
    return {
      anna: null,
      runtimeReady: false,
      error: null,
      status: "Runtime unavailable",
      statusClass: "is-warning"
    };
  }

  try {
    return {
      anna: await window.AnnaAppRuntime.connect(),
      runtimeReady: true,
      error: null,
      status: "Runtime connected",
      statusClass: "is-connected"
    };
  } catch (error) {
    return {
      anna: null,
      runtimeReady: false,
      error,
      status: "Runtime failed",
      statusClass: "is-danger"
    };
  }
}
