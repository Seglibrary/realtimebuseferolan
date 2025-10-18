Audio and speech
================

Explore audio and speech features in the OpenAI API.

The OpenAI API provides a range of audio capabilities. If you know what you want to build, find your use case below to get started. If you're not sure where to start, read this page as an overview.

Build with audio
----------------

[

![Build voice agents](https://cdn.openai.com/API/docs/images/voice-agents-rounded.png)

Build voice agents

Build interactive voice-driven applications.

](/docs/guides/voice-agents)[

![Transcribe audio](https://cdn.openai.com/API/docs/images/stt-rounded.png)

Transcribe audio

Convert speech to text instantly and accurately.

](/docs/guides/speech-to-text)[

![Speak text](https://cdn.openai.com/API/docs/images/tts-rounded.png)

Speak text

Turn text into natural-sounding speech in real time.

](/docs/guides/text-to-speech)

A tour of audio use cases
-------------------------

LLMs can process audio by using sound as input, creating sound as output, or both. OpenAI has several API endpoints that help you build audio applications or voice agents.

### Voice agents

Voice agents understand audio to handle tasks and respond back in natural language. There are two main ways to approach voice agents: either with speech-to-speech models and the [Realtime API](/docs/guides/realtime), or by chaining together a speech-to-text model, a text language model to process the request, and a text-to-speech model to respond. Speech-to-speech is lower latency and more natural, but chaining together a voice agent is a reliable way to extend a text-based agent into a voice agent. If you are already using the [Agents SDK](/docs/guides/agents), you can [extend your existing agents with voice capabilities](https://openai.github.io/openai-agents-python/voice/quickstart/) using the chained approach.

### Streaming audio

Process audio in real time to build voice agents and other low-latency applications, including transcription use cases. You can stream audio in and out of a model with the [Realtime API](/docs/guides/realtime). Our advanced speech models provide automatic speech recognition for improved accuracy, low-latency interactions, and multilingual support.

### Text to speech

For turning text into speech, use the [Audio API](/docs/api-reference/audio/) `audio/speech` endpoint. Models compatible with this endpoint are `gpt-4o-mini-tts`, `tts-1`, and `tts-1-hd`. With `gpt-4o-mini-tts`, you can ask the model to speak a certain way or with a certain tone of voice.

### Speech to text

For speech to text, use the [Audio API](/docs/api-reference/audio/) `audio/transcriptions` endpoint. Models compatible with this endpoint are `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1`, and `gpt-4o-transcribe-diarize`. `gpt-4o-transcribe-diarize` adds speaker labels and timestamps for HTTP requests and is intended for non-latency-sensitive workloads, while the other models focus on transcription only. With streaming, you can continuously pass in audio and get a continuous stream of text back.

Choosing the right API
----------------------

There are multiple APIs for transcribing or generating audio:

|API|Supported modalities|Streaming support|
|---|---|---|
|Realtime API|Audio and text inputs and outputs|Audio streaming in and out|
|Chat Completions API|Audio and text inputs and outputs|Audio streaming out|
|Transcription API|Audio inputs|Audio streaming out|
|Speech API|Text inputs and audio outputs|Audio streaming out|

### General use APIs vs. specialized APIs

The main distinction is general use APIs vs. specialized APIs. With the Realtime and Chat Completions APIs, you can use our latest models' native audio understanding and generation capabilities and combine them with other features like function calling. These APIs can be used for a wide range of use cases, and you can select the model you want to use.

On the other hand, the Transcription, Translation and Speech APIs are specialized to work with specific models and only meant for one purpose.

### Talking with a model vs. controlling the script

Another way to select the right API is asking yourself how much control you need. To design conversational interactions, where the model thinks and responds in speech, use the Realtime or Chat Completions API, depending if you need low-latency or not.

You won't know exactly what the model will say ahead of time, as it will generate audio responses directly, but the conversation will feel natural.

For more control and predictability, you can use the Speech-to-text / LLM / Text-to-speech pattern, so you know exactly what the model will say and can control the response. Please note that with this method, there will be added latency.

This is what the Audio APIs are for: pair an LLM with the `audio/transcriptions` and `audio/speech` endpoints to take spoken user input, process and generate a text response, and then convert that to speech that the user can hear.

### Recommendations

*   If you need [real-time interactions](/docs/guides/realtime-conversations) or [transcription](/docs/guides/realtime-transcription), use the Realtime API.
*   If realtime is not a requirement but you're looking to build a [voice agent](/docs/guides/voice-agents) or an audio-based application that requires features such as [function calling](/docs/guides/function-calling), use the Chat Completions API.
*   For use cases with one specific purpose, use the Transcription, Translation, or Speech APIs.

Add audio to your existing application
--------------------------------------

Models such as GPT-4o or GPT-4o mini are natively multimodal, meaning they can understand and generate multiple modalities as input and output.

If you already have a text-based LLM application with the [Chat Completions endpoint](/docs/api-reference/chat/), you may want to add audio capabilities. For example, if your chat application supports text input, you can add audio input and output—just include `audio` in the `modalities` array and use an audio model, like `gpt-4o-audio-preview`.

Audio is not yet supported in the [Responses API](/docs/api-reference/chat/completions/responses).

Audio output from model

Create a human-like audio response to a prompt

```javascript
import { writeFileSync } from "node:fs";
import OpenAI from "openai";

const openai = new OpenAI();

// Generate an audio response to the given prompt
const response = await openai.chat.completions.create({
  model: "gpt-4o-audio-preview",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [
    {
      role: "user",
      content: "Is a golden retriever a good family dog?"
    }
  ],
  store: true,
});

// Inspect returned data
console.log(response.choices[0]);

// Write audio data to a file
writeFileSync(
  "dog.wav",
  Buffer.from(response.choices[0].message.audio.data, 'base64'),
  { encoding: "utf-8" }
);
```

```python
import base64
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-4o-audio-preview",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[
        {
            "role": "user",
            "content": "Is a golden retriever a good family dog?"
        }
    ]
)

print(completion.choices[0])

wav_bytes = base64.b64decode(completion.choices[0].message.audio.data)
with open("dog.wav", "wb") as f:
    f.write(wav_bytes)
```

```bash
curl "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
      "model": "gpt-4o-audio-preview",
      "modalities": ["text", "audio"],
      "audio": { "voice": "alloy", "format": "wav" },
      "messages": [
        {
          "role": "user",
          "content": "Is a golden retriever a good family dog?"
        }
      ]
    }'
```

Audio input to model

Use audio inputs for prompting a model

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

// Fetch an audio file and convert it to a base64 string
const url = "https://cdn.openai.com/API/docs/audio/alloy.wav";
const audioResponse = await fetch(url);
const buffer = await audioResponse.arrayBuffer();
const base64str = Buffer.from(buffer).toString("base64");

const response = await openai.chat.completions.create({
  model: "gpt-4o-audio-preview",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this recording?" },
        { type: "input_audio", input_audio: { data: base64str, format: "wav" }}
      ]
    }
  ],
  store: true,
});

console.log(response.choices[0]);
```

```python
import base64
import requests
from openai import OpenAI

client = OpenAI()

# Fetch the audio file and convert it to a base64 encoded string
url = "https://cdn.openai.com/API/docs/audio/alloy.wav"
response = requests.get(url)
response.raise_for_status()
wav_data = response.content
encoded_string = base64.b64encode(wav_data).decode('utf-8')

completion = client.chat.completions.create(
    model="gpt-4o-audio-preview",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[
        {
            "role": "user",
            "content": [
                { 
                    "type": "text",
                    "text": "What is in this recording?"
                },
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": encoded_string,
                        "format": "wav"
                    }
                }
            ]
        },
    ]
)

