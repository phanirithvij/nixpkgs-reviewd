# nixpkgs-reviewd

Cloudflare Worker + GitHub Action workflow to launch nixpkgs-review from a Telegram bot

## Setup
- [ ] Create a GitHub token with full repo scope, let's call it `GITHUB_TOKEN`.
  - This is required for nixpkgs-review to comment on nixpkgs PRs and for Cloudflare Workers to launch the GitHub Actions.
- [ ] Create a Telegram token using the [botfather](https://t.me/BotFather), let's call it `TELEGRAM_TOKEN`.
  - This is required to setup a bot account in Telegram.
- [ ] Get the chat IDs of the Telegram chats you want to allow to use the bot and add them in `settings.json`.
- [ ] If this is a fork, set the repo key of `settings.json` in the form `user/repository`.
- [ ] Deploy this repository as a Cloudflare Worker. It will receive a domain, let's call it `DOMAIN`.
- [ ] Set `GITHUB_TOKEN` and `TELEGRAM_TOKEN` as secrets in the Cloudflare Workers settings. You can do that using wrangler too!
- [ ] In the repo settings, go to Webhooks and create one.
  - **Payload URL**: `DOMAIN`/api/callback.
  - **Content type**: `application/json`.
  - **Which events would you like to trigger this webhook**: let me select individual events, Workflow runs.
  - **Active**: checked
- [ ] In the repo settings, go to Secrets and Variables, then Actions and add `GITHUB_TOKEN` as a secret named as `GH_TOKEN_NIXPKGS_REVIEW`.
- [ ] To test with a quick action, change the name after "for" in the run-name field in `.github/workflows/finish-fast.yml` to the name that you set for your chat then run this action in the `Actions` tab. A message telling the workflow is complete should appear.
- [ ] Call `setWebhook` in the Telegram API, so Telegram notifies the worker new messages arrived.
  - `curl -X POST https://api.telegram.org/botTELEGRAM_TOKEN/setWebhook -F max_connections=2 -F allowed_updates=message -F url=DOMAIN/api/telegram`.
  - Make sure to replace all the previously defined names to their real values!
- [ ] Open Telegram in one of the chats you've granted access.
  - The safest way to test is to grant access to your user ID. On private conversations, your user ID is the same as the chat ID. Channels and groups can be a little more error-prone and the bot may not be notified of messages that do not mention it unless the bot is added as an administrator. 
  - Send `/list` to list the running and ran workflows. Not sure if it would work if there is none tho.
  - Send anything that doesn't start with `/list` or `/build` to see help of the commands.

## Usage
See bot_help.txt. That's the exact help text sent to the users!

## Security

> [!WARNING]
> Be careful about who you give access to this. The nixpkgs argument flag can allow someone to inject a curl|bash and steal the GitHub token in the workflow.

## Stack and features
This system is divided in two parts:
### The action part
- The part which comments what it is going to do and give relevant links such as realtime build logs.
- The cleanup workflow: Allows GitHub Actions to build bigger PRs.
  - If it's enabled it frees space, so the available space is about 100 to 120GB.
  - The merged part is mounted using BTRFS's compression, and BTRFS tests the compression if it's worth it before allowing it to continue. 
  - The cache workflow: Allow fast reuse of the nixpkgs clone.
- DetSys Nix installer.
- DetSys's magic-nix-cache: nix cache to reuse in builds that uses GitHub caching system. Can handle 429
(too many requests) errors gracefully.
- nixpkgs-review
- Builders for each target. Darwin builds are opt-in per PR basis.

### The cloudflare worker part
- SvelteKit
  - Integrates nicely with Cloudflare Workers and allow the user to define API routes in the application.
  - It uses filesystem based routing, which is explicit. Also allows frontend componentization, but we are
  not using this extensively so far, but we can!.
  - Because of Vite (bundler), we can import text files!
- Raw HTTP handling for Telegram: Our scope with Telegram is very small.
- Callback system to notify back when builds are done.

### Characteristics
- Really big PRs can timeout after about 6h, but running it again will basically resume the builds. Tested with #367050 in two rounds.
- Nix flag `-L` is disabled on purpose because output floods and the log view stops working even with not so big PRs.
- All logs are uploaded as artifacts at the end of the build.

