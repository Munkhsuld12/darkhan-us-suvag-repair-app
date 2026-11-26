const params = new URLSearchParams(location.search);
const token  = params.get("token");

const form      = document.getElementById("rp-form");
const invalid   = document.getElementById("rp-invalid");
const success   = document.getElementById("rp-success");
const errEl     = document.getElementById("rp-error");
const submitBtn = document.getElementById("rp-submit");

if (!token) {
  invalid.style.display = "";
} else {
  form.style.display = "";
}

document.getElementById("rp-toggle").addEventListener("click", () => {
  const inp = document.getElementById("rp-password");
  inp.type = inp.type === "password" ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById("rp-password").value;
  const confirm     = document.getElementById("rp-confirm").value;

  errEl.style.display = "none";
  if (newPassword !== confirm) {
    errEl.textContent = "Оруулсан нууц үгс хоорондоо таарахгүй байна.";
    errEl.style.display = "";
    return;
  }
  if (newPassword.length < 8) {
    errEl.textContent = "Нууц үг 8-аас доошгүй тэмдэгттэй байх ёстой.";
    errEl.style.display = "";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Хадгалж байна…";
  try {
    const res  = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!data.ok) {
      errEl.textContent = data.message;
      errEl.style.display = "";
      if (res.status === 400 && data.message.includes("хугацаа")) {
        form.style.display   = "none";
        invalid.style.display = "";
      }
      return;
    }
    form.style.display    = "none";
    success.style.display = "";
  } catch {
    errEl.textContent = "Сервертэй холбогдоход алдаа гарлаа. Дахин оролдоно уу.";
    errEl.style.display = "";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Хадгалах";
  }
});
