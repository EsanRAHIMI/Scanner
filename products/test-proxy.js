fetch("http://localhost:3004/api/trainer/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "content-type": "application/json",
  },
  body: JSON.stringify({ email: "ehsanrahimi8@gmail.com", password: "password" }),
})
.then(r => r.text())
.then(console.log);
