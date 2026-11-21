
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");


loginForm.addEventListener("submit", function(event) {
    event.preventDefault();

    sessionStorage.setItem("pitstopDemoUser", "Guest");
    window.location.href = "dashboard.html";
});

registerForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const nickname = document.getElementById("registerNickname").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    sessionStorage.setItem("pitstopDemoUser", nickname);
    window.location.href = "dashboard.html";
});
