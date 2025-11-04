Register:
```
curl -i --cacert ../certs/localhost.pem \
  -X POST https://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login": "bob", "password": "secret"}'
```

Login (Authenticate and get cookies):

```
curl -i --cacert ../certs/localhost.pem \
  -X POST https://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login": "bob", "password": "secret"}' \
  -c cookies.txt
```

WhoAmI (Get current user):
```
curl -i --cacert ../certs/localhost.pem \
  https://localhost:4000/api/auth/whoami \
  -b cookies.txt
```
Refresh (Renew your access token):
```
curl -i --cacert ../certs/localhost.pem \
  -X POST https://localhost:4000/api/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```
User routes (protected):
```
curl -i --cacert ../certs/localhost.pem \
  https://localhost:4000/api/user/me \
  -b cookies.txt
```
Get all users (admin only):
```
curl -i --cacert ../certs/localhost.pem \
  https://localhost:4000/api/user \
  -b cookies.txt
```

Admin route (protected):
```
curl -i --cacert ../certs/localhost.pem \
  https://localhost:4000/api/admin \
  -b cookies.txt
```
Logout:
```
curl -i --cacert ../certs/localhost.pem \
  -X POST https://localhost:4000/api/auth/logout \
  -b cookies.txt
```