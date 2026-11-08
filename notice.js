export function showNotice(message) {
  let notice = document.querySelector("#yme-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "yme-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("yme-notice-visible");
  clearTimeout(notice.dismissTimer);
  notice.dismissTimer = setTimeout(() => notice.classList.remove("yme-notice-visible"), 2800);
}
