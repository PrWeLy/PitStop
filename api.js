async function apiRequest(path, { method = "GET", data } = {}) {
    const options = { method };
    if (data !== undefined) {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(data);
    }

    let response;
    try {
        response = await fetch("/api/" + path, options);
    } catch {
        throw new Error("Could not connect to PitStop. Please try again.");
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        let message = "PitStop could not complete your request. Please try again.";
        if (typeof body.detail === "string") {
            message = body.detail;
        } else if (Array.isArray(body.detail)) {
            message = body.detail.map(({ loc, msg }) => {
                const field = loc.slice(1).join(" ").replaceAll("_", " ");
                return field ? field + ": " + msg : msg;
            }).join(" ");
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return response.status === 204 ? undefined : response.json();
}

const byId = id => document.getElementById(id);
const valueOf = id => byId(id).value;

function setError(element, message = "") {
    element.textContent = message;
    element.classList.toggle("d-none", !message);
}
