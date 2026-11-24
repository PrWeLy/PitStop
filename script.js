function bindAuthForm(formId, errorId, endpoint, readData) {
    const form = byId(formId);
    const errorMessage = byId(errorId);
    const submit = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (submit.disabled) return;
        setError(errorMessage);
        submit.disabled = true;

        try {
            await apiRequest(endpoint, { method: "POST", data: readData() });
            window.location.assign("/dashboard.html");
        } catch (error) {
            setError(errorMessage, error.message);
            submit.disabled = false;
        }
    });
}

bindAuthForm("loginForm", "loginError", "login", () => ({
    email: valueOf("loginEmail").trim(),
    password: valueOf("loginPassword")
}));

bindAuthForm("registerForm", "registerError", "register", () => {
    const password = valueOf("registerPassword");
    if (password !== valueOf("confirmPassword")) {
        throw new Error("Passwords do not match.");
    }
    return {
        nickname: valueOf("registerNickname").trim(),
        email: valueOf("registerEmail").trim(),
        password
    };
});

if (new URLSearchParams(window.location.search).has("login")) {
    bootstrap.Modal.getOrCreateInstance(byId("loginModal")).show();
}
