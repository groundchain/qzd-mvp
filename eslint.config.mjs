import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "coverage"],
    linterOptions: {
      reportUnusedDisableDirectives: false
    }
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"] ,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    files: ["**/src/generated/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-namespace": "off",
      "eslint/no-unused-disable": "off"
    }
  },
  {
    files: ["**/*.{ts,tsx,jsx,js}"] ,
    languageOptions: {
      ...jsxA11y.flatConfigs?.recommended?.languageOptions
    },
    plugins: {
      ...jsxA11y.flatConfigs?.recommended?.plugins,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...jsxA11y.flatConfigs?.recommended?.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  }
);
