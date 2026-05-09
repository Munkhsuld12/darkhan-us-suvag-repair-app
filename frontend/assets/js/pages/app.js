(function () {
  try {
    var raw   = localStorage.getItem("dhs_user");
    var user  = raw ? JSON.parse(raw) : null;
    var token = localStorage.getItem("dhs_token");
    if (!user || !token) { window.location.replace("/?login=1"); return; }
    if (user.profileComplete === false) { window.location.replace("/profile-setup.html"); return; }
    var map = {
      dispatcher:          "/dispatcher.html",
      general_engineer:    "/engineer.html",
      department_engineer: "/engineer.html",
      brigade_leader:      "/brigade.html",
      admin:               "/admin.html",
    };
    window.location.replace(map[user.role] || "/?login=1");
  } catch (e) {
    window.location.replace("/?login=1");
  }
})();