print(completion.choices[0].message)
```

```bash
curl "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -d '{
      "model": "gpt-4o-audio-preview",
      "modalities": ["text", "audio"],
      "audio": { "voice": "alloy", "format": "wav" },
      "messages": [
        {
          "role": "user",
          "content": [
            { "type": "text", "text": "What is in this recording?" },
            { 
              "type": "input_audio", 
              "input_audio": { 
                "data": "<base64 bytes here>", 
                "format": "wav" 
              }
            }
          ]
        }
      ]
    }'
```

Was this page useful?




Realtime API
============

Build low-latency, multimodal LLM applications with the Realtime API.

The OpenAI Realtime API enables low-latency communication with [models](/docs/models) that natively support speech-to-speech interactions as well as multimodal inputs (audio, images, and text) and outputs (audio and text). These APIs can also be used for [realtime audio transcription](/docs/guides/realtime-transcription).

Voice agents
------------

One of the most common use cases for the Realtime API is building voice agents for speech-to-speech model interactions in the browser. Our recommended starting point for these types of applications is the [Agents SDK for TypeScript](https://openai.github.io/openai-agents-js/guides/voice-agents/), which uses a [WebRTC connection](/docs/guides/realtime-webrtc) to the Realtime model in the browser, and [WebSocket](/docs/guides/realtime-websocket) when used on the server.

```js
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const agent = new RealtimeAgent({
    name: "Assistant",
    instructions: "You are a helpful assistant.",
});

