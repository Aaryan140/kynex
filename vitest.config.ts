import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/utils.ts",
        "lib/analyzers/expense.ts",
        "lib/analyzers/food.ts",
        "lib/analyzers/workout.ts",
        "lib/supabase/client.ts"
      ],
      reporter: ["text", "text-summary"]
    }
  }
});
