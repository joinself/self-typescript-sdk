# Manage connections

Connections allows you manage who can interact with your app. Even your app is intended to interact with everybody, just you or a selected group of users, you can manage connections with three methods `permitConnection`, `revokeConnection` and `allowedConnections`.

## Running this example

In order to run this example, you must have a valid app keypair. Self-keypairs are issued by [Self Developer portal](https://developer.joinself.com/) when you create a new app.

Once you have your valid `SELF_APP_ID` and `SELF_APP_SECRET` you can run this example with:

```bash
$ tsc main.ts && SELF_APP_ID=XXXXX SELF_APP_SECRET=XXXXXXXX SELF_USER_ID="<your_self_id>" node main.js
```
