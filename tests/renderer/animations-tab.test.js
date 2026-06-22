import { describe, expect, it } from "vitest";
import { renderAnimations } from "../../src/renderer/panel/tabs/animations";

describe("animations tab", () => {
  it("renders an empty editable form when adding a new animation", () => {
    const html = renderAnimations({
      selectedClipId: ""
    }, {
      animations: {
        default: { id: "idle", asset: "assets/idle.svg" },
        clips: [
          { id: "click", asset: "assets/click.svg", type: "oneshot", durationMs: 900 }
        ]
      }
    });

    expect(html).toContain('name="clipId" value=""');
    expect(html).toContain('name="isDefault" value="false"');
    expect(html).toContain('id="anim-type"');
    expect(html).toContain('value=""');
    expect(html).not.toContain('value="idle"\n              required\n              pattern="[a-zA-Z0-9_-]+"\n              readonly');
  });
});
