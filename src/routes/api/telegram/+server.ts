import users from '#/users.json'

import { json } from '@sveltejs/kit'

// import { TELEGRAM_TOKEN } from '$env/static/private'


const genericOKResponse = new Response(":)", {status: 200})

export async function POST(event) {
  const data = await event.request.json();
  const messageText = data?.message?.text;
  if (!messageText) return genericOKResponse; // update is not a message
  const chatID = data?.message?.from?.id;
  if (!chatID) return genericOKResponse; // chatId is missing, should never happen but check anyway
  const messageID = data?.message?.message_id;
  if (!messageID) return genericOKResponse; // message id to reply, should never happen but check anyway
  if (!users[String(chatID)]) return genericOKResponse; // unauthorized

  // TODO: handle message
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    body: {
      chat_id: chatID,
      text: messageText,
      reply_parameters: {
        message_id: messageID
      }
    }
  })
  return json(users, {status: 201})
}