const session = new RealtimeSession(agent);

// Automatically connects your microphone and audio output
await session.connect({
    apiKey: "<client-api-key>",
});
```

[

Voice Agent Quickstart

Follow the voice agent quickstart to build Realtime agents in the browser.

](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)

To use the Realtime API directly outside the context of voice agents, check out the other connection options below.

Connection methods
------------------

While building [voice agents with the Agents SDK](https://openai.github.io/openai-agents-js/guides/voice-agents/) is the fastest path to one specific type of application, the Realtime API provides an entire suite of flexible tools for a variety of use cases.

There are three primary supported interfaces for the Realtime API:

[

WebRTC connection

Ideal for browser and client-side interactions with a Realtime model.

](/docs/guides/realtime-webrtc)[

WebSocket connection

Ideal for middle tier server-side applications with consistent low-latency network connections.

](/docs/guides/realtime-websocket)[

SIP connection

Ideal for VoIP telephony connections.

](/docs/guides/realtime-sip)

Depending on how you'd like to connect to a Realtime model, check out one of the connection guides above to get started. You'll learn how to initialize a Realtime session, and how to interact with a Realtime model using client and server events.

API Usage
---------

Once connected to a realtime model using one of the methods above, learn how to interact with the model in these usage guides.

*   **[Prompting guide](/docs/guides/realtime-models-prompting):** learn tips and best practices for prompting and steering Realtime models.
*   **[Managing conversations](/docs/guides/realtime-conversations):** Learn about the Realtime session lifecycle and the key events that happen during a conversation.
*   **[Webhooks and server-side controls](/docs/guides/realtime-server-controls):** Learn how you can control a Realtime session on the server to call tools and implement guardrails.
*   **[Realtime audio transcription](/docs/guides/realtime-transcription):** Transcribe audio streams in real time over a WebSocket connection.

Beta to GA migration
--------------------

There are a few key differences between the interfaces in the Realtime beta API and the recently released GA API. Expand the topics below for more information about migrating from the beta interface to GA.

Beta header

For REST API requests, WebSocket connections, and other interfaces with the Realtime API, beta users had to include the following header with each request:

```text
OpenAI-Beta: realtime=v1
```

This header should be removed for requests to the GA interface. To retain the behavior of the beta API, you should continue to include this header.

Generating ephemeral API keys

In the beta interface, there were multiple endpoints for generating ephemeral keys for either Realtime sessions or transcription sessions. In the GA interface, there is only one REST API endpoint used to generate keys - [`POST /v1/realtime/client_secrets`](/docs/api-reference/realtime-sessions/create-realtime-client-secret).

To create a session and receive a client secret you can use to initialize a WebRTC or WebSocket connection on a client, you can request one like this using the appropriate session configuration:

```javascript
const sessionConfig = JSON.stringify({
    session: {
        type: "realtime",
        model: "gpt-realtime",
        audio: {
            output: { voice: "marin" },
        },
    },
});

const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    },
    body: sessionConfig,
});

const data = await response.json();
console.log(data.value); // e.g. ek_68af296e8e408191a1120ab6383263c2
```

These tokens can safely be used in client environments like browsers and mobile applications.

New URL for WebRTC SDP data

When initializing a WebRTC session in the browser, the URL for obtaining remote session information via SDP is now `/v1/realtime/calls`:

```javascript
const baseUrl = "https://api.openai.com/v1/realtime/calls";
const model = "gpt-realtime";
const sdpResponse = await fetch(baseUrl, {
    method: "POST",
    body: offer.sdp,
    headers: {
        Authorization: `Bearer YOUR_EPHEMERAL_KEY_HERE`,
        "Content-Type": "application/sdp",
    },
});

const sdp = await sdpResponse.text();
const answer = { type: "answer", sdp };
await pc.setRemoteDescription(answer);
```

New event names and shapes

When creating or [updating](/docs/api-reference/realtime_client_events/session/update) a Realtime session in the GA interface, you must now specify a session type, since now the same client event is used to create both speech-to-speech and transcription sessions. The options for the session type are:

*   `realtime` for speech-to-speech
*   `transcription` for realtime audio transcription

```javascript
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
    headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
});

