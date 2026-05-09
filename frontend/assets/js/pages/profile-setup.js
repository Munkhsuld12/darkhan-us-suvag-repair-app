import { getToken, getUser, setSession, clearSession } from "../auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const token = getToken();
  const user  = getUser();

  // Нэвтрээгүй бол login руу
  if (!token || !user) {
    window.location.href = "/?login=1";
    return;
  }
  // Профайл бүрэн бол dashboard руу
  if (user.profileComplete) {
    window.location.href = "/app.html";
    return;
  }

  const form      = document.getElementById("setup-form");
  const errEl     = document.getElementById("sp-error");
  const submitBtn = document.getElementById("sp-submit");

  // Утасны дугаарыг урьдчилан бөглөх
  if (user.phone) document.getElementById("sp-phone").value = user.phone;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.style.display = "none";

    const email       = document.getElementById("sp-email").value.trim();
    const phone       = document.getElementById("sp-phone").value.trim();
    const newPassword = document.getElementById("sp-password").value;
    const confirm     = document.getElementById("sp-confirm").value;

    if (newPassword !== confirm) {
      errEl.textContent = "Нууц үг таарахгүй байна";
      errEl.style.display = "";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Хадгалж байна...";

    try {
      const res = await fetch("/api/auth/setup-profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ email, phone, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message);

      // localStorage дахь user-ыг шинэчлэх
      setSession(token, { ...user, email, phone, profileComplete: true });
      window.location.href = "/app.html";
    } catch (err) {
      errEl.textContent = err.message || "Алдаа гарлаа";
      errEl.style.display = "";
      submitBtn.disabled = false;
      submitBtn.textContent = "Хадгалаад нэвтрэх";
    }
  });
});
