# Settings migration wizard design
## Objective
- Surface frames 10.3 (steps b-d) from the KaitianClaw board as a new reusable modal that can be mounted from Settings > Advanced.
- Provide a stepper + mock data, matching the existing Settings center visual language (rounded cards, borders, spacing) with no production data wiring yet.
- Expose a simple contract the controller can call (`SettingsMigrationWizard({ open, onOpenChange })`).

## Requirements
1.  Modal only renders when `open` is `true`; otherwise it returns `null`.
2.  Three steps: scope selection with counts, compatibility report with pass/fail rows, and execution confirmation with checklist, warning, and confirmation checkbox.
3.  Buttons and controls must mimic the Figma artboards (bordered cards, progress indicators, `Next / Back` navigation, disabled states when prerequisites are unmet).
4.  Step data should be static/mock arrays so QA can review layout without needing backend data.
5.  Include close/cancel affordances, progress pills, and call props for closing the wizard.

## Approach

### Component
- Controlled state hook for `currentStep`, selected scopes, and acknowledgement checkbox.
- Steps driven by `STEPS` constant; UI renders different content based on `currentStep`.
- Step 1 uses `SCOPE_OPTIONS` array for cards (title, description, meta). Click toggles selection and enables the “Next” button when at least one scope is selected.
- Step 2 renders `COMPATIBILITY_CHECKS` array with status icons (`CheckCircle2`/`XCircle`), descriptions, and badges (pass vs manual review) that mirror the Figma list.
- Step 3 renders `EXECUTION_CHECKLIST`, warning tone, and checkbox that gatekeeps the final `Start migration` button.
- Footer shows Cancel/Back and Next/Start actions; Next disables if no scope selected in step 1.

### Visuals
- Reuse settings language: rounded cards, light border, subtle shadow, blue progress chips, grey text from monitoring panel.
- Modal overlay with 3-step status chips, header with uppercase label, and progress indicator replicating frames.
- Step navigation pills highlight current step (blue background + white text).

### Accessibility
- Dialog uses `role="dialog"` with `aria-modal` and labelled header.
- Buttons have descriptive `aria-label`s for navigation.
- Icons include `aria-label` for status information.

### Testing
- Unit test renders component with `open=false` and expects `null`.
- Render with `open=true`, verify Step 1 content, click Next after selecting scope to reach Step 2, then Next to Step 3.
- Toggle checkbox to enable the final Start button and assert `disabled` state transitions.

## Next Steps
1.  Once spec review is complete, write the component + test files described here.
2.  Notify controller that `SettingsMigrationWizard` is reusable via `open` prop for settings page integration.
