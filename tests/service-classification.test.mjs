import assert from "node:assert/strict";
import test from "node:test";

import { classifyServiceM8Job, specialistClassificationFallback } from "../app/service-classification.ts";

const classify = (jobDescription) => classifyServiceM8Job({ job_description: jobDescription });

test("classifies the three reported ServiceM8 jobs for Rafiq's selected skills", () => {
  assert.equal(classify("8am - 11am Service Required: roofing-gutters Message: Would like a roof inspection due to some old leaks.").skill, "Roofing");
  assert.equal(classify("10am only METAL ROOF LEAKING.").skill, "Roofing");
  assert.equal(classify("GUTTER CLEANING on 2 Storey Townhouse").skill, "Gutter Cleaning");
});

test("repairs job 9901's generic handoff from its bathroom-renovation description", () => {
  assert.deepEqual(
    specialistClassificationFallback({
      service: "General enquiry",
      issue: "complete bathroom renovation",
      requiredSkill: "General Plumbing"
    }),
    {
      service: "Bathroom renovation plumbing",
      skill: "Bathroom Renovation Plumbing",
      tool: "",
      priority: "Standard",
      duration: 180
    }
  );
});

test("does not replace an existing specialist classification or unmatched generic job", () => {
  assert.equal(specialistClassificationFallback({
    service: "Roofing",
    issue: "complete bathroom renovation",
    requiredSkill: "Roofing"
  }), null);
  assert.equal(specialistClassificationFallback({
    service: "General enquiry",
    issue: "replace leaking garden tap",
    requiredSkill: "General Plumbing"
  }), null);
});

test("maps every configurable specialist service to its matching skill", () => {
  const cases = [
    ["blocked toilet", "Blocked Drains"],
    ["hot water heater repair", "Hot Water"],
    ["install replacement Thermann hot water system", "Hot Water Installation"],
    ["gas heater service", "Gas"],
    ["roof flashing repair", "Roofing"],
    ["replace damaged downpipe", "Guttering"],
    ["clean blocked gutters", "Gutter Cleaning"],
    ["concealed leak detection", "Leak Detection"],
    ["replace electrical power point", "Electrical"],
    ["waterproofing membrane to balcony", "Waterproofing"],
    ["epoxy regrout shower floor", "Regrouting"],
    ["sewer drainage replacement", "Drainage Replacement"],
    ["epoxy pipe relining", "Pipe Relining"],
    ["bathroom renovation plumbing rough-in", "Bathroom Renovation Plumbing"],
    ["frameless shower screen installation", "Shower Screens"],
    ["toilet suite replacement", "Toilet Replacement"],
    ["vanity replacement", "Vanity Replacement"]
  ];

  for (const [description, expectedSkill] of cases) {
    assert.equal(classify(description).skill, expectedSkill, description);
  }
});

test("keeps unmatched jobs in General Plumbing", () => {
  assert.equal(classify("replace leaking garden tap").skill, "General Plumbing");
});
