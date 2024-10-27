const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

let tries = 0
let expo = 0

const key = process.env["openai"]

let rateLimit = 0

export const complete = async (context, obj = {}) => {
  const response = await (await fetch("https://api.openai.com/v1/chat/completions", {
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key
    },
    "body": JSON.stringify({
        "model": "gpt-3.5-turbo-0125",
        "messages": context,
        "max_tokens": 2000,
        ...obj
    })
  })).json()
  console.log(response)
  rateLimit = Date.now()
  if (response.error) {
    if (response.error.code === "rate_limit_exceeded") {
      rateLimit = Date.now()
      return complete(context, obj, keyOverride)
    }
    console.log(key)
    if (response.error.code === "insufficient_quota" || response.error.code === "billing_not_active" || response.error.code === "invalid_api_key") {
      throw new Error(response)
    }
    return "Error."
  }
  if (response.detail === "rate limited.") {
    await wait(1000 * (expo ** 2))
    expo += 1
    return complete(context, obj)
  }
  console.log(response)
  return response
}


export const moderate = async (input, obj = {}) => {
    const response = await (await fetch("https://api.openai.com/v1/moderations", {
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key
      },
      "body": JSON.stringify({
          "model": "omni-moderation-latest",
          "input": input,
          ...obj
      })
    })).json()
    console.log(response)
    rateLimit = Date.now()
    if (response.error) {
      if (response.error.code === "rate_limit_exceeded") {
        rateLimit = Date.now()
        return complete(context, obj, keyOverride)
      }
      console.log(key)
      if (response.error.code === "insufficient_quota" || response.error.code === "billing_not_active" || response.error.code === "invalid_api_key") {
        throw new Error(response)
      }
      return "Error."
    }
    if (response.detail === "rate limited.") {
      await wait(1000 * (expo ** 2))
      expo += 1
      return complete(context, obj)
    }
    console.log(response)
    return response
  }