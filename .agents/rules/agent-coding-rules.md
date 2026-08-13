---
trigger: always_on
---

## 1. Heavy Commands Strictly Avoid Karein

* Kabhi bhi `pnpm build`, `cargo check`, `cargo build` ya kisi bhi unnecessarily heavy command ko run **na karein**.
* Agent ka primary kaam **code likhna aur modify karna** hai.
* Syntax/type-level validation ke liye lightweight commands ka use karein, jaise:

  * `tsc --noEmit`
  * Relevant linter/type-check commands
  * Rust ke liye sirf lightweight syntax-oriented validation, jab available ho.
* Full project build ya complete compilation tabhi karein jab user explicitly kahe.

## 2. Repository ki Design Policy Follow Karein

* Repository ki existing design system, UI patterns, architecture aur coding conventions ke **strictly according** code likhein.
* Existing design policy ko override, bypass ya contradict na karein.
* Naya UI/component banane se pehle existing reusable components aur established patterns ko prefer karein.
* Sirf apni preference ke basis par architecture ya design pattern introduce na karein.

## 3. Minimum Code Principle

* **Jitna ho sake utna kam code likhein.**
* Existing functionality ko unnecessarily duplicate na karein.
* Reusable logic ko reusable components, utilities ya shared modules mein rakhein.
* Copy-paste based implementation avoid karein.
* Simple problem ke liye unnecessarily complex abstraction na banayein.
* Har naye abstraction ka clear reuse/maintenance benefit hona chahiye.

## 4. Feature-wise Code Separation

* Alag-alag feature groups ko clearly separate rakhein.
* Har feature ka Rust aur TypeScript code apne respective feature/module structure mein rakhein.
* Unrelated features ki files ko ek hi file mein mix na karein.
* Feature boundaries ko maintain karein taaki future mein code easily locate, modify aur debug kiya ja sake.
* Shared code ko sirf genuinely shared hone par common/shared module mein rakhein.

## 5. Maintainability First

* Code aisa likhein jo future developer easily samajh aur modify kar sake.
* Clear naming aur predictable file structure maintain karein.
* Existing architecture ko unnecessarily refactor na karein.
* Chhote feature ke liye bade-scale architectural changes avoid karein.
* New code add karne se pehle check karein ki existing implementation ko reuse ya extend kiya ja sakta hai ya nahi.

## 6. Validation Rule

Code complete karne ke baad:

1. Relevant files ko inspect karein.
2. Lightweight syntax/type checks run karein.
3. Possible errors ko fix karein.
4. Unnecessarily expensive build/check commands run na karein.

**Default principle:**

> Write less code, reuse more, respect the repository's design and architecture, keep features isolated, and validate with lightweight checks instead of heavy builds.