ws.on("open", function open() {
    console.log("Connected to server.");

    // Send client events over the WebSocket once connected
    ws.send(
        JSON.stringify({
            type: "session.update",
            session: {
                type: "realtime",
                instructions: "Be extra nice today!",
            },
        })
    );
});
```

Configuration for input modalities and other properties have moved as well, notably output audio configuration like model voice. [Check the API reference](/docs/api-reference/realtime_client_events) for the latest event shapes.

```javascript
ws.on("open", function open() {
    ws.send(
        JSON.stringify({
            type: "session.update",
            session: {
                type: "realtime",
                model: "gpt-realtime",
                audio: {
                    output: { voice: "marin" },
                },
            },
        })
    );
});
```

Finally, some event names have changed to reflect their new position in the event data model:

*   **`response.text.delta` → `response.output_text.delta`**
*   **`response.audio.delta` → `response.output_audio.delta`**
*   **`response.audio_transcript.delta` → `response.output_audio_transcript.delta`**

New conversation item events

For `response.output_item`, the API has always had both `.added` and `.done` events, but for conversation level items the API previously only had `.created`, which by convention is emitted at the start when the item added.

We have added a `.added` and `.done` event to allow better ergonomics for developers when receiving events that need some loading time (such as MCP tool listing or input audio transcriptions if these were to be modeled as items in the future).

Current event shape for conversation items added:

```javascript
{
    "event_id": "event_1920",
    "type": "conversation.item.created",
    "previous_item_id": "msg_002",
    "item": Item
}
```

New events to replace the above:

```javascript
{
    "event_id": "event_1920",
    "type": "conversation.item.added",
    "previous_item_id": "msg_002",
    "item": Item
}
```

```javascript
{
    "event_id": "event_1920",
    "type": "conversation.item.done",
    "previous_item_id": "msg_002",
    "item": Item
}
```

Input and output item changes

### All Items

Realtime API sets an `object=realtime.item` param on all items in the GA interface.

### Function Call Output

`status` : Realtime now accepts a no-op `status` field for the function call output item param. This aligns with the Responses API implementation.

### Message

**Assistant Message Content**

The `type` properties of output assistant messages now align with the Responses API:

*   `type=text` → `type=output_text` (no change to `text` field name)
*   `type=audio` → `type=output_audio` (no change to `audio` field name)

Was this page useful?





Realtime API with WebSocket
===========================

Connect to the Realtime API using WebSockets on a server.

[WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) are a broadly supported API for realtime data transfer, and a great choice for connecting to the OpenAI Realtime API in server-to-server applications. For browser and mobile clients, we recommend connecting via [WebRTC](/docs/guides/realtime-webrtc).

In a server-to-server integration with Realtime, your backend system will connect via WebSocket directly to the Realtime API. You can use a [standard API key](/settings/organization/api-keys) to authenticate this connection, since the token will only be available on your secure backend server.

![connect directly to realtime API](https://openaidevs.retool.com/api/file/464d4334-c467-4862-901b-d0c6847f003a)

Connect via WebSocket
---------------------

Below are several examples of connecting via WebSocket to the Realtime API. In addition to using the WebSocket URL below, you will also need to pass an authentication header using your OpenAI API key.

It is possible to use WebSocket in browsers with an ephemeral API token as shown in the [WebRTC connection guide](/docs/guides/realtime-webrtc), but if you are connecting from a client like a browser or mobile app, WebRTC will be a more robust solution in most cases.

ws module (Node.js)

Connect using the ws module (Node.js)

```javascript
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
  headers: {
    Authorization: "Bearer " + process.env.OPENAI_API_KEY,
  },
});

ws.on("open", function open() {
  console.log("Connected to server.");
});

ws.on("message", function incoming(message) {
  console.log(JSON.parse(message.toString()));
});
```

websocket-client (Python)

Connect with websocket-client (Python)

```python
# example requires websocket-client library:
# pip install websocket-client

import os
import json
import websocket

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

url = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
headers = ["Authorization: Bearer " + OPENAI_API_KEY]

def on_open(ws):
    print("Connected to server.")

def on_message(ws, message):
    data = json.loads(message)
    print("Received event:", json.dumps(data, indent=2))

ws = websocket.WebSocketApp(
    url,
    header=headers,
    on_open=on_open,
    on_message=on_message,
)

