## Consent and Data Handling

**Consent.** HumanKit never turns on the camera or microphone by itself. The first time you start SpeakEasy, a screen explains what is used and why, and asks you to agree. The camera is on during a practice session, and a "Camera is on" label is shown. The microphone is on only while you answer a question, with a "Microphone is on" label. Both turn off when you finish or leave the page.

**What is stored.** HumanKit does not record, save or upload camera video or pictures. Voice recordings are not kept: each one is used once to make text and then discarded. After a practice, a short summary is saved on your own device (browser local storage): tool name, date, length, the topic you typed, and your scores. The full text of your answers is not saved. HumanKit has no accounts, no server and no database.

**Sharing.** HumanKit shares nothing with other people. Two outside services are used, described below.

**Retention and deletion.** Summaries stay on your device until you delete them. You can delete one in History, or press "Delete everything" on the Privacy page to remove all summaries and your agreement.

**Presage SmartSpectra SDK.** Breathing, pulse and talking measurements come from the Presage SmartSpectra Node.js SDK inside the app. The SDK checks the app's API key with Presage's service over the internet while it measures, so a connection is needed. HumanKit turns the SDK's optional telemetry off (`enableTelemetry: false`).

**Optional AI service (Groq).** SpeakEasy uses Groq to write interview questions, turn your spoken answers into text, and review them. Groq receives the practice topic you type, a recording of each answer, and the text of your answers together with measured numbers (such as pace and pulse). This is needed for the coach to work.

**Not medical.** HumanKit gives no diagnosis, treatment or medical advice. Breathing and pulse can rise for many reasons, so SpeakEasy shows them only as hints, compared with your own resting level.
