import { getToken, getUser, setSession } from "../auth.js";
import { getMe, updateProfile } from "../api.js";

document.addEventListener("DOMContentLoaded", async () => {
  const token = getToken();
  let user  = getUser();

  // Нэвтрээгүй бол login руу
  if (!token || !user) {
    window.location.href = "/?login=1";
    return;
  }
  const form      = document.getElementById("setup-form");
  const errEl     = document.getElementById("sp-error");
  const successEl = document.getElementById("sp-success");
  const submitBtn = document.getElementById("sp-submit");
  const backBtn   = document.getElementById("sp-back");
  const isEditMode = user.profileComplete !== false;
  const passwordEl = document.getElementById("sp-password");
  const confirmEl  = document.getElementById("sp-confirm");
  const currentPasswordEl = document.getElementById("sp-current-password");

  if (isEditMode) {
    document.getElementById("sp-subtitle").textContent = "Миний мэдээлэл";
    document.getElementById("sp-title").textContent = "Хувийн мэдээллээ засах";
    document.getElementById("sp-help").textContent = "Нэр, утас, и-мэйлээ шинэчилж болно. Нууц үгээ солихгүй бол нууц үгийн талбаруудыг хоосон үлдээнэ үү.";
    document.getElementById("sp-password-required").style.display = "none";
    document.getElementById("sp-confirm-required").style.display = "none";
    passwordEl.required = false;
    confirmEl.required = false;
    backBtn.style.display = "";
    submitBtn.textContent = "Хадгалах";
  } else {
    currentPasswordEl.closest(".field").style.display = "none";
  }

  backBtn.addEventListener("click", () => {
    window.location.href = "/app.html";
  });

  try {
    const me = await getMe();
    user = { ...user, ...me.user };
    setSession(token, user);
  } catch {
    // localStorage дахь мэдээллээр үргэлжлүүлнэ
  }

  if (user.fullName) document.getElementById("sp-fullname").value = user.fullName;
  if (user.username) document.getElementById("sp-username").value = user.username;
  if (user.phone) document.getElementById("sp-phone").value = user.phone;
  if (user.email) document.getElementById("sp-email").value = user.email;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.style.display = "none";
    successEl.style.display = "none";

    const fullName    = document.getElementById("sp-fullname").value.trim();
    const username    = document.getElementById("sp-username").value.trim();
    const phone       = document.getElementById("sp-phone").value.trim();
    const email       = document.getElementById("sp-email").value.trim();
    const currentPassword = currentPasswordEl.value;
    const newPassword = passwordEl.value;
    const confirm     = confirmEl.value;

    if (!fullName) {
      errEl.textContent = "Бүтэн нэрийг оруулна уу";
      errEl.style.display = "";
      return;
    }
    if (!username) {
      errEl.textContent = "Нэвтрэх нэрийг оруулна уу";
      errEl.style.display = "";
      return;
    }
    if (!isEditMode && !newPassword) {
      errEl.textContent = "Шинэ нууц үгээ оруулна уу.";
      errEl.style.display = "";
      return;
    }
    if (newPassword !== confirm) {
      errEl.textContent = "Оруулсан нууц үгс хоорондоо таарахгүй байна.";
      errEl.style.display = "";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Хадгалж байна...";

    try {
      let data;
      if (isEditMode) {
        data = await updateProfile({ fullName, username, email, phone, currentPassword, newPassword });
      } else {
        const res = await fetch("/api/auth/setup-profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ fullName, username, email, phone, newPassword }),
        });
        data = await res.json();
        if (!data.ok) throw new Error(data.message);
      }

      // localStorage дахь user-ыг шинэчлэх
      // Нууц үг солигдсон бол сервер шинэ token буцаана (хуучин token хүчингүй болсон)
      setSession(data.token || token, { ...user, fullName, username, email, phone, profileComplete: true });
      if (isEditMode) {
        currentPasswordEl.value = "";
        passwordEl.value = "";
        confirmEl.value = "";
        successEl.style.display = "";
        submitBtn.disabled = false;
        submitBtn.textContent = "Хадгалах";
      } else {
        window.location.href = "/app.html";
      }
    } catch (err) {
      errEl.textContent = err.message || "Алдаа гарлаа";
      errEl.style.display = "";
      submitBtn.disabled = false;
      submitBtn.textContent = isEditMode ? "Хадгалах" : "Хадгалаад нэвтрэх";
    }
  });
});
