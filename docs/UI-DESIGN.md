# UI design

Hanyu Learn is a reference library with the clarity of a modern learning app.
The interface should feel calm, scholarly, and useful rather than decorative.

## Principles

1. **Hanzi first.** Character forms and learning relationships lead the hierarchy.
   Never synthesize bold Hanzi; use size, spacing, and accent colour for emphasis.
2. **Keep every fact available.** Responsive changes may wrap, scroll, or move
   controls into a sheet, but must not remove data or features.
3. **Mobile is a complete product.** Search, levels, tabs, filters, view controls,
   and all metadata must be usable below 640px.
4. **Quiet surfaces, clear actions.** Use warm paper, white surfaces, ink, and
   vermilion. Filled accent treatments are reserved for selection and meaning.
5. **Readable density.** Prefer concise labels and progressive disclosure over
   tiny type. Body copy is at least 14px; supporting metadata is at least 12px.

## Layout and responsive behavior

- Start at 320px. Use 390×844 as the primary mobile verification viewport.
- `sm` (640px) adds columns; `lg` (1024px) introduces the persistent filter rail.
- Interactive controls have a minimum 44×44px target on touch layouts.
- Navigation tabs may scroll horizontally, with the active tab always visible.
- Wide tables and decomposition trees use explicit horizontal scroll containers.
- Sticky descendants use `--app-header-height`; do not hardcode header offsets.
- Include safe-area padding for sticky headers and bottom sheets.

## Components

- Cards use `ui-card`; interactive cards also use `ui-card-interactive`.
- Section labels use `ui-eyebrow`.
- Touch controls use `ui-touch` on mobile and may become denser at `sm` or `lg`.
- Selected controls use ink or accent fills plus text/shape, never colour alone.
- Bottom sheets use the shared Radix Dialog primitive, restore trigger focus on
  close, close on Escape or backdrop, and prevent background scrolling.
- Truncation is only a layout aid: preserve the full value with wrapping,
  a title, or a detail destination.

## Accessibility and motion

- Preserve semantic headings, fieldsets, labels, and current URL-backed state.
- Every icon-only action needs an accessible name and visible focus.
- Contrast and focus treatment must work in both themes.
- Respect `prefers-reduced-motion`; no essential information depends on animation.

## Verification

For any UI change, verify 390×844 and 1280×800 in light and dark themes. Check
the affected breakpoint on both sides. Exercise search, level selection, tabs,
filters, grid/table controls, loading, and representative detail pages. Confirm
there is no page-level horizontal overflow, clipped sticky content, missing
information, unreadable metadata, or touch target below 44px.
