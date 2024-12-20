import users from '#/users.json'

import { json } from '@sveltejs/kit'

const genericOKResponse = new Response(":)", {status: 200})
const genericNOKResponse = new Response(":(", {status: 500})

export async function POST(event) {
  const { TELEGRAM_TOKEN } = event.platform.env
  const data = await event.request.json();
  const messageText = data?.message?.text;
  if (!messageText) return genericOKResponse; // update is not a message
  const chatID = data?.message?.from?.id;
  if (!chatID) return genericOKResponse; // chatId is missing, should never happen but check anyway
  const messageID = data?.message?.message_id;
  if (!messageID) return genericOKResponse; // message id to reply, should never happen but check anyway
  if (!users[String(chatID)]) return genericOKResponse; // unauthorized
  async function respondWith(message: string) {
    return await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatID,
        text: messageText,
        reply_parameters: {
          message_id: messageID
        }
      })
    })
  }
  try {
    console.log({messageText, chatID, messageID, data})
    const res = await respondWith(messageText)

    // TODO: handle message

    console.log({result: await res.json()})
    return json(users, {status: 201})
  } catch (e) {
    console.log({error})
    return genericNOKResponse
  }
}