ws.run_forever()
```

WebSocket (browsers)

Connect with standard WebSocket (browsers)

```javascript
/*
Note that in client-side environments like web browsers, we recommend
using WebRTC instead. It is possible, however, to use the standard
WebSocket interface in browser-like environments like Deno and
Cloudflare Workers.
*/

const ws = new WebSocket(
  "wss://api.openai.com/v1/realtime?model=gpt-realtime",
  [
    "realtime",
    // Auth
    "openai-insecure-api-key." + OPENAI_API_KEY,
    // Optional
    "openai-organization." + OPENAI_ORG_ID,
    "openai-project." + OPENAI_PROJECT_ID,
  ]
);

ws.on("open", function open() {
  console.log("Connected to server.");
});

ws.on("message", function incoming(message) {
  console.log(message.data);
});
```

Sending and receiving events
----------------------------

Realtime API sessions are managed using a combination of [client-sent events](/docs/api-reference/realtime_client_events/session) emitted by you as the developer, and [server-sent events](/docs/api-reference/realtime_server_events/error) created by the Realtime API to indicate session lifecycle events.

Over a WebSocket, you will both send and receive JSON-serialized events as strings of text, as in this Node.js example below (the same principles apply for other WebSocket libraries):

```javascript
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
    headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
});

ws.on("open", function open() {
    console.log("Connected to server.");

    // Send client events over the WebSocket once connected
    ws.send(
        JSON.stringify({
            type: "session.update",
            session: {
                type: "realtime",
                instructions: "Be extra nice today!",
            },
        })
    );
});

// Listen for and parse server events
ws.on("message", function incoming(message) {
    console.log(JSON.parse(message.toString()));
});
```

The WebSocket interface is perhaps the lowest-level interface available to interact with a Realtime model, where you will be responsible for both sending and processing Base64-encoded audio chunks over the socket connection.

To learn how to send and receive audio over Websockets, refer to the [Realtime conversations guide](/docs/guides/realtime-conversations#handling-audio-with-websockets).

Was this page useful?






Using realtime models
=====================

Use realtime models and prompting effectively.

Realtime models are post-trained for specific customer use cases. In response to your feedback, the latest speech-to-speech model works differently from previous models. Use this guide to understand and get the most out of it.

Meet the models
---------------

Our most advanced speech-to-speech model is [gpt-realtime](/docs/models/gpt-realtime).

This model shows improvements in following complex instructions, calling tools, and producing speech that sounds natural and expressive. For more information, see the [announcement blog post](https://openai.com/index/introducing-gpt-realtime/).

Update your session to use a prompt
-----------------------------------

After you initiate a session over [WebRTC](/docs/guides/realtime-webrtc), [WebSocket](/docs/guides/realtime-websocket), or [SIP](/docs/guides/realtime-sip), the client and model are connected. The server will send a [session.created](/docs/api-reference/realtime-server-events/session/created) event to confirm. Now it's a matter of prompting.

### Basic prompt update

1.  Create a basic audio prompt in [the dashboard](/audio/realtime).
    
    If you don't know where to start, experiment with the prompt fields until you find something interesting. You can always manage, iterate on, and version your prompts later.
    
2.  Update your realtime session to use the prompt you created. Provide its prompt ID in a `session.update` client event:
    

Update the system instructions used by the model in this session

```javascript
const event = {
  type: "session.update",
  session: {
      type: "realtime",
      model: "gpt-realtime",
      // Lock the output to audio (set to ["text"] if you want text without audio)
      output_modalities: ["audio"],
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          turn_detection: {
            type: "semantic_vad"
          }
        },
        output: {
          format: {
            type: "audio/pcm",
          },
          voice: "marin",
        }
      },
      // Use a server-stored prompt by ID. Optionally pin a version and pass variables.
      prompt: {
        id: "pmpt_123",          // your stored prompt ID
        version: "89",           // optional: pin a specific version
        variables: {
          city: "Paris"          // example variable used by your prompt
        }
      },
      // You can still set direct session fields; these override prompt fields if they overlap:
      instructions: "Speak clearly and briefly. Confirm understanding before taking actions."
  },
};

