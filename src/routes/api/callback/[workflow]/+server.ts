import { users, repo } from '#/settings.json'
import { EventMethods, workflowEmoji } from '$lib'

import { json } from '@sveltejs/kit'

export async function POST(event) {
  const methods = new EventMethods(event)
  await methods.setup()

  const workflows = await methods.listWorkflowRuns()
  const selectedWorkflow = workflows.find(w => String(w.id) === event.params.workflow)
  if (!selectedWorkflow) {
    return await json({error: "Workflow not found"}, {status: 400})
  }
  const { id, name, status, conclusion, html_url } = selectedWorkflow
  const triggerData = name.match('for (.*)')
  if (!triggerData) {
    return await json({error: "Can't detect trigger owner"}, {status: 400})
  }
  const triggerUser = triggerData[1]
  const triggerChatID = Object.keys(users).find(k => users[k] === String(triggerUser))
  console.log({triggerChatID, selectedWorkflow, triggerData})
  if (!triggerChatID) {
    return await json({error: "Can't detect trigger owner"}, {status: 400})
  }
  const emoji = workflowEmoji(selectedWorkflow)

  return await json(await methods.telegramReply(`${emoji} **${name}**\n [Result](${html_url})`, triggerChatID), {status: 200})
}
