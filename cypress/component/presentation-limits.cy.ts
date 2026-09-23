import { validateAndLimitOutlines } from "../../utils/presentationLimits";

describe("outline payload validation", () => {
  it("rejects malformed or blank slide entries", () => {
    const malformedPayloads: unknown[] = [
      [null],
      [{}],
      [{ content: {} }],
      [{ content: "   " }],
    ];

    malformedPayloads.forEach((payload) => {
      expect(validateAndLimitOutlines(payload)).to.deep.equal([]);
    });
  });

  it("limits valid slide entries without coercing their content", () => {
    expect(
      validateAndLimitOutlines([
        { content: "Opening" },
        { content: "Key findings" },
      ]),
    ).to.deep.equal([
      { content: "Opening" },
      { content: "Key findings" },
    ]);
  });
});