// WebRTC data channel and WebSocket both have .send()
dataChannel.send(JSON.stringify(event));
```

```python
event = {
    "type": "session.update",
    session: {
      type: "realtime",
      model: "gpt-realtime",
      # Lock the output to audio (add "text" if you also want text)
      output_modalities: ["audio"],
      audio: {
        input: {
          format: {
            type: "audio/pcm",
            rate: 24000,
          },
          turn_detection: {
            type: "semantic_vad"
          }
        },
        output: {
          format: {
            type: "audio/pcmu",
          },
          voice: "marin",
        }
      },
      # Use a server-stored prompt by ID. Optionally pin a version and pass variables.
      prompt: {
        id: "pmpt_123",          // your stored prompt ID
        version: "89",           // optional: pin a specific version
        variables: {
          city: "Paris"          // example variable used by your prompt
        }
      },
      # You can still set direct session fields; these override prompt fields if they overlap:
      instructions: "Speak clearly and briefly. Confirm understanding before taking actions."
    }
}
ws.send(json.dumps(event))
```

When the session's updated, the server emits a [session.updated](/docs/api-reference/realtime-server-events/session/updated) event with the new state of the session. You can update the session any time.

### Changing prompt mid-call

To update the session mid-call (to swap prompt version or variables, or override instructions), send the update over the same data channel you're using:

```javascript
// Example: switch to a specific prompt version and change a variable
dc.send(JSON.stringify({
  type: "session.update",
  session: {
    type: "realtime",
    prompt: {
      id: "pmpt_123",
      version: "89",
      variables: {
        city: "Berlin"
      }
    }
  }
}));

// Example: override instructions (note: direct session fields take precedence over Prompt fields)
dc.send(JSON.stringify({
  type: "session.update",
  session: {
    type: "realtime",
    instructions: "Speak faster and keep answers under two sentences."
  }
}));
```

Prompting gpt-realtime
----------------------

Here are top tips for prompting the realtime speech-to-speech model. For a more in-depth guide to prompting, see the [realtime prompting cookbook](https://cookbook.openai.com/examples/realtime_prompting_guide).

### General usage tips

*   **Iterate relentlessly**. Small wording changes can make or break behavior.
    
    Example: Swapping “inaudible” → “unintelligible” improved noisy input handling.
    
*   **Use bullets over paragraphs**. Clear, short bullets outperform long paragraphs.
    
*   **Guide with examples**. The model strongly follows onto sample phrases.
    
*   **Be precise**. Ambiguity and conflicting instructions degrade performance, similar to GPT-5.
    
*   **Control language**. Pin output to a target language if you see drift.
    
*   **Reduce repetition**. Add a variety rule to reduce robotic phrasing.
    
*   **Use all caps for emphasis**: Capitalize key rules to makes them stand out to the model.
    
*   **Convert non-text rules to text**: The model responds better to clearly written text.
    
    Example: Instead of writing, "IF x > 3 THEN ESCALATE", write, "IF MORE THAN THREE FAILURES THEN ESCALATE."
    

### Structure your prompt

Organize your prompt to help the model understand context and stay consistent across turns.

Use clear, labeled sections in your system prompt so the model can find and follow them. Keep each section focused on one thing.

```markdown
# Role & Objective        — who you are and what “success” means
# Personality & Tone      — the voice and style to maintain
# Context                 — retrieved context, relevant info
# Reference Pronunciations — phonetic guides for tricky words
# Tools                   — names, usage rules, and preambles
# Instructions / Rules    — do’s, don’ts, and approach
# Conversation Flow       — states, goals, and transitions
# Safety & Escalation     — fallback and handoff logic
```

This format also makes it easier for you to iterate and modify problematic sections.

To make this system prompt your own, add domain-specific sections (e.g., Compliance, Brand Policy) and remove sections you don’t need. In each section, provide instructions and other information for the model to respond correctly. See specifics below.

Practical tips for prompting realtime models
--------------------------------------------

Here are 10 tips for creating effective, consistently performing prompts with gpt-realtime. These are just an overview. For more details and full system prompt examples, see the [realtime prompting cookbook](https://cookbook.openai.com/examples/realtime_prompting_guide).

#### 1\. Be precise. Kill conflicts.

The new realtime model is very good at instruction following. However, that also means small wording changes or unclear instructions can shift behavior in meaningful ways. Inspect and iterate on your system prompt to try different phrasing and fix instruction contradictions.

In one experiment we ran, changing the word "inaudible" to "unintelligble" in instructions for handling noisy inputs significantly improved the model's performance.

After your first attempt at a system prompt, have an LLM review it for ambiguity or conflicts.

#### 2\. Bullets > paragraphs.

Realtime models follow short bullet points better than long paragraphs.

Before (harder to follow):

```markdown
When you can’t clearly hear the user, don’t proceed. If there’s background noise or you only caught part of the sentence, pause and ask them politely to repeat themselves in their preferred language, and make sure you keep the conversation in the same language as the user.
```

After (easier to follow):

```markdown
Only respond to clear audio or text.

