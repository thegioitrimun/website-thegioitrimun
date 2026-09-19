# Shared site motion

Adapted from [transitions.dev](https://transitions.dev/skill.html) and its [reference snippets](https://github.com/Jakubantalik/transitions.dev/tree/main/skills/transitions-dev).

`tokens.css` contains the universal scale. `transitions.css` preserves the reference CSS verbatim, including reduced-motion guards. Public and admin entries import the shared `motion.css`; their layout-specific styles stay separate.

- `SurfacePresence`: preserves a conditional surface through its exit, makes closing controls inert, and cancels timers on reopening/unmount. Modals trap/restore focus and share a reference-counted scroll lock.
- `useOverlayMotion`: drawer/search/sheet presence, Escape, focus management and scroll restoration. `data-open` drives CSS; close timers read the same semantic duration token.
- `reveal`: below-the-fold sections use a short rise/fade. First-viewport content is immediately visible. Observers and timers are cleaned up, reduced-motion changes reveal all content, and settled sections release transforms.
- `useSlidingTabs`: measured active indicator, snapping on first paint/resize, arrow/Home/End navigation.
- `MotionToastProvider`: shared transient notification motion; existing `useToast` contract is unchanged.

Animate surfaces, never the app/root container. Keep native scrolling and avoid animated full-screen blur. Do not delay first-viewport content or stack nested section reveals. No new animation dependency is required.
