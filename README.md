# Kaguya bot
Pretty telegram bot that has:
1. Notifications
2. Manga reader

## How to run
### Prepare
Open **config.json** and change **"token"** property to your bot token and then execute:
```bash
npm install
npm run build

# insert default data to datastore
npm run series:insert
```

### Start
```bash
npm run start:cli
# or
npm run start
# if you want to start in detached mode.
```

## License
ISC