If audio is unclear/partial/noisy/silent, ask for clarification in `{preferred_language}`.

Continue in the same language as the user if intelligible.
```

#### 3\. Handle unclear audio.

The realtime model is good at following instructions on how to handle unclear audio. Spell out what to do when audio isn’t usable.

```markdown
## Unclear audio
- Always respond in the same language the user is speaking in, if intelligible.
- Default to English if the input language is unclear.
- Only respond to clear audio or text.
- If the user's audio is not clear (e.g., ambiguous input/background noise/silent/unintelligible) or if you did not fully hear or understand the user, ask for clarification using {preferred_language} phrases.

Sample clarification phrases (parameterize with {preferred_language}):

- “Sorry, I didn’t catch that—could you say it again?”
- “There’s some background noise. Please repeat the last part.”
- “I only heard part of that. What did you say after ___?”
```

#### 4\. Constrain the model to one language.

If you see the model switching languages in an unhelpful way, add a dedicated "Language" section in your prompt. Make sure it doesn’t conflict with other rules. By default, mirroring the user’s language works well.

Here's a simple way to mirror the user's language:

```markdown
## Language
Language matching: Respond in the same language as the user unless directed otherwise.
For non-English, start with the same standard accent/dialect the user uses.
```

Here's an example of an English-only constraint:

```markdown
## Language
- The conversation will be only in English.
- Do not respond in any other language, even if the user asks.
- If the user speaks another language, politely explain that support is limited to English.
```

In a language teaching application, your language and conversation sections might look like this:

```markdown
## Language
### Explanations
Use English when explaining grammar, vocabulary, or cultural context.

### Conversation
Speak in French when conducting practice, giving examples, or engaging in dialogue.
```

You can also control dialect for a more consistent personality:

```markdown
## Language
Response only in argentine spanish.
```

#### 5\. Provide sample phrases and flow snippets.

The model learns style from examples. Give short, varied samples for common conversation moments.

For example, you might give this high-level shape of conversation flow to the model:

```markdown
Greeting → Discover → Verify → Diagnose → Resolve → Confirm/Close. Advance only when criteria in each phase are met.
```

And then provide prompt guidance for each section. For example, here's how you might instruct for the greeting section:

```markdown
## Conversation flow — Greeting
Goal: Set tone and invite the reason for calling.

How to respond:
- Identify as ACME Internet Support.
- Keep it brief; invite the caller’s goal.

Sample phrases (vary, don’t always reuse):
- “Thanks for calling ACME Internet—how can I help today?”
- “You’ve reached ACME Support. What’s going on with your service?”
- “Hi there—tell me what you’d like help with.”

Exit when: Caller states an initial goal or symptom.
```

#### 6\. Avoid robotic repetition.

If responses sound repetitive or robotic, include an explicit variety instruction. This can sometimes happen when using sample phrases.

```markdown
## Variety
- Do not repeat the same sentence twice. Vary your responses so it doesn't sound robotic.
```

#### 7\. Use capitalized text to emphasize instructions.

Like many LLMs, using capitalization for important rules can help the model to understand and follow those rules. It's also helpful to convert non-text rules (such as numerical conditions) into text before capitalization.

Instead of:

```markdown
## Rules
- If [func.return_value] > 0, respond 1 to the user.
```

Use:

```markdown
## Rules
- IF [func.return_value] IS BIGGER THAN 0, RESPOND 1 TO THE USER.
```

#### 8\. Help the model use tools.

The model's use of tools can alter the experience—how much they rely on user confirmation vs. taking action, what they say while they make the tool call, which rules they follow for each specific tool, etc.

One way to prompt for tool usage is to use preambles. Good preambles instruct the model to give the user some feedback about what it's doing before it makes the tool call, so the user always knows what's going on.

Here's an example:

```markdown
# Tools
- Before any tool call, say one short line like “I’m checking that now.” Then call the tool immediately.
```

You can include sample phrases for preambles to add variety and better tailor to your use case.

There are several other ways to improve the model's behavior when performing tool calls and keeping the conversation going with the user. Ideally, the model is calling the right tools proactively, checking for confirmation for any important write actions, and keeping the user informed along the way. For more specifics, see the [realtime prompting cookbook](https://cookbook.openai.com/examples/realtime_prompting_guide).

#### 9\. Use LLMs to improve your prompt.

LLMs are great at finding what's going wrong in your prompt. Use ChatGPT or the API to get a model's review of your current realtime prompt and get help improving it.

Whether your prompt is working well or not, here's a prompt you can run to get a model's review:

```markdown
## Role & Objective
You are a **Prompt-Critique Expert**.
Examine a user-supplied LLM prompt and surface any weaknesses following the instructions below.

