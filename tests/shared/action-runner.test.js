import { afterEach, describe, expect, it, vi } from "vitest";
import actionRunner from "../../src/shared/action-runner";

const { selectActions } = actionRunner;

describe("selectActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing actions in rule order by default", () => {
    const actionsById = {
      wave: { id: "wave", type: "message" },
      blink: { id: "blink", type: "sprite" },
      hop: { id: "hop", type: "animation" }
    };

    const result = selectActions({
      actionStrategy: "sequence",
      actions: ["blink", "missing", "wave", "hop"]
    }, actionsById);

    expect(result).toEqual([actionsById.blink, actionsById.wave, actionsById.hop]);
  });

  it("returns one random existing action for random strategy", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.6);

    const actionsById = {
      wave: { id: "wave" },
      blink: { id: "blink" },
      hop: { id: "hop" }
    };

    const result = selectActions({
      actionStrategy: "random",
      actions: ["missing", "wave", "blink", "hop"]
    }, actionsById);

    expect(result).toEqual([actionsById.blink]);
  });

  it("returns an empty array when no referenced actions exist", () => {
    expect(selectActions({
      actionStrategy: "random",
      actions: ["missing"]
    }, {})).toEqual([]);
  });

  it("handles missing rule actions", () => {
    expect(selectActions({ actionStrategy: "sequence" }, {
      wave: { id: "wave" }
    })).toEqual([]);
  });
});
