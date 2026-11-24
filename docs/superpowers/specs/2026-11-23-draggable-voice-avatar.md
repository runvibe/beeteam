# Minimal draggable voice avatar

User requested detached voice presentation without card background, border, shadow or visible title/text. Keep current microphone and output mute icons adjacent to hexagon; add icon-only Return beside microphone and End beside output. Accessible names and hover tooltips remain. Drag by holding the avatar freely anywhere within viewport, no magnetic snapping, with all controls moving together. Buttons never start dragging. Keep connection and routing unchanged. Use neutral theme foreground for inline and detached avatar/controls, including hover and mute state; remove amber/yellow from this voice UI. Errors still must be readable and dismissible.

Implementation choice: focused detached presentation with pointer capture, viewport bounds, cancel/Escape restore, and resize clamping. Preserve position across inline/detached navigation during the same call. No new dependencies or backend contract changes.
