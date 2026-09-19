# Admin motion

Source: [transitions.dev skill](https://transitions.dev/skill.html),
[Jakub Antalik's reference snippets](https://github.com/Jakubantalik/transitions.dev/tree/main/skills/transitions-dev), retrieved 2026-09-18.

`../../components/motion/tokens.css` is the shared universal token block; `../../components/motion/transitions.css` preserves the selected reference CSS verbatim, including reduced-motion guards. Public and admin entries now share these primitives. Admin layout overrides remain scoped to the admin entry. Project-specific layout and theme overrides live in `admin-motion.css`.

- Wrap conditional menus/dialogs in `AdminPresence`. Mark the moving surface with `data-motion-surface` and its `t-dropdown`, `t-modal`, `t-panel-slide`, or `t-toast` class. It retains closing content, makes it inert immediately, reads CSS timing tokens, and cancels pending work when reopened/unmounted.
- Keep modal backdrops separate from the scaled dialog. Never transform the page/root: fixed overlays and native document scrolling depend on their normal containing blocks.
- `AdminPageTransition` fades a changed workspace identity without remounting live forms. Shared editor/reveal sections use the same short entry timing.
- `useSlidingTabs` measures the selected tab, snaps on first paint/resize, and supports arrow/Home/End keys.
- `AdminToastProvider` uses the existing ToastContext contract, with admin-only entry/exit and timer cleanup.
- All admin motion honors `prefers-reduced-motion`; no animation library is required.
