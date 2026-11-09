# Consent and Data Handling

**Camera consent.** HumanKit never turns the camera on by itself. The first time you start a session, a screen explains what the camera is used for and asks you to agree. The camera turns on only after you press Start or Resume, and a "Camera is on" label is shown the whole time. It turns off when you press Pause or End, or leave the page.

**What is stored.** HumanKit does not record, save or upload camera video or pictures. After a session, a short summary is saved in the app on your own device (browser local storage): the tool name, date, session length, and the time with talking detected and silence. HumanKit has no accounts, no server and no database, and it shares nothing with other people.

**Retention and deletion.** Summaries stay on your device until you delete them. You can delete one session in History, or press "Delete everything" on the Privacy page to remove all sessions and your camera agreement.

**Presage SDK.** Measurements come from the Presage SmartSpectra Node.js SDK running inside the app. The SDK checks the app's API key with Presage's service over the internet while it measures, so a connection is needed. HumanKit turns the SDK's optional telemetry off (`enableTelemetry: false`).

**Optional AI services.** None are used.

**Not medical.** HumanKit gives no diagnosis, treatment or medical advice. SpeakEasy shows detected talking activity only, and says nothing about how good someone's speech is.