## Instructions
Review the prompt that is meant for an LLM to follow and identify the following issues:
- Ambiguity: Could any wording be interpreted in more than one way?
- Lacking Definitions: Are there any class labels, terms, or concepts that are not defined that might be misinterpreted by an LLM?
- Conflicting, missing, or vague instructions: Are directions incomplete or contradictory?
- Unstated assumptions: Does the prompt assume the model has to be able to do something that is not explicitly stated?

## Do **NOT** list issues of the following types:
- Invent new instructions, tool calls, or external information. You do not know what tools need to be added that are missing.
- Issues that you are not sure about.

## Output Format

# Issues
- Numbered list; include brief quote snippets.

# Improvements
- Numbered list; provide the revised lines you would change and how you would changed them.

# Revised Prompt
- Revised prompt where you have applied all your improvements surgically with minimal edits to the original prompt
```

Use this template as a starting point for troubleshooting a recurring issue:

```markdown
Here's my current prompt to an LLM:
[BEGIN OF CURRENT PROMPT]
{CURRENT_PROMPT}
[END OF CURRENT PROMPT]

But I see this issue happening from the LLM:
[BEGIN OF ISSUE]
{ISSUE}
[END OF ISSUE]
Can you provide some variants of the prompt so that the model can better understand the constraints to alleviate the issue?
```

#### 10\. Help users resolve issues faster.

Two frustrating user experiences are slow, mechanical voice agents and the inability to escalate. Help users faster by providing instructions in your system prompt for speed and escalation.

In the personality and tone section of your system prompt, add pacing instructions to get the model to quicken its support:

```markdown
# Personality & Tone
## Personality
Friendly, calm and approachable expert customer service assistant.

## Tone
Tone: Warm, concise, confident, never fawning.

## Length
2–3 sentences per turn.

## Pacing
Deliver your audio response fast, but do not sound rushed. Do not modify the content of your response, only increase speaking speed for the same response.
```

Often with realtime voice agents, having a reliable way to escalate to a human is important. In a safety and escalation section, modify the instructions on WHEN to escalate depending on your use case. Here's an example:

```markdown
# Safety & Escalation
When to escalate (no extra troubleshooting):
- Safety risk (self-harm, threats, harassment)
- User explicitly asks for a human
- Severe dissatisfaction (e.g., “extremely frustrated,” repeated complaints, profanity)
- **2** failed tool attempts on the same task **or** **3** consecutive no-match/no-input events
- Out-of-scope or restricted (e.g., real-time news, financial/legal/medical advice)

What to say at the same time of calling the escalate_to_human tool (MANDATORY):
- “Thanks for your patience—**I’m connecting you with a specialist now**.”
- Then call the tool: `escalate_to_human`

Examples that would require escalation:
- “This is the third time the reset didn’t work. Just get me a person.”
- “I am extremely frustrated!”
```

Further reading
---------------

This guide is long but not exhaustive! For more in a specific area, see the following resources:

*   [Realtime prompting cookbook](https://cookbook.openai.com/examples/realtime_prompting_guide): Full prompt examples and a deep dive into when and how to use them
*   [Inputs and outputs](/docs/guides/realtime-inputs-outputs): Text and audio input requirements and output options
*   [Managing conversations](/docs/guides/realtime-conversations): Learn to manage a conversation for the duration of a realtime session
*   [Webhooks and server-side controls](/docs/guides/realtime-server-controls): Create a sideband channel to separate sensitive server-side logic from an untrusted client
*   [Function calling](/docs/guides/realtime-function-calling): How to call functions in your realtime app
*   [MCP servers](/docs/guides/realtime-mcp): How to use MCP servers to access additional tools in realtime apps
*   [Realtime transcription](/docs/guides/realtime-transcription): How to transcribe audio with the Realtime API
*   [Voice agents](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/): A quickstart for building a voice agent with the Agents SDK

Was this page useful?