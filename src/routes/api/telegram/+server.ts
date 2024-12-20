import { users, repo } from '#/settings.json'
import botHelp from '#/bot_help.txt?raw'

import { json } from '@sveltejs/kit'

function handleError(e) {
  const {message, stack} = e
  console.error({message, stack})
}

async function sleep(time) {
  return new Promise((res, rej) => setTimeout(res, time))
}

function parseBuildArgs(cmdArgs, for_user) {
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
  if (isNaN(pr)) {
    throw new Error("bad pr name: " + cmdList[0])
  }
  args['pr'] = String(pr)
  cmd = cmdList.slice(1).join(' ')
  args['extra-args'] = cmd
  args['for'] = for_user
  return args
}

async function ourFetch(url, args) {
  if (!args.headers) {
    args.headers = {}
  }
  args.headers['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'
  const res = await fetch(url, args)
  let text = await res.text()
  let ret = text
  try {
    ret = JSON.parse(text)
  } catch {}
  console.log({message: (args.method ?? "GET") + " " + url, ret})
  return {
    status: res.status,
    data: ret
  }
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
  const for_user = users[String(chatID)]
  if (!for_user) return genericOKResponse; // unauthorized

  async function getWorkflowId() {
    const workflowList = await ourFetch(`https://api.github.com/repos/${repo}/actions/workflows`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    })
    console.log({workflowList})
    const thatWorkflows = workflowList.data.workflows.filter(w => w.path === ".github/workflows/nixpkgs-review.yml")
    if (thatWorkflows.length == 0) {
      throw new Error("that workflow is not defined on " + repo)
    }
    return thatWorkflows[0].id
  }

  async function listWorkflowRuns() {
    const runs = await ourFetch(`https://api.github.com/repos/${repo}/actions/runs`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Authorization': `Bearer ${GITHUB_TOKEN}`
      }
    })
    return runs.data.workflow_runs.filter(w => w.path === ".github/workflows/nixpkgs-review.yml")
  }

  async function launchWorkflow(args) {
    const thatWorkflow = await getWorkflowId()
    const workflowTrigger = await ourFetch(`https://api.github.com/repos/${repo}/actions/workflows/${thatWorkflow}/dispatches`, {
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
    }) // returns empty string
    console.log({message: "workflow trigger", workflowTrigger})
    if (workflowTrigger.status != 204) {
      throw new Error(workflowTrigger.data.message)
    }
    await sleep(2000)
    const runs = await listWorkflowRuns()
    const filteredRuns = runs.filter(w => w.name.includes(String(args.pr)))
    if (filteredRuns.length == 0) {
      throw new Error("not created")
    }
    return filteredRuns[0].html_url
  }
  async function respondWith(message: string) {
    console.log({type: 'respond', message, chatID, messageID})
    return await ourFetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
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
  }
  try {
    console.log({messageText, chatID, messageID, data})
    if (messageText.startsWith('/list')) {
      try {
        const runs = await listWorkflowRuns()
        const message = runs.map(r => `• [${r.name}](${r.html_url})`).join('\n')
        await respondWith(message)
      } catch (error) {
        handleError(error)
        await respondWith("error handling the /list command: " + error.message)
      }
    } else if (messageText.startsWith('/build')) {
      const buildCmd = messageText.slice(6).trim()
      try {
        const buildArgs = parseBuildArgs(buildCmd, for_user)
        const workflow = await launchWorkflow(buildArgs)
        await respondWith("launched review with args 👍\n```\n" + JSON.stringify(buildArgs) + "\n```\n\n" + workflow)
      } catch (error) {
        handleError(error)
        await respondWith("error handling the /build command: " + error.message)
      }
    } else {
      await respondWith(botHelp)
    }
    return genericOKResponse
  } catch (error) {
    handleError(error)
    return genericNOKResponse
  }
}
