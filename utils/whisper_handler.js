// Default whisper handler hook. Drop your own implementation here
// or replace this file with your folder contents to intercept transcripts.

export async function handleTranscript(transcript) {
  // `transcript` is a cleaned string (trimmed). Return `true` if you
  // handled the command (so the app should NOT run its built-in router).
  // Return `false` to let the app continue with its normal `processVoice`.
  // By default this is a no-op.
  return false;
}
