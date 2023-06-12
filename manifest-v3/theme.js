const mql = window.matchMedia("(prefers-color-scheme: dark)");

function updateTheme() {
    document.body.dataset.bsTheme = mql.matches ? "dark" : "light";
}

const observer = new MutationObserver(() => {
    if (document.body) {
        updateTheme();
    }
});
observer.observe(document.documentElement, { childList: true });

mql.addEventListener("change", updateTheme);
