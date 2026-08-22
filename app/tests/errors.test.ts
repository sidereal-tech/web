// SPDX-License-Identifier: Apache-2.0

import { ContractError } from "@sidereal/sdk";
import { describe, expect, it } from "vitest";
import { describeError } from "../lib/errors";

describe("describeError", () => {
  it("keeps tokenizer fee administration codes aligned with the contract", () => {
    expect(describeError(new ContractError("Error(Contract, #10)", 10), "tokenizer")).toBe(
      "Enter a valid claimed-yield fee.",
    );
    expect(describeError(new ContractError("Error(Contract, #11)", 11), "tokenizer")).toBe(
      "Only the configured admin can change this fee.",
    );
    expect(describeError(new ContractError("Error(Contract, #12)", 12), "tokenizer")).toBe(
      "This market's fee recipient cannot receive claimed-yield fees.",
    );
  });

  it("labels the V2 vault preview errors returned by the audited contracts", () => {
    expect(describeError(new ContractError("Error(Contract, #12)", 12), "sy")).toBe(
      "The first deposit is too small to open this market.",
    );
    expect(describeError(new ContractError("Error(Contract, #13)", 13), "sy")).toBe(
      "This deposit exceeds the market cap.",
    );
    expect(describeError(new ContractError("Error(Contract, #14)", 14), "sy")).toBe(
      "Only the configured admin can change the deposit cap.",
    );
  });

  it("labels an unsafe orderbook fee recipient", () => {
    expect(describeError(new ContractError("Error(Contract, #20)", 20), "orderbook")).toBe(
      "This market's fee recipient cannot receive orderbook fees.",
    );
  });
});
