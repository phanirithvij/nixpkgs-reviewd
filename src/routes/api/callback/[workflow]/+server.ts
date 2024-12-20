import { users, repo } from '#/settings.json'
import { EventMethods, workflowEmoji } from '$lib'

import { json } from '@sveltejs/kit'

export async function POST(event) {
  const methods = new EventMethods(event)
  await methods.setup()

  const workflows = await methods.listWorkflowRuns()
  const selectedWorkflows = workflows.filter(w => String(w.id) === event.params.workflow)
  if (selectedWorkflows.length == 0) {
    return await json({error: "Workflow not found"}, {status: 400})
  }
  const selectedWorkflow = selectedWorkflows[0]
  const { id, name, status, conclusion, html_url } = selectedWorkflow
  const triggerData = name.match('for (.*)')
  if (!triggerData) {
    return await json({error: "Can't detect trigger owner"}, {status: 400})
  }
  const triggerUser = triggerData[1]
  const triggerChatIDs = Object.keys(users).find(k => users[k] === String(triggerUser))
  console.log({triggerChatIDs, selectedWorkflow, triggerData})
  if (triggerChatIDs.length == 0) {
    return await json({error: "Can't detect trigger owner"}, {status: 400})
  }
  const triggerChatID = triggerChatIDs[0]
  const emoji = workflowEmoji(selectedWorkflow)

  await methods.telegramReply(`${emoji} **${name}**\n [Result](${html_url})`, triggerChatID)

  return await json(workflows)
}
