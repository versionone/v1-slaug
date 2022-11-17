# VersionOne Slack Augmentation (v1-slaug)

An application for augmenting your Slack conversations with VersionOne.

## Environment Variables


| Variable | Requirement | Description |
| --- | --- | --- |
| V1_ACCESSTOKEN | *required* | Agility API access token |
| V1_URL | *required* | Agility API URL |
| SLAUG_SECRET | *required for production* | Secret URL route |
| SLAUG_MEMORY | *default `120000`* | Number of ms to remember previous responses, reducing repetitiveness |
| NODE_ENV | *required for production* | Set to `production` |
| PORT | *default 61525* | TCP port on which server listens |
