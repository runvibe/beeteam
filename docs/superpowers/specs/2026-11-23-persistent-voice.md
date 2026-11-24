# Persistent voice across chat navigation

User-approved behavior: viewing or typing in another chat preserves the original voice call and its conversation binding. A visible floating avatar identifies the voice conversation and offers independent mutes, stop and return to origin. Starting voice in another chat ends the previous call and starts the selected chat's voice. Exactly one call. Navigation never creates sessions; explicit voice start retains lazy creation. This supersedes earlier stop-on-Home/session-switch behavior.

Architecture: app-lifetime voice owner, immutable call context and guarded per-view callbacks. Separate call execution/persistence invalidations from visible chat selection. Keep existing native RealtimeVoice transport. No backend schema changes. Original permissions and agent/team must remain fixed; unknown submissions never auto-retry. Late callbacks from replaced calls cannot affect new calls or select old sessions.

UI: existing avatar above composer when viewing its call; fixed compact global avatar when viewing another chat, theme-neutral, label and return action. Keep chat typing usable and same layout. Constrain floating widget to viewport and avoid blocking composer.
