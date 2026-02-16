# Fragment: login

Say: Logging in to the app.
Goto routeKey: auth
Fill Email (tour.auth.form.input.email) env:E2E_EMAIL
Fill Password (tour.auth.form.input.password) env:E2E_PASSWORD
Click Login (tour.auth.form.btn.submit)
Wait for Auth Success (tour.event.auth.success) timeout:30000
