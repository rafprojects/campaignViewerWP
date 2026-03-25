# Gallery Configuration UI Flow

## Purpose

This document defines the Phase 23 user flow for gallery configuration in WP Super Gallery.

The gallery configuration UX must satisfy four requirements:

1. expose current adapter choices clearly
2. support responsive configuration without overwhelming the main UI
3. support the same editing concepts in global and campaign contexts
4. make inheritance and reset behavior explicit, especially for campaign parity

---

## Core UX Decision

Phase 23 uses a hybrid gallery configuration UX.

### Meaning

1. Adapter selection remains visible in the parent screen.
2. A focused editor is opened for deeper configuration.
3. The deeper editor handles common settings, adapter-specific settings, breakpoint switching, scope switching, inheritance, and resets.

### Why hybrid wins

It preserves scanability while avoiding a giant inline form that would recreate the current monolithic settings problem.

---

## Global Principles

1. Users should always be able to tell which adapter is active without extra clicks.
2. Users should not have to mentally translate between different editing models in global and campaign contexts.
3. Campaign context should default to inherited values, even though full parity is supported.
4. Responsive scope should be explicit: breakpoint and scope are first-class selectors, not hidden assumptions.
5. Reset actions should exist at meaningful levels, not only as all-or-nothing resets.

---

## Primary Contexts

There are two primary editing contexts.

### Context 1: Global settings

Used for site-wide defaults.

### Context 2: Campaign settings

Used for per-campaign overrides with full gallery config parity.

The core editing surface should feel the same in both contexts. What changes is the inheritance behavior and reset language.

---

## Global Settings Flow

### Entry point

1. User opens the main Settings panel.
2. User navigates to the gallery configuration area.

### Parent screen responsibilities

The parent screen should show:

1. gallery mode selector
2. breakpoint selector
3. scope selector
4. visible adapter selection row
5. concise summary of current effective configuration
6. config action that opens the deeper editor

### Parent screen summary goals

Without opening the deeper editor, the user should be able to see:

1. which adapter is active
2. whether they are editing desktop/tablet/mobile
3. whether they are editing unified/image/video scope
4. a short summary of key layout characteristics

### Deeper editor flow

When the user clicks the config action:

1. Gallery Config editor opens
2. editor header shows `Global` context badge
3. editor preserves breakpoint and scope context from parent screen
4. editor exposes common and adapter-specific sections
5. user applies changes
6. parent screen summary refreshes immediately

---

## Campaign Settings Flow

### Entry point

1. User opens campaign edit.
2. User navigates to campaign gallery settings.

### Parent screen responsibilities

The campaign parent screen should show the same visible control pattern as global settings, but add inheritance affordances:

1. inherited/override state per scope
2. visible active adapter row
3. summary of effective config
4. config action to open the deeper editor
5. reset actions where appropriate

### Inheritance-first behavior

Campaign gallery settings should start from inherited global behavior.

The campaign user then chooses to override as needed.

This prevents full parity from feeling like full duplication.

### Deeper editor flow

When the user clicks the config action in campaign context:

1. Gallery Config editor opens
2. editor header shows `Campaign` context badge
3. editor indicates inherited values versus campaign overrides
4. user may override common settings, adapter settings, or both
5. reset actions are available for current field group, current scope, current breakpoint, or full campaign gallery config
6. parent screen summary refreshes to reflect effective values

---

## Editor Anatomy

The deeper Gallery Config editor should have four structural regions.

### 1. Header

Should contain:

1. context badge (`Global` or `Campaign`)
2. breakpoint selector
3. scope selector
4. active adapter selector if not already fixed by parent context

### 2. Summary strip

Should contain:

1. active adapter label
2. source indicator (`Global default`, `Campaign override`, or equivalent)
3. short summary of meaningful settings

### 3. Main body

Should contain at minimum:

1. Common settings section
2. Adapter settings section

Common settings should be limited to the first-pass field list defined in the data model document. Additional common fields should only be added in later phases after schema review.

Optional:

3. advanced summary or raw effective view if debugging visibility is useful

### 4. Footer

Should contain:

1. Apply
2. Reset current scope
3. Reset current breakpoint
4. Reset all campaign overrides when in campaign context

---

## Parent Screen Example Pattern

The selector row pattern should be simple and repeatable.

### Example responsibilities of a selector row

1. label the scope clearly
2. show current adapter
3. allow direct adapter switching
4. show a config action next to the selector
5. optionally display a small effective summary underneath

This pattern should be reused rather than rebuilt differently in each surface.

---

## Breakpoint and Scope Navigation

Responsive configuration becomes unusable if users lose track of what they are editing.

### Required cues

1. breakpoint selector must always be visible in the deeper editor
2. scope selector must always be visible in the deeper editor
3. switching breakpoint or scope must update summaries and sections immediately
4. the current target should never be ambiguous

### Scope model

The editor must support:

1. unified scope when unified mode is active
2. image scope when per-type mode is active
3. video scope when per-type mode is active

Where implementation allows, showing all three scopes consistently is preferable to making the mental model change dramatically based on mode.

---

## Inheritance and Reset Behavior

This is the critical UX difference between a powerful system and a confusing system.

### Global context

Resets operate on global values only.

Useful reset levels:

1. reset field group to default
2. reset scope to default
3. reset breakpoint to default

### Campaign context

Resets must operate on override boundaries.

Useful reset levels:

1. reset field group to inherited global value
2. reset current scope to inherited global value
3. reset current breakpoint to inherited global value
4. reset all campaign gallery overrides

### Required clarity

Users should be able to distinguish:

1. inherited value
2. overridden value
3. effective value

If those states are hidden, full parity becomes difficult to reason about.

---

## Adapter-Specific UI Behavior

Adapter-specific settings should appear only when relevant.

### Rules

1. active adapter determines which adapter settings section appears
2. adapter restrictions from schema must be enforced in UI
3. unsupported combinations should surface clearly rather than fail silently
4. layout-builder restrictions and fallback behavior must be visible to users when relevant

### Goal

Users should feel that the editor is focused and context-aware, not bloated.

---

## Summary Content

Because the deeper editor is not always open, summaries matter.

### Global summary examples

1. `Masonry, 3 columns, 16px gap`
2. `Justified, 220px target row, centered`
3. `Carousel, 1 visible card, autoplay off`

### Campaign summary examples

1. `Inherited from Global`
2. `Overrides adapter and gap`
3. `Desktop override only`

The exact text can evolve, but summary density should stay high enough that users can orient themselves quickly.

---

## Error and Constraint Handling

### Requirements

1. unsupported adapter/breakpoint combinations must be blocked or corrected with a clear explanation
2. resets must be reversible until the parent form is saved
3. invalid values should be prevented at control level where possible
4. the editor should not silently drop changes due to schema constraints

### Example

If layout-builder is restricted on mobile, the editor should surface that restriction directly instead of relying on runtime fallback only.

---

## Non-Goals For This Document

This document does not define:

1. the exact visual styling or layout density of the modal/editor
2. the final component names
3. exact Mantine component selection for each control
4. whether additive Phase 23 component-tree or Mantine map reference documents are needed before implementation completes

Those are implementation details. This document defines the user flow and behavioral requirements.

---

## Acceptance Criteria

The UI flow is successful if:

1. users can identify active adapter choices without opening the deeper editor
2. responsive editing is explicit and understandable
3. global and campaign contexts feel like the same system
4. campaign inheritance is clear and manageable despite full parity
5. adapter-specific settings appear only when relevant
6. reset behavior is available at useful granularity
7. the editor does not recreate the current monolithic settings confusion in a new form

---

## Summary

The Phase 23 gallery configuration UX should be:

1. visible at a glance
2. deep when needed
3. shared across contexts
4. inheritance-aware
5. schema-driven

That is the necessary UI foundation for a settings system that supports responsive gallery behavior and deep per-campaign customization without collapsing into another monolith.