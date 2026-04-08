import {
  Heading,
  SubHeading,
  Paragraph,
  CodeBlock,
  InlineCode,
  Table,
  BulletList,
  NumberedList,
  Callout,
  InfoCard,
} from "./DocSection";

export function ThemingSection() {
  return (
    <>
      <Heading>Theming</Heading>
      <Paragraph>
        ClawPort's visual theming is driven entirely by CSS custom properties
        and two React context providers: ThemeProvider and SettingsProvider.
        Five built-in themes are toggled via the sidebar theme picker.
      </Paragraph>

      <SubHeading>Available Themes</SubHeading>
      <Table
        headers={["ID", "Label", "Description"]}
        rows={[
          [
            <InlineCode key="d">dark</InlineCode>,
            "Dark",
            "Apple Dark Mode. The default theme.",
          ],
          [
            <InlineCode key="g">glass</InlineCode>,
            "Glass",
            "Frosted glass dark variant with translucent surfaces.",
          ],
          [
            <InlineCode key="c">color</InlineCode>,
            "Color",
            "Vibrant purple-indigo variant.",
          ],
          [
            <InlineCode key="l">light</InlineCode>,
            "Light",
            "Apple Light Mode.",
          ],
          [
            <InlineCode key="s">system</InlineCode>,
            "System",
            "Follows the OS prefers-color-scheme setting.",
          ],
        ]}
      />

      <SubHeading>Three-Layer System</SubHeading>
      <NumberedList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              data-theme attribute on &lt;html&gt;
            </strong>{" "}
            -- Each theme defines a CSS rule block scoped to{" "}
            <InlineCode>[data-theme="id"]</InlineCode>. The dark theme also
            matches <InlineCode>:root</InlineCode>.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              CSS custom properties
            </strong>{" "}
            -- Every color, shadow, radius, and material is expressed as a CSS
            variable. Components consume these via inline styles. No Tailwind
            color classes are used directly.
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>
              ThemeProvider
            </strong>{" "}
            (<InlineCode>app/providers.tsx</InlineCode>) -- React context that
            manages theme state, reads/writes localStorage, and sets the
            data-theme attribute on &lt;html&gt;.
          </>,
        ]}
      />

      <SubHeading>CSS Custom Properties</SubHeading>

      <InfoCard title="Backgrounds">
        <Table
          headers={["Token", "Purpose", "Dark Example"]}
          rows={[
            [<InlineCode key="b">--bg</InlineCode>, "Primary page background", "#000000"],
            [
              <InlineCode key="bs">--bg-secondary</InlineCode>,
              "Card / surface background",
              "rgba(28,28,30,1)",
            ],
            [
              <InlineCode key="bt">--bg-tertiary</InlineCode>,
              "Nested surface",
              "rgba(44,44,46,1)",
            ],
          ]}
        />
      </InfoCard>

      <InfoCard title="Materials (Apple translucent surfaces)">
        <Table
          headers={["Token", "Purpose"]}
          rows={[
            [
              <InlineCode key="mr">--material-regular</InlineCode>,
              "Standard material (sidebar, overlays)",
            ],
            [
              <InlineCode key="mt">--material-thick</InlineCode>,
              "Dense material",
            ],
            [
              <InlineCode key="mn">--material-thin</InlineCode>,
              "Light tint material",
            ],
            [
              <InlineCode key="mu">--material-ultra-thin</InlineCode>,
              "Very subtle tint",
            ],
          ]}
        />
      </InfoCard>

      <InfoCard title="Text & Fills">
        <Table
          headers={["Token", "Purpose"]}
          rows={[
            [
              <InlineCode key="tp">--text-primary</InlineCode>,
              "Headings, body text",
            ],
            [
              <InlineCode key="ts">--text-secondary</InlineCode>,
              "Labels, supporting text",
            ],
            [
              <InlineCode key="tt">--text-tertiary</InlineCode>,
              "Placeholder, captions",
            ],
            [
              <InlineCode key="fp">--fill-primary</InlineCode>,
              "Primary interactive fill (buttons)",
            ],
            [
              <InlineCode key="fs">--fill-secondary</InlineCode>,
              "Hover fill",
            ],
            [
              <InlineCode key="ft">--fill-tertiary</InlineCode>,
              "Subtle fill (input backgrounds)",
            ],
          ]}
        />
      </InfoCard>

      <InfoCard title="Accent & System Colors">
        <Table
          headers={["Token", "Purpose"]}
          rows={[
            [
              <InlineCode key="a">--accent</InlineCode>,
              "Primary brand accent (buttons, active states)",
            ],
            [
              <InlineCode key="af">--accent-fill</InlineCode>,
              "Accent at 15% opacity (backgrounds)",
            ],
            [<InlineCode key="sb">--system-blue</InlineCode>, "Links, focus rings"],
            [<InlineCode key="sg">--system-green</InlineCode>, "Success, active toggles"],
            [<InlineCode key="sr">--system-red</InlineCode>, "Errors, destructive actions"],
            [<InlineCode key="so">--system-orange</InlineCode>, "Warnings"],
            [<InlineCode key="sp">--system-purple</InlineCode>, "Tags, highlights"],
          ]}
        />
      </InfoCard>

      <InfoCard title="Code Blocks">
        <Table
          headers={["Token", "Purpose"]}
          rows={[
            [<InlineCode key="cb">--code-bg</InlineCode>, "Code block background"],
            [<InlineCode key="cbd">--code-border</InlineCode>, "Code block border"],
            [<InlineCode key="ct">--code-text</InlineCode>, "Code text color"],
          ]}
        />
      </InfoCard>

      <SubHeading>Accent Color Override</SubHeading>
      <Paragraph>
        When the user selects a custom accent color in settings, the
        SettingsProvider applies it as inline styles on{" "}
        <InlineCode>document.documentElement</InlineCode>, overriding the
        theme's <InlineCode>--accent</InlineCode> and{" "}
        <InlineCode>--accent-fill</InlineCode>. Setting it to null reverts to
        the theme default.
      </Paragraph>

      <SubHeading>Adding a New Theme</SubHeading>
      <NumberedList
        items={[
          <>
            Add the theme ID to the <InlineCode>ThemeId</InlineCode> type
            union and <InlineCode>THEMES</InlineCode> array in{" "}
            <InlineCode>lib/themes.ts</InlineCode>.
          </>,
          <>
            Add a <InlineCode>[data-theme="name"]</InlineCode> block in{" "}
            <InlineCode>app/globals.css</InlineCode> defining every CSS custom
            property token. Copy the dark theme block as a starting point.
          </>,
          "Optionally add theme-specific overrides (body background gradients, component styles).",
          "The ThemeProvider, onboarding wizard, and settings page will automatically pick up the new theme.",
        ]}
      />

      <Callout type="tip">
        Missing tokens will cause components to render with broken styles.
        Always define every token when creating a new theme -- use the dark theme
        block as a complete template.
      </Callout>

      <SubHeading>Spacing & Typography</SubHeading>
      <BulletList
        items={[
          <>
            <strong style={{ color: "var(--text-primary)" }}>Spacing</strong>{" "}
            -- 4px grid: <InlineCode>--space-1</InlineCode> (4px) through{" "}
            <InlineCode>--space-16</InlineCode> (64px)
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>Typography</strong>{" "}
            -- Apple HIG scale: <InlineCode>--text-caption2</InlineCode> (11px)
            through <InlineCode>--text-large-title</InlineCode> (34px)
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>Radius</strong>{" "}
            -- <InlineCode>--radius-sm</InlineCode> (6px) through{" "}
            <InlineCode>--radius-2xl</InlineCode> (24px)
          </>,
          <>
            <strong style={{ color: "var(--text-primary)" }}>Easing</strong>{" "}
            -- <InlineCode>--ease-spring</InlineCode> (bouncy),{" "}
            <InlineCode>--ease-smooth</InlineCode> (general),{" "}
            <InlineCode>--ease-snappy</InlineCode> (quick)
          </>,
        ]}
      />
    </>
  );
}
