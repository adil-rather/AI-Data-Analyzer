import { useState } from "react";
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceContext } from "../hooks/useAnalysis";
import Forecast from "../views/Forecast";
function Harness() {
  const [cache, setCache] = useState({});
  return (
    <WorkspaceContext.Provider value={{ cache, setCache }}>
      <Forecast
        profile={{ stats: [{ name: "value", type: "numeric" }] }}
        datasetId="fixture"
      />
    </WorkspaceContext.Provider>
  );
}
test("custom seasonal period remains editable when its old value is cleared", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.selectOptions(screen.getByLabelText("Seasonality"), "custom");
  await user.clear(screen.getByLabelText("Period (steps)"));
  expect(screen.getByLabelText("Period (steps)")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Period (steps)"), "12");
  expect(screen.getByLabelText("Period (steps)")).toHaveValue(12);
});
