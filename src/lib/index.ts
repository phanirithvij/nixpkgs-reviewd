// place files you want to import through the `$lib` alias in this folder.

export function workflowEmoji(workflow) {
  switch (workflow.status) {
    case 'in_progress':
      return '⌛'
    case 'completed':
      switch (workflow.conclusion) {
        case 'cancelled':
          return '🚫'
        case 'failure':
          return '❌'
        case 'success':
          return '✅'
      }
  }
  return '❔'
} 

export async function sleep(time) {
  return new Promise((res, rej) => setTimeout(res, time))
}

export async function ourFetch(url, args) {
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
