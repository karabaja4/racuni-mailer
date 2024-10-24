# racuni-mailer

Send generated invoices from the "racuni" app via e-mail.

## Template variables

```
monthNumber
monthName
year
invoiceNumber
```

### Get the code

Use "Application (client) ID" from Azure for the client_id parameter

https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=1e12bb02-8a5a-429b-a866-7077453e3207&response_type=code&redirect_uri=http://localhost/token&scope=User.Read%20Mail.Send%20offline_access