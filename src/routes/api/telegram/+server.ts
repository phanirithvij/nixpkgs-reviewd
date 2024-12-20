import { users, repo } from '#/settings.json'

import { json } from '@sveltejs/kit'

function parseBuildArgs(cmdArgs) {
  let cmd = cmdArgs
  let args = {}
  args['x86_64-linux'] = true
  if (cmd.includes('+nofreespace')) {
    args['free-space'] = false
  }
  if (cmd.includes('+darwin')) {
    args['x86_64-darwin'] = true
    args['aarch64-darwin'] = true
    cmd = cmd.replace('+darwin', '')
  }
  let cmdList = cmd.split(' ').filter(s => s.length > 0)
  let pr = parseInt(cmdList[0])
  args['pr'] = pr
  if (isNaN(pr)) {
    throw "bad pr name: " + cmdList[0]
  }
  cmd = cmdList.slice(1).join(' ')
  args['cmd'] = cmd
  return args
}


export async function POST(event) {
  const genericOKResponse = new Response(":)", {status: 200})
  const genericNOKResponse = new Response(":(", {status: 500})
  const { TELEGRAM_TOKEN, GITHUB_TOKEN } = event.platform.env
  const data = await event.request.json();
  const messageText = data?.message?.text;
  if (!messageText) return genericOKResponse; // update is not a message
  const chatID = data?.message?.from?.id;
  if (!chatID) return genericOKResponse; // chatId is missing, should never happen but check anyway
  const messageID = data?.message?.message_id;
  if (!messageID) return genericOKResponse; // message id to reply, should never happen but check anyway
  if (!users[String(chatID)]) return genericOKResponse; // unauthorized

  async function launchWorkflow(args) {
    const workflowList = await (await fetch(`https://api.github.com/repos/${repo}/actions/workflows`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })).json()
    const thatWorkflows = workflowList.workflows.filter(w => w.path === ".github/workflows/bump.yml")
    if (thatWorkflows.length == 0) {
      throw "that workflow is not defined on " + repo
    }
    const thatWorkflow = thatWorkflows[0].id
    const workflowTrigger = await (await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${thatWorkflow}/dispatches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: args
      })
    })).json()
    return workflowTrigger
  }
  async function respondWith(message: string) {
    console.log({type: 'respond', message, chatID, messageID})
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatID,
        text: message,
        parse_mode: "Markdown",
        reply_parameters: {
          message_id: messageID
        }
      })
    })
    const ret = await res.json()
    console.log({type: 'respond_body', ret})
    return ret
  }
  try {
    console.log({messageText, chatID, messageID, data})
    if (messageText.startsWith('/build')) {
      const buildCmd = messageText.slice(6).trim()
      try {
        const buildArgs = parseBuildArgs(buildCmd)
        const workflow = await launchWorkflow(buildArgs)
        console.log({workflow})
        const result = {workflow, buildArgs}
        await respondWith("command is valid 👍\n```\n" + JSON.stringify(result) + "\n```")

        const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/`)
      } catch (e) {
        await respondWith("error handling the /build command: " + e)
      }
    } else {
      await respondWith("you said: " + messageText)
    }

    return genericOKResponse
  } catch (e) {
    console.log({error})
    return genericNOKResponse
  }
}
